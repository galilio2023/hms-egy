import { getPatientById } from "@/lib/actions/patients";
import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PrescriptionWriter } from "@/components/forms/PrescriptionWriter";
import { PageShell } from "@/components/layout/PageShell";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pharmacy" });
  return {
    title: `${t("dispenseMedication")} | HMS Egypt`,
  };
}

export default async function PrescribePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { locale, hospitalSlug, id } = await params;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  const patientRes = await getPatientById(id);
  if (!patientRes.success || !patientRes.data) {
    notFound();
  }

  const patient = patientRes.data;

  return (
    <PageShell
      title={locale === "ar" ? "إصدار وصفة طبية" : "Issue Prescription"}
      subtitle={locale === "ar" ? `للمريض: ${patient.nameAr}` : `For Patient: ${patient.nameEn}`}
      backLink={`/${hospitalSlug}/patients/${id}`}
    >
      <PrescriptionWriter 
        patientId={id} 
        onSuccess={(rxId) => {
          // Redirect to patient profile after success
          // Note: In client component PrescriptionWriter, this will happen
        }}
      />
    </PageShell>
  );
}
