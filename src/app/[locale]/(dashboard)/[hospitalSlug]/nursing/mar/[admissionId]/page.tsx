import { db } from "@/lib/db";
import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { admissions, beds, rooms } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { prescriptions, prescriptionItems, medications, medicationAdministration } from "@db/schema/pharmacy";
import { eq, and, desc } from "drizzle-orm";
import { MarClient } from "./MarClient";

export default async function MarPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; admissionId: string }>;
}) {
  const { locale, hospitalSlug, admissionId } = await params;
  const t = await getTranslations({ locale, namespace: "nursing" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC: Clinical roles only
  const ALLOWED_MAR_ROLES = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE", "DOCTOR", "SURGEON"];
  if (!ALLOWED_MAR_ROLES.includes(session.user.role)) {
    notFound();
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  // Fetch MAR data within tenant context
  const marData = await withTenantContext(hospital.id, async (tx) => {
    // 1. Fetch admission with patient and bed info
    const admission = await tx
      .select({
        id: admissions.id,
        admissionDate: admissions.admissionDate,
        reason: admissions.reason,
        patientId: patients.id,
        patientNameAr: patients.nameAr,
        patientNameEn: patients.nameEn,
        patientNumber: patients.patientNumber,
        bedNumber: beds.bedNumber,
        roomNumber: rooms.roomNumber,
      })
      .from(admissions)
      .innerJoin(patients, eq(admissions.patientId, patients.id))
      .leftJoin(beds, eq(admissions.bedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .where(and(eq(admissions.id, admissionId), eq(admissions.hospitalId, hospital.id)))
      .then((res) => res[0]);

    if (!admission) return null;

    // 2. Fetch active prescriptions and items
    const activePrescriptions = await tx
      .select({
        id: prescriptionItems.id,
        medicationId: medications.id,
        medicationNameAr: medications.nameAr,
        medicationNameEn: medications.nameEn,
        strength: medications.strength,
        form: medications.form,
        dosage: prescriptionItems.dosage,
        frequency: prescriptionItems.frequency,
        durationDays: prescriptionItems.durationDays,
        instructions: prescriptionItems.instructions,
        status: prescriptionItems.status,
        createdAt: prescriptions.createdAt,
      })
      .from(prescriptionItems)
      .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
      .innerJoin(medications, eq(prescriptionItems.medicationId, medications.id))
      .where(
        and(
          eq(prescriptions.admissionId, admissionId),
          eq(prescriptions.status, "active"),
          eq(prescriptionItems.status, "pending") // Or already partially dispensed
        )
      );

    // 3. Fetch recent administrations for these items
    const recentAdministrations = await tx
      .select()
      .from(medicationAdministration)
      .where(eq(medicationAdministration.patientId, admission.patientId))
      .orderBy(desc(medicationAdministration.scheduledAt))
      .limit(100);

    return {
      admission,
      prescriptions: activePrescriptions,
      administrations: recentAdministrations,
    };
  });

  if (!marData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-8 px-4 sm:px-6 lg:px-8">
      <MarClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        admission={marData.admission}
        prescriptions={marData.prescriptions}
        administrations={marData.administrations}
      />
    </div>
  );
}
