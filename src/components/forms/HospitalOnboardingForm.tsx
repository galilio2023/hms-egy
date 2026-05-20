"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";
import { setupHospital } from "@/lib/actions/onboarding";
import { useRouter } from "@/i18n/routing";
import { GOVERNORATES } from "@/lib/utils/egypt";

export function HospitalOnboardingForm() {
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
        router.push("/login"); // Redirect to login after setup
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
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Hospital Information / معلومات المستشفى</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Arabic Name / الاسم بالعربية</label>
            <input
              {...register("nameAr")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="مستشفى الأمل"
            />
            {errors.nameAr && <p className="text-red-500 text-xs">{errors.nameAr.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">English Name / الاسم بالإنجليزية</label>
            <input
              {...register("nameEn")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Al-Amal Hospital"
            />
            {errors.nameEn && <p className="text-red-500 text-xs">{errors.nameEn.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">URL Slug / الرابط التعريفي</label>
          <input
            {...register("slug")}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="al-amal-hosp"
          />
          {errors.slug && <p className="text-red-500 text-xs">{errors.slug.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Contact Email / البريد للتواصل</label>
            <input
              {...register("contactEmail")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.contactEmail && <p className="text-red-500 text-xs">{errors.contactEmail.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Phone / رقم الهاتف</label>
            <input
              {...register("contactPhone")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="01xxxxxxxxx"
            />
            {errors.contactPhone && <p className="text-red-500 text-xs">{errors.contactPhone.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Address / العنوان</label>
          <input
            {...register("address")}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="123 Nile St, Cairo, Egypt"
          />
          {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Governorate / المحافظة</label>
            <select
              {...register("governorate")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Select Governorate</option>
              {Object.values(GOVERNORATES).map((gov) => (
                <option key={gov.code} value={gov.code}>
                  {gov.en} ({gov.ar})
                </option>
              ))}
            </select>
            {errors.governorate && <p className="text-red-500 text-xs">{errors.governorate.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Hospital Type / نوع المستشفى</label>
            <select
              {...register("type")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="private">Private (خاص)</option>
              <option value="government">Government (حكومي)</option>
              <option value="military">Military (عسكري)</option>
              <option value="ngo">NGO (جمعية خيرية)</option>
            </select>
            {errors.type && <p className="text-red-500 text-xs">{errors.type.message}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Enabled Modules / تفعيل الوحدات</h2>
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
        <h2 className="text-2xl font-bold text-blue-900 border-b pb-2">Admin Account / حساب المسؤول</h2>
        <div className="space-y-3">
          <input
            {...register("adminName")}
            placeholder="Admin Full Name"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {errors.adminName && <p className="text-red-500 text-xs">{errors.adminName.message}</p>}
          <input
            {...register("adminEmail")}
            type="email"
            placeholder="Admin Email"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {errors.adminEmail && <p className="text-red-500 text-xs">{errors.adminEmail.message}</p>}
          <input
            {...register("adminPassword")}
            type="password"
            placeholder="Admin Password"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {errors.adminPassword && <p className="text-red-500 text-xs">{errors.adminPassword.message}</p>}
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-200"
      >
        {isSubmitting ? "Processing..." : "Complete Setup / إتمام الإعداد"}
      </button>
    </form>
  );
}
