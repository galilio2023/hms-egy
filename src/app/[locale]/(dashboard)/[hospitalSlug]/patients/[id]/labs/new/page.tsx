import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { patients } from "@db/schema/patients";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { LabOrderForm } from "@/components/forms/LabOrderForm";
import { getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";

export default async function NewLabOrderPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "laboratory" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  // RBAC: Only clinical staff can order labs
  const ALLOWED_PRESCRIBERS = ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON"];
  if (!ALLOWED_PRESCRIBERS.includes(session.user.role)) {
    notFound();
  }

  const patient = await withTenantContext(hospital.id, async (tx) => {
    return await tx
      .select({
        id: patients.id,
        nameAr: patients.nameAr,
        nameEn: patients.nameEn,
        patientNumber: patients.patientNumber,
      })
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.hospitalId, hospital.id)))
      .limit(1)
      .then((res) => res[0]);
  });

  if (!patient) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {t("orderLabs") || (locale === "ar" ? "طلب فحوصات مخبرية" : "New Laboratory Order")}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {locale === "ar" ? "للمريض:" : "For Patient:"} <span className="font-bold text-slate-900 dark:text-slate-100">{locale === "ar" ? patient.nameAr : patient.nameEn}</span> ({patient.patientNumber})
              </p>
            </div>
          </div>
        </header>

        <LabOrderForm patientId={id} />
      </div>
    </div>
  );
}
