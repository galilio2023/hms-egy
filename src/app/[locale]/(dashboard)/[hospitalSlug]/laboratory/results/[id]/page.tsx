import { getLabOrderDetails } from "@/lib/actions/laboratory";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import LabResultEntryClient from "./LabResultEntryClient";
import { getTranslations } from "next-intl/server";
import { Beaker } from "lucide-react";

export default async function LabResultEntryPage({
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

  // RBAC: Only lab and clinical staff can enter results
  const ALLOWED_LAB_ROLES = ["SUPER_ADMIN", "ADMIN", "LAB_TECH", "LAB_ADMIN", "DOCTOR"];
  if (!ALLOWED_LAB_ROLES.includes(session.user.role)) {
    notFound();
  }

  const res = await getLabOrderDetails(id);
  if (!res.success || !res.data) {
    notFound();
  }

  const { order, items } = res.data;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090d16] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4 text-start">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Beaker className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {t("enterResults")}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {locale === "ar" ? "طلب رقم:" : "Order #:"} <span className="font-mono font-bold text-teal-600">{order.id.slice(0, 8).toUpperCase()}</span> • {locale === "ar" ? "للمريض:" : "For Patient:"} <span className="font-bold text-slate-900 dark:text-slate-100">{locale === "ar" ? order.patientNameAr : order.patientNameEn}</span>
              </p>
            </div>
          </div>
        </header>

        <LabResultEntryClient 
          locale={locale} 
          hospitalSlug={hospitalSlug} 
          order={order} 
          items={items} 
        />
      </div>
    </div>
  );
}
