import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { labOrders, labOrderItems, criticalValueAlerts } from "@db/schema/laboratory";
import { staff } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import LaboratoryDashboardClient from "./LaboratoryDashboardClient";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "laboratory" });
  
  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title") || "Lab Dashboard"} | ${hospitalName} | HMS Egypt`,
    description: "Laboratory Information System - Orders and Results.",
  };
}

export default async function LaboratoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const { tab } = await searchParams;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC: Restrict to clinical and lab staff
  const ALLOWED_LAB_ROLES = ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON", "NURSE", "LAB_TECH", "LAB_ADMIN"];
  if (!ALLOWED_LAB_ROLES.includes(session.user.role)) {
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
      pendingOrdersRes,
      processingOrdersRes,
      recentCompletedRes,
      criticalAlertsRes
    ] = await Promise.all([
      // 1. Pending orders (not yet collected or just requested)
      tx
        .select({
          id: labOrders.id,
          priority: labOrders.priority,
          status: labOrders.status,
          createdAt: labOrders.createdAt,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(labOrders)
        .innerJoin(patients, eq(labOrders.patientId, patients.id))
        .innerJoin(staff, eq(labOrders.doctorId, staff.id))
        .where(
          and(
            eq(labOrders.hospitalId, hospital.id),
            eq(labOrders.status, "pending")
          )
        )
        .orderBy(desc(labOrders.createdAt)),

      // 2. Orders in processing (collected or processing)
      tx
        .select({
          id: labOrders.id,
          priority: labOrders.priority,
          status: labOrders.status,
          createdAt: labOrders.createdAt,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(labOrders)
        .innerJoin(patients, eq(labOrders.patientId, patients.id))
        .innerJoin(staff, eq(labOrders.doctorId, staff.id))
        .where(
          and(
            eq(labOrders.hospitalId, hospital.id),
            sql`${labOrders.status} IN ('collected', 'processing')`
          )
        )
        .orderBy(desc(labOrders.createdAt)),

      // 3. Recent completed orders
      tx
        .select({
          id: labOrders.id,
          priority: labOrders.priority,
          status: labOrders.status,
          createdAt: labOrders.createdAt,
          updatedAt: labOrders.updatedAt,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(labOrders)
        .innerJoin(patients, eq(labOrders.patientId, patients.id))
        .innerJoin(staff, eq(labOrders.doctorId, staff.id))
        .where(
          and(
            eq(labOrders.hospitalId, hospital.id),
            eq(labOrders.status, "completed")
          )
        )
        .orderBy(desc(labOrders.updatedAt))
        .limit(50),

      // 4. Critical alerts (unacknowledged)
      tx
        .select({
          id: criticalValueAlerts.id,
          notifiedAt: criticalValueAlerts.notifiedAt,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          notes: criticalValueAlerts.notes,
        })
        .from(criticalValueAlerts)
        .innerJoin(patients, eq(criticalValueAlerts.patientId, patients.id))
        .innerJoin(staff, eq(criticalValueAlerts.notifiedDoctorId, staff.id))
        .where(
          and(
            eq(criticalValueAlerts.hospitalId, hospital.id),
            eq(criticalValueAlerts.acknowledgedByDoctor, false)
          )
        )
        .orderBy(desc(criticalValueAlerts.notifiedAt))
    ]);

    return {
      pendingOrders: pendingOrdersRes,
      processingOrders: processingOrdersRes,
      recentCompleted: recentCompletedRes,
      criticalAlerts: criticalAlertsRes,
      hospitalId: hospital.id,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-8 px-4 sm:px-6 lg:px-8">
      <LaboratoryDashboardClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        hospitalId={dashboardData.hospitalId}
        pendingOrders={dashboardData.pendingOrders}
        processingOrders={dashboardData.processingOrders}
        recentCompleted={dashboardData.recentCompleted}
        criticalAlerts={dashboardData.criticalAlerts}
        activeTab={tab || "pending"}
      />
    </div>
  );
}
