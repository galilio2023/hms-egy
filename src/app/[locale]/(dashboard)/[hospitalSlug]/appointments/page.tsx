import { db } from "@/lib/db";
import { hospitals, departments, staff } from "@db/schema/core";
import { appointments } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { eq, and, ne, or, gte, lte, ilike, sql, desc } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { toCairoTime } from "@/lib/utils/egypt";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppointmentFilters } from "./_components/AppointmentFilters";
import { AppointmentTable } from "./_components/AppointmentTable";
import { AppointmentCalendar } from "./_components/AppointmentCalendar";
import { WaitingListSidebar } from "./_components/WaitingListSidebar";
import { AppointmentDetailsDrawer } from "./_components/AppointmentDetailsDrawer";
import { ScheduleWaitingModal } from "./_components/ScheduleWaitingModal";
import { Calendar as CalendarIcon } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "appointments" });

  const hospital = await getHospitalBySlug(hospitalSlug);

  const hospitalName = hospital
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title")} | ${hospitalName} | HMS Egypt`,
    description: "Manage clinical slots, waiting lists, and appointments schedule.",
  };
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
  searchParams: Promise<{ 
    query?: string; 
    dept?: string; 
    doctor?: string; 
    status?: string; 
    view?: string; 
    weekStart?: string;
    showWaiting?: string;
    selectedAppId?: string;
    scheduleWaitingId?: string;
  }>;
}) {
  const { locale, hospitalSlug } = await params;
  const sParams = await searchParams;
  const t = await getTranslations({ locale, namespace: "appointments" });

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

  const hospitalId = hospital.id;

  // 1. Concurrent Fetching of Shell Data
  const [activeDepartments, clinicalDoctors, appList] = await Promise.all([
    db
      .select({ id: departments.id, nameAr: departments.nameAr, nameEn: departments.nameEn })
      .from(departments)
      .where(and(eq(departments.hospitalId, hospitalId), eq(departments.isActive, true))),

    db
      .select({ id: staff.id, nameAr: staff.nameAr, nameEn: staff.nameEn })
      .from(staff)
      .where(
        and(
          eq(staff.hospitalId, hospitalId),
          eq(staff.isActive, true),
          or(eq(staff.role, "DOCTOR"), eq(staff.role, "SURGEON"))
        )
      ),

    // Fetch appointments with filters applied on server
    (() => {
      const nowCairo = toCairoTime(new Date());
      const pastWindow = new Date(Date.UTC(nowCairo.getFullYear(), nowCairo.getMonth(), nowCairo.getDate() - 7, 0, 0, 0, 0));
      const futureWindow = new Date(Date.UTC(nowCairo.getFullYear(), nowCairo.getMonth(), nowCairo.getDate() + 30, 23, 59, 59, 999));

      const conditions = [
        eq(appointments.hospitalId, hospitalId),
        gte(appointments.scheduledDate, pastWindow),
        lte(appointments.scheduledDate, futureWindow),
      ];

      if (sParams.dept) conditions.push(eq(appointments.departmentId, sParams.dept));
      if (sParams.doctor) conditions.push(eq(appointments.doctorId, sParams.doctor));
      if (sParams.status) conditions.push(eq(appointments.status, sParams.status));

      if (sParams.query) {
        const q = `%${sParams.query}%`;
        const searchCondition = or(
          ilike(patients.nameAr, q),
          ilike(patients.nameEn, q),
          ilike(patients.patientNumber, q),
          ilike(patients.contactPhone, q)
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      return db
        .select({
          id: appointments.id,
          scheduledDate: appointments.scheduledDate,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          type: appointments.type,
          notes: appointments.notes,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorId: staff.id,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          departmentId: departments.id,
          departmentNameAr: departments.nameAr,
          departmentNameEn: departments.nameEn,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(staff, eq(appointments.doctorId, staff.id))
        .innerJoin(departments, eq(appointments.departmentId, departments.id))
        .where(and(...conditions))
        .orderBy(appointments.scheduledDate, appointments.startTime)
        .limit(500);
    })()
  ]);

  const activeApp = sParams.selectedAppId 
    ? appList.find(a => a.id === sParams.selectedAppId) || null
    : null;

  const showWaiting = sParams.showWaiting === "true";
  const viewMode = sParams.view || "week";

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 lg:p-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t("title")}
        description={locale === "ar"
          ? "متابعة وإدارة مواعيد المرضى بالعيادات الخارجية وطوابير الانتظار وجداول الأطباء اليومية."
          : "Monitor and manage patient clinic slots, waiting lists, and active doctor scheduling."}
        icon={<CalendarIcon className="h-5 w-5 animate-pulse" />}
      />

      <AppointmentFilters
        departments={activeDepartments}
        doctors={clinicalDoctors}
        waitingListCount={0} // Client component will fetch actual count to keep shell fast
        hospitalSlug={hospitalSlug}
        locale={locale}
      />

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {viewMode === "list" ? (
            <div className="bg-card rounded-2xl border border-border/30 overflow-hidden shadow-xs">
              <AppointmentTable data={appList} locale={locale} />
            </div>
          ) : (
            <AppointmentCalendar appointments={appList} locale={locale} />
          )}
        </div>

        {showWaiting && (
          <WaitingListSidebar locale={locale} />
        )}
      </div>

      {/* Interactive Leaves */}
      <AppointmentDetailsDrawer
        appointment={activeApp}
        hospitalSlug={hospitalSlug}
        locale={locale}
      />

      <ScheduleWaitingModal
        doctors={clinicalDoctors}
        locale={locale}
      />
    </div>
  );
}
