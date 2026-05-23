import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prescriptions, prescriptionItems } from "@db/schema/pharmacy";
import { patients } from "@db/schema/patients";
import { staff } from "@db/schema/core";
import { eq, and, desc, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import DispenseSearchClient from "./DispenseSearchClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pharmacy" });
  return {
    title: `${t("dispenseMedication")} | HMS Egypt`,
  };
}

export default async function DispensePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "PHARMACIST"];
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

  // Fetch pending active prescriptions
  const activePrescriptions = await withTenantContext(hospital.id, async (tx) => {
    return await tx
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
      .groupBy(
        prescriptions.id, 
        prescriptions.createdAt, 
        prescriptions.status, 
        patients.id, 
        patients.nameAr, 
        patients.nameEn, 
        patients.patientNumber, 
        staff.id, 
        staff.nameAr, 
        staff.nameEn
      )
      .orderBy(desc(prescriptions.createdAt));
  });

  return (
    <DispenseSearchClient 
      initialPrescriptions={activePrescriptions}
      hospitalSlug={hospitalSlug}
      locale={locale}
    />
  );
}
