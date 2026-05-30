import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { patients } from "@db/schema/patients";
import { admissions, vitalsFlowsheet } from "@db/schema/clinical";
import { auth } from "@/lib/auth";
import { safeParseFloat, safeParseInt } from "@/lib/utils/formatting";

const TABLE_MAP: Record<string, typeof patients | typeof admissions | typeof vitalsFlowsheet> = {
  patients,
  admissions,
  vitals_flowsheet: vitalsFlowsheet,
};

type TableInsertMap = {
  patients: typeof patients.$inferInsert;
  admissions: typeof admissions.$inferInsert;
  vitals_flowsheet: typeof vitalsFlowsheet.$inferInsert;
};

/**
 * Strict whitelist filter for sync payloads to prevent mass-assignment vulnerabilities.
 */
function filterPayload(tableName: string, payload: Record<string, unknown>): Record<string, unknown> {
  const allowedFields: Record<string, string[]> = {
    patients: ["hospitalId", "nameAr", "nameEn", "nationalId", "passportNumber", "dob", "gender", "contactPhone", "address", "governorate", "bloodType"],
    admissions: ["hospitalId", "patientId", "bedId", "admittingDoctorId", "admissionDate", "reason", "status"],
    vitals_flowsheet: ["hospitalId", "patientId", "recordedBy", "recordedAt", "bloodPressureSystolic", "bloodPressureDiastolic", "heartRate", "respiratoryRate", "temperature", "oxygenSaturation", "weightKg", "heightCm"],
  };

  const fields = allowedFields[tableName] || [];
  const filtered: Record<string, unknown> = {};
  for (const field of fields) {
    if (payload[field] !== undefined) {
      filtered[field] = payload[field];
    }
  }
  return filtered;
}

export async function POST(req: NextRequest) {
  try {
    // 0. Authenticate & Verify Tenant Isolation (BOLA Fix)
    const session = await auth();
    if (!session || !session.user.hospitalId || session.user.hospitalId === "system-wide") {
      return NextResponse.json({ error: "Unauthorized: Sync requires a valid hospital session context." }, { status: 403 });
    }
    const userHospitalId = session.user.hospitalId;

    const op = await req.json();
    const { tableName, entityId, payload, action } = op;

    const table = TABLE_MAP[tableName];
    if (!table) {
      return NextResponse.json({ error: `Unsupported table: ${tableName}` }, { status: 400 });
    }

    // 1. Sanitize Payload (Security: Prevent Mass-Assignment)
    let sanitizedPayload = {
      ...filterPayload(tableName, payload),
      hospitalId: userHospitalId, // Force tenant isolation from session
    };

    // 1b. Clinical Data Normalization (Enforce Strict Types)
    if (tableName === "vitals_flowsheet") {
      const floatFields = ["temperature", "weightKg"];
      const intFields = ["bloodPressureSystolic", "bloodPressureDiastolic", "heartRate", "respiratoryRate", "oxygenSaturation", "heightCm"];

      for (const field of floatFields) {
        if (payload[field] !== undefined) {
          const val = safeParseFloat(payload[field] as string);
          if (val !== undefined && isNaN(val)) {
            return NextResponse.json({ error: `Invalid numeric value for ${field}` }, { status: 400 });
          }
          sanitizedPayload[field] = val;
        }
      }

      for (const field of intFields) {
        if (payload[field] !== undefined) {
          const val = safeParseInt(payload[field] as string);
          if (val === undefined && payload[field] !== "" && payload[field] !== null) {
            // safeParseInt returns undefined if it's NaN.
            // We only want to error if it's truly a bad numeric string.
            if (isNaN(parseInt(payload[field] as string, 10))) {
              return NextResponse.json({ error: `Invalid integer value for ${field}` }, { status: 400 });
            }
          }
          sanitizedPayload[field] = val;
        }
      }
    }

    // 2. Fetch current server state
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
        if (!sanitizedPayload.hospitalId) {
          return NextResponse.json({ error: "hospitalId is required for new records" }, { status: 400 });
        }

        await db.insert(table).values({
          ...(sanitizedPayload as TableInsertMap[keyof TableInsertMap]),
          id: entityId,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return NextResponse.json({ status: "synced" });
      }
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // 3. LWW (Last-Write-Wins) Conflict Resolution with Clock-Skew Guard
    const clientTimestamp = Number(op.timestamp) || Date.now();
    const serverUpdatedAt = currentRecord.updatedAt ? new Date(currentRecord.updatedAt).getTime() : 0;
    const now = Date.now();

    // Sanity check: If client clock is more than 24 hours in the future, it's likely a misconfiguration.
    const MAX_CLOCK_SKEW = 24 * 60 * 60 * 1000;
    const isClockHeavilySkewed = clientTimestamp > now + MAX_CLOCK_SKEW;

    if (clientTimestamp < serverUpdatedAt || isClockHeavilySkewed) {
      return NextResponse.json({
        status: "conflict",
        message: isClockHeavilySkewed
          ? "Clock skew detected: Client timestamp is too far in the future."
          : "Stale update: Server already has a newer revision of this record.",
        serverVersion: currentRecord.version
      }, { status: 409 }); // Return 409 Conflict so client discards it
    }

    // 4. Apply the database changes
    if (action === "UPDATE") {
      await db.update(table)
        .set({
          ...sanitizedPayload,
          version: sql`${table.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(table.id, entityId));
    } else if (action === "INSERT") {
      // Record exists but action was INSERT - likely a sync re-run, treat as update if LWW allows
      await db.update(table)
        .set({
          ...sanitizedPayload,
          version: sql`${table.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(table.id, entityId));
    } else if (action === "DELETE") {
      await db.delete(table).where(eq(table.id, entityId));
    }

    return NextResponse.json({ status: "synced" });
  } catch (error) {
    console.error("[SYNC RESOLVE API ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
