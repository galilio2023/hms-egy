import { db } from "@/lib/db";
import { hospitals, departments, staff, operatingRooms } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { eq, and, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SurgicalScheduleClient } from "@/components/tables/SurgicalScheduleClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "navigation" });

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
    title: `${t("orSchedule")} | ${hospitalName} | HMS Egypt`,
    description: "Operating Room visual timeline, blocked schedules, and surgical scheduling.",
  };
}

export default async function SurgicalSchedulePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;

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

  const hospitalId = dbHospital.id;

  // 2. Fetch active surgeons
  const surgeons = await db
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

  // 3. Fetch active anesthesiologists
  const anesthesiologists = await db
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
        eq(staff.role, "ANESTHESIOLOGIST")
      )
    );

  // 4. Fetch registered patients (limit to 50 for quick autocomplete start)
  const patientList = await db
    .select({
      id: patients.id,
      nameAr: patients.nameAr,
      nameEn: patients.nameEn,
      patientNumber: patients.patientNumber,
    })
    .from(patients)
    .where(eq(patients.hospitalId, hospitalId))
    .limit(50);

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6 text-start">
        <header className="border-b border-border/30 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {locale === "ar" ? "مخطط جدول العمليات الجراحية" : "Operating Room Schedule Board"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "لوحة التتبع والتحكم اللحظي في أجنحة غرف العمليات والكتل المحجوزة والجدولة الطارئة المستثناة."
                : "Real-time timeline tracking across operating theaters, surgical blocks, and emergency procedures."}
            </p>
          </div>
        </header>

        <SurgicalScheduleClient
          surgeons={surgeons}
          anesthesiologists={anesthesiologists}
          patients={patientList}
          hospitalSlug={hospitalSlug}
          locale={locale}
        />
      </div>
    </div>
  );
}
