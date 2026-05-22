import { db } from "@/lib/db";
import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { rooms, beds, admissions, vitalsFlowsheet } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { eq, and, or, inArray, desc, sql } from "drizzle-orm";
import AdmissionsDashboardClient from "./AdmissionsDashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "admissions" });
  
  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title")} | ${hospitalName} | HMS Egypt`,
    description: "Inpatient admissions board, bed status map tracking, and flowsheet monitoring.",
  };
}

export default async function AdmissionsPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "admissions" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
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

  // Wrap all data fetching in tenant context to ensure RLS compliance
  const dashboardData = await withTenantContext(hospital.id, async (tx) => {
    // Execute all independent dashboard queries concurrently to optimize performance
    const [
      roomsList,
      bedsWithAdmissions,
      doctorsList,
      housekeepingRes,
      recentVitals
    ] = await Promise.all([
      // A. Fetch all rooms in the hospital
      tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          type: rooms.type,
          floor: rooms.floor,
          wing: rooms.wing,
          isActive: rooms.isActive,
        })
        .from(rooms)
        .where(eq(rooms.hospitalId, hospital.id))
        .orderBy(rooms.roomNumber),

      // B. Fetch all beds joined with rooms, active admissions, patients, and admitting doctor
      tx
        .select({
          bedId: beds.id,
          bedNumber: beds.bedNumber,
          status: beds.status,
          lastDischargedAt: beds.lastDischargedAt,
          cleaningRequestedAt: beds.cleaningRequestedAt,
          
          roomId: rooms.id,
          roomNumber: rooms.roomNumber,
          roomType: rooms.type,
          floor: rooms.floor,
          wing: rooms.wing,

          admissionId: admissions.id,
          admissionDate: admissions.admissionDate,
          reason: admissions.reason,
          admissionStatus: admissions.status,

          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          nationalId: patients.nationalId,
          gender: patients.gender,
          dob: patients.dob,

          doctorId: staff.id,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          doctorLicense: staff.licenseNumber,
        })
        .from(beds)
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .leftJoin(
          admissions,
          and(
            eq(beds.id, admissions.bedId),
            eq(admissions.status, "active")
          )
        )
        .leftJoin(patients, eq(admissions.patientId, patients.id))
        .leftJoin(staff, eq(admissions.admittingDoctorId, staff.id))
        .where(eq(beds.hospitalId, hospital.id))
        .orderBy(beds.bedNumber),

      // C. Fetch active admitting doctors list
      tx
        .select({
          id: staff.id,
          nameAr: staff.nameAr,
          nameEn: staff.nameEn,
          licenseNumber: staff.licenseNumber,
        })
        .from(staff)
        .where(
          and(
            eq(staff.hospitalId, hospital.id),
            eq(staff.isActive, true),
            or(eq(staff.role, "DOCTOR"), eq(staff.role, "SURGEON"))
          )
        )
        .orderBy(staff.nameEn),

      // D. Count pending cleaning housekeeping tasks
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(housekeepingTasks)
        .where(
          and(
            eq(housekeepingTasks.hospitalId, hospital.id),
            eq(housekeepingTasks.status, "pending")
          )
        )
        .then((res) => res[0]),

      // E. Fetch recent vitals for ALL currently active inpatients in this hospital
      // This eliminates the waterfall by not waiting for bedsWithAdmissions results
      tx
        .select({
          id: vitalsFlowsheet.id,
          patientId: vitalsFlowsheet.patientId,
          recordedAt: vitalsFlowsheet.recordedAt,
          bloodPressureSystolic: vitalsFlowsheet.bloodPressureSystolic,
          bloodPressureDiastolic: vitalsFlowsheet.bloodPressureDiastolic,
          heartRate: vitalsFlowsheet.heartRate,
          respiratoryRate: vitalsFlowsheet.respiratoryRate,
          temperature: vitalsFlowsheet.temperature,
          oxygenSaturation: vitalsFlowsheet.oxygenSaturation,
          weightKg: vitalsFlowsheet.weightKg,
          heightCm: vitalsFlowsheet.heightCm,
          recorderNameAr: staff.nameAr,
          recorderNameEn: staff.nameEn,
        })
        .from(vitalsFlowsheet)
        .innerJoin(
          admissions,
          and(
            eq(vitalsFlowsheet.patientId, admissions.patientId),
            eq(admissions.status, "active"),
            eq(admissions.hospitalId, hospital.id)
          )
        )
        .leftJoin(staff, eq(vitalsFlowsheet.recordedBy, staff.id))
        .where(eq(vitalsFlowsheet.hospitalId, hospital.id))
        .orderBy(desc(vitalsFlowsheet.recordedAt))
    ]);

    // Group vitals by patient ID
    const vitalsByPatient: Record<string, typeof recentVitals> = {};
    for (const record of recentVitals) {
      const patientId = record.patientId;
      if (!vitalsByPatient[patientId]) {
        vitalsByPatient[patientId] = [];
      }
      vitalsByPatient[patientId].push(record);
    }

    const pendingCleaningCount = housekeepingRes?.count || 0;

    return {
      roomsList,
      bedsWithAdmissions,
      vitalsByPatient,
      doctorsList,
      pendingCleaningCount,
    };
  });

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <AdmissionsDashboardClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        rooms={dashboardData.roomsList}
        bedsData={dashboardData.bedsWithAdmissions}
        doctors={dashboardData.doctorsList}
        vitalsHistory={dashboardData.vitalsByPatient}
        pendingCleaningCount={dashboardData.pendingCleaningCount}
      />
    </div>
  );
}
