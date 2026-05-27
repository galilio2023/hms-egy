import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { medications } from "@db/schema/pharmacy";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { withTenantContext } from "@/lib/db/tenant";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return NextResponse.json({ error: "Hospital context missing" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const results = await withTenantContext(hospitalId, async (tx) => {
      const isNumericBarcode = /^\d+$/.test(query);

      const conditions = [
        eq(medications.hospitalId, hospitalId),
        eq(medications.isActive, true),
      ];

      if (isNumericBarcode && query.length >= 8) {
        return await tx
          .select()
          .from(medications)
          .where(and(...conditions, eq(medications.barcode, query)))
          .limit(20);
      }

      // High-performance Trigram Optimization: Use % operator for guaranteed GIN index utilization.
      // Set the threshold for the current transaction only (true flag).
      await tx.execute(sql`SELECT set_config('pg_trgm.similarity_threshold', '0.3', true)`);

      return await tx
        .select()
        .from(medications)
        .where(
          and(
            ...conditions,
            or(
              // Index-supported Trigram Similarity Matching (%)
              sql`${medications.nameEn} % ${query}`,
              sql`${medications.nameAr} % ${query}`,
              sql`${medications.genericName} % ${query}`
            )
          )
        )
        .limit(20);
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[MEDICATION_SEARCH_API_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
