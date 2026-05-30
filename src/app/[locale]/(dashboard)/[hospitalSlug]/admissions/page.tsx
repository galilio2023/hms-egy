import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { rooms, beds, admissions, vitalsFlowsheet } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdmissionsStats } from "./_components/AdmissionsStats";
import { BedMap } from "./_components/BedMap";
import { AdmitPatientModal } from "./_components/AdmitPatientModal";
import { PatientDrawer } from "./_components/PatientDrawer";
import { AdmitPatientButton } from "./_components/AdmitPatientButton";
import { RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  searchParams,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
  searchParams: Promise<{ admitBedId?: string; selectedBedId?: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const { admitBedId, selectedBedId } = await searchParams;
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
    // Execute all independent dashboard queries concurrently
    const [
      roomsList,
      bedsWithAdmissions,
      doctorsList,
      housekeepingRes,
      recentVitals
    ] = await Promise.all([
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

      tx
        .select({
          id: staff.id,
          nameAr: staff.nameAr,
          nameEn: staff.nameEn,
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
        .where(
          and(
            eq(vitalsFlowsheet.hospitalId, hospital.id),
            sql`${vitalsFlowsheet.recordedAt} > now() - interval '48 hours'`
          )
        )
        .orderBy(desc(vitalsFlowsheet.recordedAt))
    ]);

    return {
      roomsList,
      bedsWithAdmissions,
      recentVitals,
      doctorsList,
      pendingCleaningCount: housekeepingRes?.count || 0,
    };
  });

  // Data processing for the BedMap
  const roomsWithBedsMap = dashboardData.roomsList.map((room) => ({
    ...room,
    beds: dashboardData.bedsWithAdmissions.filter((b) => b.roomId === room.id),
  }));

  // Stats computation
  const totalBeds = dashboardData.bedsWithAdmissions.length;
  const occupiedBeds = dashboardData.bedsWithAdmissions.filter((b) => b.status === "occupied").length;
  const availableBeds = dashboardData.bedsWithAdmissions.filter((b) => b.status === "available").length;
  const pendingCleaningBeds = dashboardData.pendingCleaningCount;

  // Selected bed for the drawer
  const activeBed = selectedBedId 
    ? dashboardData.bedsWithAdmissions.find(b => b.bedId === selectedBedId) || null
    : null;
  
  const patientVitals = activeBed?.patientId 
    ? dashboardData.recentVitals.filter(v => v.patientId === activeBed.patientId)
    : [];

  // Available beds for the modal dropdown
  const bedsForModal = dashboardData.bedsWithAdmissions
    .filter(b => b.status === "available")
    .map(b => ({
      bedId: b.bedId,
      bedNumber: b.bedNumber,
      roomNumber: b.roomNumber,
      roomType: b.roomType
    }));

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 lg:p-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t("title")}
        description={locale === "ar" 
          ? "متابعة السعة الاستيعابية الحالية للقسم الداخلي، ومراقبة حالة إشغال الأسرة، والتدفق الفوري للمؤشرات الحيوية لمرضى المنشأة." 
          : "Track live inpatient capacity, manage floor bed maps, schedule new admissions, and audit patient flowsheet trends."}
        icon={<Layers className="h-5 w-5 animate-pulse" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-border bg-card hover:bg-muted text-foreground shadow-sm gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              {locale === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <AdmitPatientButton label={t("admitPatient")} />
          </div>
        }
      />

      <AdmissionsStats
        totalBeds={totalBeds}
        occupiedBeds={occupiedBeds}
        availableBeds={availableBeds}
        pendingCleaningBeds={pendingCleaningBeds}
        locale={locale}
      />

      <BedMap 
        roomsWithBeds={roomsWithBedsMap} 
        locale={locale} 
      />

      {/* Interactive Leaves */}
      <AdmitPatientModal 
        doctors={dashboardData.doctorsList} 
        availableBeds={bedsForModal}
        locale={locale}
      />

      <PatientDrawer
        bed={activeBed}
        vitalsHistory={patientVitals}
        locale={locale}
      />
    </div>
  );
}
