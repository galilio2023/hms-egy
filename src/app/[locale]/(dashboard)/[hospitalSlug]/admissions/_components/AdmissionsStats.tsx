import React from "react";
import { getTranslations } from "next-intl/server";
import { Bed, UserCheck, Check, Clock, Gauge } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";

interface AdmissionsStatsProps {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  pendingCleaningBeds: number;
  locale: string;
}

export async function AdmissionsStats({
  totalBeds,
  occupiedBeds,
  availableBeds,
  pendingCleaningBeds,
  locale,
}: AdmissionsStatsProps) {
  const t = await getTranslations({ locale, namespace: "admissions" });
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        label={t("totalBeds")}
        value={totalBeds}
        icon={<Bed className="h-6 w-6" />}
        iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
      />

      <StatCard
        label={t("occupiedBeds")}
        value={occupiedBeds}
        icon={<UserCheck className="h-6 w-6" />}
        iconClassName="bg-blue-500/10 text-blue-500 dark:text-blue-400"
      />

      <StatCard
        label={t("availableBeds")}
        value={availableBeds}
        icon={<Check className="h-6 w-6" />}
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      />

      <StatCard
        label={t("pendingCleaning")}
        value={pendingCleaningBeds}
        icon={<Clock className="h-6 w-6 animate-spin-slow" />}
        iconClassName="bg-amber-500/10 text-amber-500"
        description={t("bedsPendingCleaning")}
      />

      <StatCard
        label={t("occupancyRate")}
        value={`${occupancyRate}%`}
        icon={<Gauge className="h-6 w-6" />}
        iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        className="col-span-2 lg:col-span-1"
        description={t("liveOccupancyDescription")}
      />
    </section>
  );
}
