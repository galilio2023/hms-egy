import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HospitalSettingsForm } from "@/components/forms/HospitalSettingsForm";
import { type PlanTier } from "@/types/plans.types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  
  // Fetch name for SEO page title
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
    title: `${t("title")} | ${hospitalName} | HMS Egypt`,
    description: "Manage hospital general settings, payments credentials, surgical configs, and housekeeping rules.",
  };
}

export default async function HospitalSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  // Fetch hospital tenant data with leftJoin settings
  const [dbHospital] = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
      slug: hospitals.slug,
      contactEmail: hospitals.contactEmail,
      contactPhone: hospitals.contactPhone,
      address: hospitals.address,
      governorate: hospitals.governorate,
      type: hospitals.type,
      planTier: hospitals.planTier,
      // Settings fields
      isSurgicalEnabled: hospitalSettings.isSurgicalEnabled,
      isTelemedicineEnabled: hospitalSettings.isTelemedicineEnabled,
      isPatientPortalEnabled: hospitalSettings.isPatientPortalEnabled,
      isOnlinePaymentsEnabled: hospitalSettings.isOnlinePaymentsEnabled,
      paymobApiKey: hospitalSettings.paymobApiKey,
      paymobCardId: hospitalSettings.paymobCardId,
      paymobWalletId: hospitalSettings.paymobWalletId,
      paymobFawryId: hospitalSettings.paymobFawryId,
      paymobHmacSecret: hospitalSettings.paymobHmacSecret,
      orCleaningDuration: hospitalSettings.orCleaningDuration,
      autoHousekeeping: hospitalSettings.autoHousekeeping,
    })
    .from(hospitals)
    .leftJoin(hospitalSettings, eq(hospitals.id, hospitalSettings.hospitalId))
    .where(eq(hospitals.slug, hospitalSlug))
    .limit(1);

  if (!dbHospital) {
    notFound();
  }

  // Graceful fallback for values in case they are null
  const initialValues = {
    nameAr: dbHospital.nameAr,
    nameEn: dbHospital.nameEn,
    contactPhone: dbHospital.contactPhone,
    address: dbHospital.address,
    governorate: dbHospital.governorate,
    isSurgicalEnabled: dbHospital.isSurgicalEnabled ?? false,
    isTelemedicineEnabled: dbHospital.isTelemedicineEnabled ?? false,
    isPatientPortalEnabled: dbHospital.isPatientPortalEnabled ?? false,
    isOnlinePaymentsEnabled: dbHospital.isOnlinePaymentsEnabled ?? false,
    paymobApiKey: dbHospital.paymobApiKey ? "••••••••" : "",
    paymobCardId: dbHospital.paymobCardId || "",
    paymobWalletId: dbHospital.paymobWalletId || "",
    paymobFawryId: dbHospital.paymobFawryId || "",
    paymobHmacSecret: dbHospital.paymobHmacSecret ? "••••••••" : "",
    orCleaningDuration: dbHospital.orCleaningDuration ?? 30,
    autoHousekeeping: dbHospital.autoHousekeeping ?? true,
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100/80 shadow-sm p-6 sm:p-8">
        <header className="mb-6 border-b border-gray-100 pb-4">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {locale === "ar" 
              ? "تهيئة وتعديل إعدادات المستشفى الحالية، وربط البوابات المالية، وإدارة التنبيهات ووحدة الجراحة." 
              : "Configure and update hospital settings, link financial payments, manage surgical rules and reminders."}
          </p>
        </header>

        <HospitalSettingsForm
          hospitalId={dbHospital.id}
          slug={dbHospital.slug}
          planTier={dbHospital.planTier as PlanTier}
          initialValues={initialValues}
          locale={locale}
        />
      </div>
    </div>
  );
}
