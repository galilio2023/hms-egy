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
      .select({ version: table.version })
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!currentRecord) {
      // If it's an INSERT and record doesn't exist, it's fine.
      // But usually sync engine handles existing records.
      if (action === "INSERT") {
        return NextResponse.json({ status: "synced" });
      }
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Version-based Conflict Resolution
    if (version !== undefined && version < currentRecord.version) {
      return NextResponse.json({
        status: "conflict",
        serverVersion: currentRecord.version,
        message: "Version mismatch: Local version is older than server version."
      }, { status: 409 });
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
