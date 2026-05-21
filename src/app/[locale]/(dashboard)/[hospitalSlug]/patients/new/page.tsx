import { db } from "@/lib/db";
import { hospitals } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PatientRegistrationWizard } from "@/components/forms/PatientRegistrationWizard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });
  
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
    title: `${t("newPatient")} | ${hospitalName} | HMS Egypt`,
    description: "Register a new patient into the hospital clinical directory with full legal compliance and data validation.",
  };
}

export default async function NewPatientPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });
  const session = await auth();

  // Fetch hospital tenant data
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

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="border-b border-border/30 pb-4 flex flex-col gap-1 text-start">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {t("newPatient")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "ar" 
              ? "تسجيل مريض جديد وتثبيت إقرارات الرعاية الطبية، مع التحقق الفوري من هوية المريض ونظام التأمين الشامل." 
              : "Onboard new patients, sign consents, parse NID cards and verify statutory insurance rollout eligibility."}
          </p>
        </header>

        <PatientRegistrationWizard 
          hospitalSlug={hospitalSlug} 
          currentUserName={session?.user?.name || undefined}
        />
      </div>
    </div>
  );
}
