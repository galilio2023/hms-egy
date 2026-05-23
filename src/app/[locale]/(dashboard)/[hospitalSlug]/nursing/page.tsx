import { db } from "@/lib/db";
import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { rooms, beds, admissions, vitalsFlowsheet } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { eq, and, desc, sql } from "drizzle-orm";
import NursingDashboardClient from "./NursingDashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "nursing" });
  
  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title") || "Nurse Dashboard"} | ${hospitalName} | HMS Egypt`,
    description: "Nursing shift dashboard, inpatient vitals, and MAR.",
  };
}

export default async function NursingPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "nursing" });

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

  // Fetch dashboard data within tenant context
  const dashboardData = await withTenantContext(hospital.id, async (tx) => {
    const [
      activePatientsRes,
      pendingCleaningRes,
      recentVitalsRes
    ] = await Promise.all([
      // A. Fetch active admissions with patient and bed info
      tx
        .select({
          admissionId: admissions.id,
          admissionDate: admissions.admissionDate,
          reason: admissions.reason,
          
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          gender: patients.gender,
          dob: patients.dob,

          bedId: beds.id,
          bedNumber: beds.bedNumber,
          
          roomId: rooms.id,
          roomNumber: rooms.roomNumber,
          roomType: rooms.type,
          floor: rooms.floor,
          wing: rooms.wing,
          
          doctorId: staff.id,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(admissions)
        .innerJoin(patients, eq(admissions.patientId, patients.id))
        .leftJoin(beds, eq(admissions.bedId, beds.id))
        .leftJoin(rooms, eq(beds.roomId, rooms.id))
        .leftJoin(staff, eq(admissions.admittingDoctorId, staff.id))
        .where(
          and(
            eq(admissions.hospitalId, hospital.id),
            eq(admissions.status, "active")
          )
        )
        .orderBy(desc(admissions.admissionDate)),

      // B. Count beds in pending_cleaning status
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(beds)
        .where(
          and(
            eq(beds.hospitalId, hospital.id),
            eq(beds.status, "pending_cleaning")
          )
        )
        .then((res) => res[0]),

      // C. Fetch the absolute latest vitals record for each active inpatient (unrestricted by time to provide baseline)
      tx
        .selectDistinctOn([vitalsFlowsheet.patientId], {
          patientId: vitalsFlowsheet.patientId,
          recordedAt: vitalsFlowsheet.recordedAt,
          bloodPressureSystolic: vitalsFlowsheet.bloodPressureSystolic,
          bloodPressureDiastolic: vitalsFlowsheet.bloodPressureDiastolic,
          heartRate: vitalsFlowsheet.heartRate,
          temperature: vitalsFlowsheet.temperature,
          oxygenSaturation: vitalsFlowsheet.oxygenSaturation,
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
        .where(eq(vitalsFlowsheet.hospitalId, hospital.id))
        .orderBy(vitalsFlowsheet.patientId, desc(vitalsFlowsheet.recordedAt))
    ]);

    const pendingCleaningCount = pendingCleaningRes?.count || 0;

    // Group vitals by patient ID
    const vitalsByPatient: Record<string, typeof recentVitalsRes> = {};
    for (const record of recentVitalsRes) {
      if (!vitalsByPatient[record.patientId]) {
        vitalsByPatient[record.patientId] = [];
      }
      vitalsByPatient[record.patientId].push(record);
    }

    return {
      activePatients: activePatientsRes,
      pendingCleaningCount,
      vitalsByPatient,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-8 px-4 sm:px-6 lg:px-8">
      <NursingDashboardClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        activePatients={dashboardData.activePatients}
        pendingCleaningCount={dashboardData.pendingCleaningCount}
        vitalsByPatient={dashboardData.vitalsByPatient}
      />
    </div>
  );
}
