import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getRadiologyQueueAction } from "@/lib/actions/radiology";
import { RadiologyQueueClient } from "@/components/tables/RadiologyQueueClient";
import { auth } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const hospital = await getHospitalBySlug(hospitalSlug);

  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${locale === "ar" ? "لوحة تحكم قسم الأشعة" : "Radiology Department"} | ${hospitalName} | HMS Egypt`,
    description: "Manage radiology queue, scan records, diagnostic reports, and critical value alerts.",
  };
}

export default async function RadiologyPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;

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
    notFound(); // Return 404 to avoid exposing that the slug exists
  }

  // Fetch all orders in the queue
  const queueResult = await getRadiologyQueueAction("all");
  const orders = queueResult.success && queueResult.data ? queueResult.data : [];

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-border/30 pb-4 flex flex-col gap-1 text-start">
          <h1 className="text-2xl font-black tracking-tight text-foreground" id="radiology-dashboard-title">
            {locale === "ar" ? "لوحة تحكم قسم الأشعة" : "Radiology Department Dashboard"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "ar" 
              ? "إدارة طلبات الأشعة، تدوين تقارير التشخيص، ومتابعة الفحوصات العاجلة والحرجة للمرضى." 
              : "Manage scan requests, draft diagnostic reports, and monitor critical alert flags."}
          </p>
        </header>

        <RadiologyQueueClient 
          orders={orders} 
          hospitalSlug={hospitalSlug} 
        />
      </div>
    </div>
  );
}
