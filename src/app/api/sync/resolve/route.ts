import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { patients } from "@db/schema/patients";
import { admissions, vitalsFlowsheet } from "@db/schema/clinical";

const TABLE_MAP: Record<string, typeof patients | typeof admissions | typeof vitalsFlowsheet> = {
  patients,
  admissions,
  vitals_flowsheet: vitalsFlowsheet,
};

export async function POST(req: NextRequest) {
  try {
    const op = await req.json();
    const { tableName, entityId, version, payload, action } = op;

    const table = TABLE_MAP[tableName];
    if (!table) {
      return NextResponse.json({ error: `Unsupported table: ${tableName}` }, { status: 400 });
    }

    // Fetch current server state
    const [currentRecord] = await db
      .select({
        version: table.version,
        updatedAt: table.updatedAt
      })
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!currentRecord) {
      if (action === "INSERT") {
        await db.insert(table).values({
          ...payload,
          id: entityId,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return NextResponse.json({ status: "synced" });
      }
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // LWW (Last-Write-Wins) Conflict Resolution
    // We compare timestamps to ensure the absolute latest clinical data wins,
    // regardless of whether it arrived late due to offline survivability.
    const clientTimestamp = op.timestamp;
    const serverUpdatedAt = currentRecord.updatedAt ? new Date(currentRecord.updatedAt).getTime() : 0;

    if (clientTimestamp < serverUpdatedAt) {
      return NextResponse.json({
        status: "ignored",
        message: "Stale update: Server already has a newer revision of this record.",
        serverVersion: currentRecord.version
      }, { status: 200 }); // Return 200 so client clears it from outbox
    }

    // If no conflict, apply the database changes to prevent data loss
    if (action === "UPDATE") {
      await db.update(table)
        .set({
          ...payload,
          version: sql`${table.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(table.id, entityId));
    } else if (action === "INSERT") {
      await db.insert(table).values({
        ...payload,
        id: entityId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (action === "DELETE") {
      await db.delete(table).where(eq(table.id, entityId));
    }

    return NextResponse.json({ status: "synced" });
  } catch (error) {
    console.error("[SYNC RESOLVE API ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
