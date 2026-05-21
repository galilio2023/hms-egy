"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";
import { setupHospital } from "@/lib/actions/onboarding";
import { useRouter } from "@/i18n/routing";
import { GOVERNORATES } from "@/lib/utils/egypt";

export function HospitalOnboardingForm() {
  const t = useTranslations("onboarding");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HospitalOnboarding>({
    resolver: zodResolver(hospitalOnboardingSchema),
    defaultValues: {
      modules: {
        surgical: false,
        telemedicine: false,
        portal: false,
        payments: false,
      },
    },
  });

  const onSubmit = async (data: HospitalOnboarding) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await setupHospital(data);
      if (result.success) {
        // Redirect directly to the newly created hospital dashboard to eliminate post-onboarding friction
        router.push(`/${data.slug}`);
      } else {
        setError(result.error || "Setup failed");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">{t("title")}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("nameAr")}</label>
            <input
              {...register("nameAr")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
              placeholder={t("placeholders.nameAr")}
            />
            {errors.nameAr && <p className="text-red-500 text-xs">{errors.nameAr.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("nameEn")}</label>
            <input
              {...register("nameEn")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
              placeholder={t("placeholders.nameEn")}
            />
            {errors.nameEn && <p className="text-red-500 text-xs">{errors.nameEn.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{t("slug")}</label>
          <input
            {...register("slug")}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            placeholder={t("placeholders.slug")}
          />
          {errors.slug && <p className="text-red-500 text-xs">{errors.slug.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("contactEmail")}</label>
            <input
              {...register("contactEmail")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            />
            {errors.contactEmail && <p className="text-red-500 text-xs">{errors.contactEmail.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("contactPhone")}</label>
            <input
              {...register("contactPhone")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
              placeholder={t("placeholders.phone")}
            />
            {errors.contactPhone && <p className="text-red-500 text-xs">{errors.contactPhone.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{t("address")}</label>
          <input
            {...register("address")}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            placeholder={t("placeholders.address")}
          />
          {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("governorate")}</label>
            <select
              {...register("governorate")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            >
              <option value="">{t("placeholders.selectGov")}</option>
              {Object.values(GOVERNORATES).map((gov) => (
                <option key={gov.code} value={gov.code}>
                  {gov.en} ({gov.ar})
                </option>
              ))}
            </select>
            {errors.governorate && <p className="text-red-500 text-xs">{errors.governorate.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("type")}</label>
            <select
              {...register("type")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            >
              {(["private", "government", "military", "ngo"] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-red-500 text-xs">{errors.type.message}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">{t("modulesTitle")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {["surgical", "telemedicine", "portal", "payments"].map((module) => (
            <label key={module} className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition">
              <input
                type="checkbox"
                {...register(`modules.${module as "surgical" | "telemedicine" | "portal" | "payments"}`)}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="capitalize font-medium">{module}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">{t("adminTitle")}</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <input
              {...register("adminName")}
              placeholder={t("adminName")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            />
            {errors.adminName && <p className="text-red-500 text-xs">{errors.adminName.message}</p>}
          </div>
          <div className="space-y-1">
            <input
              {...register("adminEmail")}
              type="email"
              placeholder={t("adminEmail")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            />
            {errors.adminEmail && <p className="text-red-500 text-xs">{errors.adminEmail.message}</p>}
          </div>
          <div className="space-y-1">
            <input
              {...register("adminPassword")}
              type="password"
              placeholder={t("adminPassword")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-start"
            />
            {errors.adminPassword && <p className="text-red-500 text-xs">{errors.adminPassword.message}</p>}
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-200"
      >
        {isSubmitting ? t("processing") : t("submit")}
      </button>
    </form>
  );
}
