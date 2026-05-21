import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { eq, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import SuperAdminDashboardClient from "@/components/layout/SuperAdminDashboardClient";
import { amountToArabicWords } from "@/lib/utils/formatting";
import { type PlanTier, PLAN_PRICING } from "@/types/plans.types";
import { auth } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superAdmin" });
  return {
    title: `${t("title")} | HMS Egypt`,
    description: "Hospital Management System cross-tenant administrative control center.",
  };
}

export default async function SuperAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Protect the route - role check guard
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    notFound();
  }

  // Fetch all hospitals joined with their settings from PostgreSQL
  const dbHospitals = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
      slug: hospitals.slug,
      contactEmail: hospitals.contactEmail,
      contactPhone: hospitals.contactPhone,
      address: hospitals.address,
      governorate: hospitals.governorate,
      type: hospitals.type,
      planTier: hospitals.planTier,
      isActive: hospitals.isActive,
      createdAt: hospitals.createdAt,
      // Settings fields
      isSurgicalEnabled: hospitalSettings.isSurgicalEnabled,
      isTelemedicineEnabled: hospitalSettings.isTelemedicineEnabled,
      isPatientPortalEnabled: hospitalSettings.isPatientPortalEnabled,
      isOnlinePaymentsEnabled: hospitalSettings.isOnlinePaymentsEnabled,
    })
    .from(hospitals)
    .leftJoin(hospitalSettings, eq(hospitals.id, hospitalSettings.hospitalId));

  // Compute stats on the server for MRR dynamic Tafgeet words using global PLAN_PRICING
  const [mrrResult] = await db
    .select({
      mrr: sql<number>`SUM(CASE WHEN ${hospitals.isActive} = true THEN 
        CASE 
          WHEN ${hospitals.planTier} = 'starter' THEN ${PLAN_PRICING.starter}
          WHEN ${hospitals.planTier} = 'professional' THEN ${PLAN_PRICING.professional}
          WHEN ${hospitals.planTier} = 'enterprise' THEN ${PLAN_PRICING.enterprise}
          ELSE 0 
        END 
      ELSE 0 END)`
    })
    .from(hospitals);
  
  const calculatedMRR = Number(mrrResult?.mrr || 0);

  // Convert MRR to Arabic words (Tafgeet)
  const mrrWordsAr = await amountToArabicWords(calculatedMRR);
  
  // Format English words representation
  const mrrWordsEn = `${new Intl.NumberFormat("en-US", { style: "currency", currency: "EGP" }).format(calculatedMRR)} Monthly Recurring Revenue`;

  // Ensure typed array matches HospitalWithSettings[] interface
  const typedHospitals = dbHospitals.map((h) => ({
    ...h,
    planTier: h.planTier as PlanTier,
  }));

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto bg-white rounded-3xl border border-gray-100/80 shadow-sm p-6 sm:p-8">
        <SuperAdminDashboardClient
          initialHospitals={typedHospitals}
          mrrWordsAr={mrrWordsAr}
          mrrWordsEn={mrrWordsEn}
          locale={locale}
        />
      </div>
    </div>
  );
}
