import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { medications } from "@db/schema/pharmacy";
import { eq, and, desc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import PharmacyInventoryClient from "./PharmacyInventoryClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pharmacy" });
  return {
    title: `${t("viewInventory")} | HMS Egypt`,
  };
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;

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

  // Fetch inventory data within tenant context
  const inventory = await withTenantContext(hospital.id, async (tx) => {
    return await tx
      .select()
      .from(medications)
      .where(eq(medications.hospitalId, hospital.id))
      .orderBy(medications.nameEn);
  });

  return (
    <PharmacyInventoryClient 
      initialData={inventory}
      hospitalSlug={hospitalSlug}
      locale={locale}
    />
  );
}
