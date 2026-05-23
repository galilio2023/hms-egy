import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { rooms, beds, admissions, vitalsFlowsheet } from "@db/schema/clinical";
import { staff, departments } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { shifts, handoverNotes } from "@db/schema/nursing";
import { eq, and, desc, sql } from "drizzle-orm";
import NursingDashboardClient from "./NursingDashboardClient";
import { getTranslations } from "next-intl/server";

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
  searchParams,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const { view } = await searchParams;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC: Restrict to clinical and administrative roles
  const ALLOWED_NURSING_ROLES = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE", "HOUSEKEEPING", "DOCTOR", "SURGEON"];
  if (!ALLOWED_NURSING_ROLES.includes(session.user.role)) {
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

  const showAll = view === "all";

  // Fetch dashboard data within tenant context
  const dashboardData = await withTenantContext(hospital.id, async (tx) => {
    const userDeptId = session.user.departmentId;
    const filterDept = !showAll && userDeptId;

    const [
      activePatientsRes,
      pendingCleaningRes,
      recentVitalsRes,
      departmentsRes,
      activeShiftRes,
      handoverNotesRes
    ] = await Promise.all([
      // A. Fetch active admissions with patient and bed info
      tx
        .select({
          admissionId: admissions.id,
          admissionDate: admissions.admissionDate,
          reason: admissions.reason,
          
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNormalizedNameAr: patients.normalizedNameAr,
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
            eq(admissions.status, "active"),
            filterDept ? eq(admissions.departmentId, userDeptId) : sql`TRUE`
          )
        )
        .orderBy(desc(admissions.admissionDate)),

      // B. Count beds in pending_cleaning status
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(beds)
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .where(
          and(
            eq(beds.hospitalId, hospital.id),
            eq(beds.status, "pending_cleaning"),
            filterDept ? eq(rooms.departmentId, userDeptId) : sql`TRUE`
          )
        )
        .then((res) => res[0]),

      // C. Fetch the absolute latest vitals record for each active inpatient
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
        .orderBy(vitalsFlowsheet.patientId, desc(vitalsFlowsheet.recordedAt)),

      // D. Fetch all departments
      tx
        .select({ id: departments.id, nameAr: departments.nameAr, nameEn: departments.nameEn })
        .from(departments)
        .where(eq(departments.hospitalId, hospital.id)),

      // E. Fetch active shift for current staff
      tx.query.shifts.findFirst({
        where: and(
          eq(shifts.staffId, session.user.id),
          eq(shifts.status, "active")
        ),
        with: {
          department: true
        }
      }) as unknown as Promise<Record<string, unknown>>,

      // F. Fetch handover notes for active patients
      tx
        .select({
          id: handoverNotes.id,
          patientId: handoverNotes.patientId,
          content: handoverNotes.content,
          priority: handoverNotes.priority,
          isAcknowledged: handoverNotes.isAcknowledged,
          createdAt: handoverNotes.createdAt,
          fromStaffNameAr: staff.nameAr,
          fromStaffNameEn: staff.nameEn,
        })
        .from(handoverNotes)
        .innerJoin(staff, eq(handoverNotes.fromStaffId, staff.id))
        .innerJoin(admissions, eq(handoverNotes.admissionId, admissions.id))
        .where(
          and(
            eq(handoverNotes.hospitalId, hospital.id),
            eq(admissions.status, "active")
          )
        )
        .orderBy(desc(handoverNotes.createdAt))
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

    // Group handover notes by patient ID
    const handoverByPatient: Record<string, Record<string, unknown>[]> = {};
    for (const note of handoverNotesRes) {
      if (!handoverByPatient[note.patientId]) {
        handoverByPatient[note.patientId] = [];
      }
      handoverByPatient[note.patientId].push(note as unknown as Record<string, unknown>);
    }

    const activeShift = activeShiftRes as unknown as { 
      id: string; 
      startTime: Date; 
      departmentId: string; 
      department: { nameAr: string; nameEn: string } 
    } | null;

    return {
      activePatients: activePatientsRes,
      pendingCleaningCount,
      vitalsByPatient,
      handoverByPatient,
      departments: departmentsRes,
      activeShift,
      hasDepartment: !!userDeptId,
      hospitalId: hospital.id,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-8 px-4 sm:px-6 lg:px-8">
      <NursingDashboardClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        hospitalId={dashboardData.hospitalId}
        activePatients={dashboardData.activePatients}
        pendingCleaningCount={dashboardData.pendingCleaningCount}
        vitalsByPatient={dashboardData.vitalsByPatient}
        handoverByPatient={dashboardData.handoverByPatient}
        departments={dashboardData.departments}
        activeShift={dashboardData.activeShift ? {
          id: dashboardData.activeShift.id,
          startTime: dashboardData.activeShift.startTime,
          departmentId: dashboardData.activeShift.departmentId,
          departmentNameAr: dashboardData.activeShift.department.nameAr,
          departmentNameEn: dashboardData.activeShift.department.nameEn,
        } : null}
        showAll={showAll}
        hasDepartment={dashboardData.hasDepartment}
      />
    </div>
  );
}
