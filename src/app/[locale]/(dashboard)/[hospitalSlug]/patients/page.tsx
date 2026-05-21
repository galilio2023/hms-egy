import { db } from "@/lib/db";
import { hospitals } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { searchPatientsAction } from "@/lib/actions/patients";
import { PatientDirectoryClient } from "@/components/tables/PatientDirectoryClient";
import { auth } from "@/lib/auth";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const hospital = await getHospitalBySlug(hospitalSlug);

  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title")} | ${hospitalName} | HMS Egypt`,
    description: "Search and navigate patients records inside your hospital workspace.",
  };
}

export default async function PatientsListPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Fetch hospital tenant data
  const dbHospital = await getHospitalBySlug(hospitalSlug);

  if (!dbHospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && session.user.hospitalId !== dbHospital.id) {
    notFound(); // Return 404 to avoid exposing that the slug exists
  }


  // Fetch initial list of patients (first 20) via server action to ensure correct tenant context
  const searchResult = await searchPatientsAction("");
  const initialPatients = (searchResult.success && "data" in searchResult) ? searchResult.data || [] : [];

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-border/30 pb-4 flex flex-col gap-1 text-start">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "ar" 
              ? "استعرض وابحث في السجلات والملفات الطبية الخاصة بجميع مرضى المنشأة الطبية المسجلين." 
              : "Search, filter, and access digital clinical records for all registered hospital patients."}
          </p>
        </header>

        <PatientDirectoryClient 
          initialPatients={initialPatients} 
          hospitalSlug={hospitalSlug} 
        />
      </div>
    </div>
  );
}
