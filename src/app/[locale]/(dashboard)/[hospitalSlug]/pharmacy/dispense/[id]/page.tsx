import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrescriptionForDispensing } from "@/lib/actions/pharmacy";
import { getTranslations } from "next-intl/server";
import DispensePrescriptionClient from "./DispensePrescriptionClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "pharmacy" });
  return {
    title: `${t("dispense")} #${id.slice(0, 8)} | HMS Egypt`,
  };
}

export default async function PrescriptionDispensePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { locale, hospitalSlug, id } = await params;

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Page-level RBAC
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "PHARMACIST"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    notFound();
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== hospital.id) {
    notFound();
  }

  const res = await getPrescriptionForDispensing(id);
  if (!res.success || !("data" in res) || !res.data) {
    notFound();
  }

  const prescription = (res as any).data;

  return (
    <DispensePrescriptionClient 
      prescription={prescription}
      hospitalSlug={hospitalSlug}
      locale={locale}
    />
  );
}
