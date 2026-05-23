import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { medications, prescriptions, prescriptionItems, stockTransactions } from "@/db/schema/pharmacy";
import { patients } from "@/db/schema/patients";
import { staff } from "@/db/schema/core";
import { eq, and, desc, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import PharmacyDashboardClient from "./PharmacyDashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "pharmacy" });
  
  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title")} | ${hospitalName} | HMS Egypt`,
    description: t("description"),
  };
}

export default async function PharmacyPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC: Restrict to pharmacists, doctors, and admins
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "PHARMACIST", "DOCTOR", "SURGEON"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    notFound();
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== hospital.id) {
    notFound();
  }

  // Fetch dashboard data within tenant context
  const dashboardData = await withTenantContext(hospital.id, async (tx) => {
    const [
      pendingPrescriptionsRes,
      lowStockRes,
      recentTransactionsRes
    ] = await Promise.all([
      // 1. Pending Prescriptions (Queue)
      tx
        .select({
          id: prescriptions.id,
          createdAt: prescriptions.createdAt,
          status: prescriptions.status,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          itemCount: sql<number>`count(${prescriptionItems.id})`.mapWith(Number),
        })
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .innerJoin(staff, eq(prescriptions.doctorId, staff.id))
        .leftJoin(prescriptionItems, eq(prescriptions.id, prescriptionItems.prescriptionId))
        .where(
          and(
            eq(prescriptions.hospitalId, hospital.id),
            eq(prescriptions.status, "active")
          )
        )
        .groupBy(prescriptions.id, patients.id, staff.id)
        .orderBy(desc(prescriptions.createdAt))
        .limit(20),

      // 2. Low Stock Alerts
      tx
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.hospitalId, hospital.id),
            eq(medications.isActive, true),
            sql`${medications.stockCount} <= ${medications.minStockLevel}`
          )
        )
        .orderBy(medications.stockCount)
        .limit(10),

      // 3. Recent Transactions (Stock movements)
      tx
        .select({
          id: stockTransactions.id,
          type: stockTransactions.type,
          quantity: stockTransactions.quantity,
          createdAt: stockTransactions.createdAt,
          medicationNameAr: medications.nameAr,
          medicationNameEn: medications.nameEn,
          performedByNameAr: staff.nameAr,
          performedByNameEn: staff.nameEn,
        })
        .from(stockTransactions)
        .innerJoin(medications, eq(stockTransactions.medicationId, medications.id))
        .leftJoin(staff, eq(stockTransactions.performedBy, staff.id))
        .where(eq(stockTransactions.hospitalId, hospital.id))
        .orderBy(desc(stockTransactions.createdAt))
        .limit(10),
    ]);

    return {
      pendingPrescriptions: pendingPrescriptionsRes,
      lowStock: lowStockRes,
      recentTransactions: recentTransactionsRes,
    };
  });

  return (
    <PharmacyDashboardClient 
      initialData={dashboardData}
      hospitalSlug={hospitalSlug}
      locale={locale}
    />
  );
}
