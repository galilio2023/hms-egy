import { db } from "@/lib/db";
import { hospitals, departments, staff } from "@db/schema/core";
import { eq, and, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingWizardClient } from "@/components/tables/BookingWizardClient";
import { auth } from "@/lib/auth";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "appointments" });

  const [hospital] = await db
    .select({
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
    })
    .from(hospitals)
    .where(eq(hospitals.slug, hospitalSlug))
    .limit(1);

  const hospitalName = hospital
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("newAppointment")} | ${hospitalName} | HMS Egypt`,
    description: "Clinical patient appointment booking and waiting list registration wizard.",
  };
}

export default async function NewAppointmentPage({
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
  const [dbHospital] = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
    })
    .from(hospitals)
    .where(eq(hospitals.slug, hospitalSlug))
    .limit(1);

  if (!dbHospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && session.user.hospitalId !== dbHospital.id) {
    notFound(); // Return 404 to avoid exposing that the slug exists
  }


  const hospitalId = dbHospital.id;

  // 2. Fetch active departments
  const activeDepartments = await db
    .select({
      id: departments.id,
      nameAr: departments.nameAr,
      nameEn: departments.nameEn,
    })
    .from(departments)
    .where(and(eq(departments.hospitalId, hospitalId), eq(departments.isActive, true)));

  // 3. Fetch active clinical doctors/surgeons
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

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6 text-start">
        <header className="border-b border-border/30 pb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {t("bookingWizard")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "بوابة جدولة الفحوصات والزيارات الطبية مع التحقق التلقائي المتزامن من الفترات الشاغرة للأطباء."
              : "Step-by-step patient matching, clinic schedule lookup, and diagnostic billing estimates."}
          </p>
        </header>

        <BookingWizardClient
          departments={activeDepartments}
          doctors={clinicalDoctors}
          hospitalSlug={hospitalSlug}
          locale={locale}
        />
      </div>
    </div>
  );
}
