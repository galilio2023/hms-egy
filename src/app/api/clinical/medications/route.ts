import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { medications } from "@db/schema/pharmacy";
import { eq, and, or, ilike } from "drizzle-orm";
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
      return await tx
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.hospitalId, hospitalId),
            eq(medications.isActive, true),
            or(
              ilike(medications.nameEn, `%${query}%`),
              ilike(medications.nameAr, `%${query}%`),
              ilike(medications.genericName, `%${query}%`),
              ilike(medications.barcode || "", `%${query}%`)
            )
          )
        )
        .limit(20);
    });

    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error("[MEDICATION_SEARCH_API_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
