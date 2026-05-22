import { withTenantContext } from "@/lib/db/tenant";
import { patients } from "@db/schema/patients";
import { and, eq } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MedicalRecordForm } from "@/components/forms/MedicalRecordForm";
import { auth } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) return { title: "New Medical Record" };

  const patientName = await withTenantContext(hospital.id, async (tx) => {
    const [patient] = await tx
      .select({
        nameAr: patients.nameAr,
        nameEn: patients.nameEn,
      })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);
    return patient ? (locale === "ar" ? patient.nameAr : patient.nameEn) : null;
  });

  const hospitalName = locale === "ar" ? hospital.nameAr : hospital.nameEn;

  return {
    title: `${t("recordNewVisit")} - ${patientName || ""} | ${hospitalName} | HMS Egypt`,
    description: `Record clinical outpatient, inpatient, or emergency encounter notes and vital signs for ${patientName || "patient"}.`,
  };
}

export default async function NewMedicalRecordPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;

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
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== dbHospital.id) {
    notFound();
  }

  const hospitalId = dbHospital.id;

  // Retrieve patient details in tenant isolation context
  const patient = await withTenantContext(hospitalId, async (tx) => {
    const [p] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.hospitalId, hospitalId)))
      .limit(1);
    return p;
  });

  if (!patient) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <MedicalRecordForm patient={patient} hospitalSlug={hospitalSlug} />
      </div>
    </div>
  );
}
