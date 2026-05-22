import { db } from "@/lib/db";
import { hospitals, departments, staff } from "@db/schema/core";
import { appointments } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { eq, and, ne, or, gte, lte } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { toCairoTime } from "@/lib/utils/egypt";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppointmentSchedulerClient } from "@/components/tables/AppointmentSchedulerClient";
import { auth } from "@/lib/auth";


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
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "appointments" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // 1. Fetch hospital tenant data
  const dbHospital = await getHospitalBySlug(hospitalSlug);

  if (!dbHospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  
  // Allow matching against either the UUID ID or the Slug (useful for mock/dev sessions)
  const isAuthorized = isSuperAdmin || 
                       currentHospitalId === dbHospital.id || 
                       currentHospitalId === dbHospital.slug;

  if (!isAuthorized) {
    notFound(); // Return 404 to avoid exposing that the slug exists
  }


  const hospitalId = dbHospital.id;

  // 2. Fetch active departments for filters
  const activeDepartments = await db
    .select({
      id: departments.id,
      nameAr: departments.nameAr,
      nameEn: departments.nameEn,
    })
    .from(departments)
    .where(and(eq(departments.hospitalId, hospitalId), eq(departments.isActive, true)));

  // 3. Fetch active clinical doctors/surgeons for filters
  const clinicalDoctors = await db
    .select({
      id: staff.id,
      nameAr: staff.nameAr,
      nameEn: staff.nameEn,
    })
    .from(staff)
    .where(
      and(
        eq(staff.hospitalId, hospitalId),
        eq(staff.isActive, true),
        or(eq(staff.role, "DOCTOR"), eq(staff.role, "SURGEON"))
      )
    );

  const nowCairo = toCairoTime(new Date());
  const pastWindow = new Date(Date.UTC(nowCairo.getFullYear(), nowCairo.getMonth(), nowCairo.getDate() - 7, 0, 0, 0, 0));
  const futureWindow = new Date(Date.UTC(nowCairo.getFullYear(), nowCairo.getMonth(), nowCairo.getDate() + 14, 23, 59, 59, 999));

  // 4. Fetch initial list of all active/scheduled/completed appointments
  const appList = await db
    .select({
      id: appointments.id,
      scheduledDate: appointments.scheduledDate,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      type: appointments.type,
      notes: appointments.notes,
      cancellationReason: appointments.cancellationReason,
      patientId: patients.id,
      patientNameAr: patients.nameAr,
      patientNameEn: patients.nameEn,
      patientNumber: patients.patientNumber,
      patientPhone: patients.contactPhone,
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
    .where(
      and(
        eq(appointments.hospitalId, hospitalId),
        gte(appointments.scheduledDate, pastWindow),
        lte(appointments.scheduledDate, futureWindow)
      )
    )
    .orderBy(appointments.scheduledDate, appointments.startTime)
    .limit(500);

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-border/30 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "متابعة وإدارة مواعيد المرضى بالعيادات الخارجية وطوابير الانتظار وجداول الأطباء اليومية."
                : "Monitor and manage patient clinic slots, waiting lists, and active doctor scheduling."}
            </p>
          </div>
        </header>

        <AppointmentSchedulerClient
          initialAppointments={appList}
          departments={activeDepartments}
          doctors={clinicalDoctors}
          hospitalSlug={hospitalSlug}
          locale={locale}
        />
      </div>
    </div>
  );
}
