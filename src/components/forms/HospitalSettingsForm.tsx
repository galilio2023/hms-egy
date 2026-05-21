"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { hospitalSettingsSchema, type HospitalSettingsType } from "@/lib/validations/hospital.schema";
import { updateHospitalSettings } from "@/lib/actions/settings";
import { GOVERNORATES } from "@/lib/utils/egypt";
import { hasPlanModuleAccess } from "@/lib/utils/plans";
import { type PlanTier } from "@/types/plans.types";
import { 
  Building2, 
  Settings, 
  CreditCard, 
  Sliders, 
  AlertTriangle,
  Info
} from "lucide-react";
import { toast } from "sonner";

interface HospitalSettingsFormProps {
  hospitalId: string;
  slug: string;
  planTier: PlanTier;
  initialValues: {
    nameAr: string;
    nameEn: string;
    contactPhone: string;
    address: string;
    governorate: string;
    isSurgicalEnabled: boolean;
    isTelemedicineEnabled: boolean;
    isPatientPortalEnabled: boolean;
    isOnlinePaymentsEnabled: boolean;
    paymobApiKey: string | null;
    paymobCardId: string | null;
    paymobWalletId: string | null;
    paymobFawryId: string | null;
    paymobHmacSecret: string | null;
    orCleaningDuration: number;
    autoHousekeeping: boolean;
  };
  locale: string;
}

export function HospitalSettingsForm({
  hospitalId,
  slug,
  planTier,
  initialValues,
  locale,
}: HospitalSettingsFormProps) {
  const t = useTranslations("settings");
  const tOnboarding = useTranslations("onboarding");
  
  const [activeTab, setActiveTab] = useState<"general" | "modules" | "payments" | "clinical">("general");
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<HospitalSettingsType>({
    resolver: zodResolver(hospitalSettingsSchema),
    defaultValues: {
      nameAr: initialValues.nameAr,
      nameEn: initialValues.nameEn,
      contactPhone: initialValues.contactPhone,
      address: initialValues.address,
      governorate: initialValues.governorate,
      isSurgicalEnabled: initialValues.isSurgicalEnabled,
      isTelemedicineEnabled: initialValues.isTelemedicineEnabled,
      isPatientPortalEnabled: initialValues.isPatientPortalEnabled,
      isOnlinePaymentsEnabled: initialValues.isOnlinePaymentsEnabled,
      paymobApiKey: initialValues.paymobApiKey || "",
      paymobCardId: initialValues.paymobCardId || "",
      paymobWalletId: initialValues.paymobWalletId || "",
      paymobFawryId: initialValues.paymobFawryId || "",
      paymobHmacSecret: initialValues.paymobHmacSecret || "",
      orCleaningDuration: initialValues.orCleaningDuration,
      autoHousekeeping: initialValues.autoHousekeeping,
    },
  });

  // Watch variables for dynamic conditional UI rendering
  const watchedOnlinePayments = watch("isOnlinePaymentsEnabled");

  // Validate plan rules for module toggles
  const isSurgicalAllowed = hasPlanModuleAccess(planTier, "surgical");
  const isPaymentsAllowed = hasPlanModuleAccess(planTier, "payments");
  const isTelemedicineAllowed = hasPlanModuleAccess(planTier, "telemedicine");
  const isPortalAllowed = hasPlanModuleAccess(planTier, "portal");

  const onSubmit = async (data: HospitalSettingsType) => {
    startTransition(async () => {
      // Validate again under subscription limitations (safeguard)
      if (data.isSurgicalEnabled && !isSurgicalAllowed) {
        toast.error(locale === "ar" ? "وحدة العمليات غير مسموح بها في باقتك الحالية." : "Surgical Module is restricted under your current plan.");
        return;
      }
      if (data.isOnlinePaymentsEnabled && !isPaymentsAllowed) {
        toast.error(locale === "ar" ? "بوابة الدفع الإلكتروني غير مسموح بها في باقتك الحالية." : "Online Payments is restricted under your current plan.");
        return;
      }

      const result = await updateHospitalSettings(hospitalId, slug, data);
      
      if (result.success) {
        toast.success(t("success"));
      } else {
        toast.error(result.error || t("error"));
      }
    });
  };

  const planBadgeColor = 
    planTier === "starter" ? "bg-gray-100 text-gray-800 border-gray-200" :
    planTier === "professional" ? "bg-blue-100 text-blue-800 border-blue-200" :
    "bg-purple-100 text-purple-800 border-purple-200";

  const planName = 
    planTier === "starter" ? (locale === "ar" ? "الباقة الأساسية" : "Starter Plan") :
    planTier === "professional" ? (locale === "ar" ? "الباقة الاحترافية" : "Professional Plan") :
    (locale === "ar" ? "باقة المؤسسات الكبرى" : "Enterprise Plan");

  return (
    <div className="space-y-6">
      {/* Plan Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 rounded-2xl border border-blue-100/50 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {locale === "ar" ? initialValues.nameAr : initialValues.nameEn}
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">/{slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase">{locale === "ar" ? "الباقة الحالية:" : "Active Subscription:"}</span>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border ${planBadgeColor}`}>
            {planName}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-100 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition duration-200 outline-none ${
            activeTab === "general"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>{t("generalInfo")}</span>
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition duration-200 outline-none ${
            activeTab === "modules"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{t("moduleConfig")}</span>
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition duration-200 outline-none ${
            activeTab === "payments"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>{t("paymobConfig")}</span>
        </button>
        <button
          onClick={() => setActiveTab("clinical")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition duration-200 outline-none ${
            activeTab === "clinical"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>{locale === "ar" ? "العمليات والخدمات المعاونة" : "OR & Housekeeping"}</span>
        </button>
      </div>

      {/* Forms Panels */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Tab 1: General Info */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span>{t("generalInfo")}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 text-start">{tOnboarding("nameAr")}</label>
                <input
                  {...register("nameAr")}
                  className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                  placeholder={tOnboarding("placeholders.nameAr")}
                />
                {errors.nameAr && <p className="text-red-500 text-xs text-start">{errors.nameAr.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 text-start">{tOnboarding("nameEn")}</label>
                <input
                  {...register("nameEn")}
                  className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                  placeholder={tOnboarding("placeholders.nameEn")}
                />
                {errors.nameEn && <p className="text-red-500 text-xs text-start">{errors.nameEn.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 text-start">{tOnboarding("contactPhone")}</label>
                <input
                  {...register("contactPhone")}
                  className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                  placeholder={tOnboarding("placeholders.phone")}
                />
                {errors.contactPhone && <p className="text-red-500 text-xs text-start">{errors.contactPhone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 text-start">{tOnboarding("governorate")}</label>
                <select
                  {...register("governorate")}
                  className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-white text-start"
                >
                  <option value="">{tOnboarding("placeholders.selectGov")}</option>
                  {Object.values(GOVERNORATES).map((gov) => (
                    <option key={gov.code} value={gov.code}>
                      {locale === "ar" ? gov.ar : gov.en}
                    </option>
                  ))}
                </select>
                {errors.governorate && <p className="text-red-500 text-xs text-start">{errors.governorate.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 text-start">{tOnboarding("address")}</label>
              <textarea
                {...register("address")}
                rows={3}
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                placeholder={tOnboarding("placeholders.address")}
              />
              {errors.address && <p className="text-red-500 text-xs text-start">{errors.address.message}</p>}
            </div>
          </div>
        )}

        {/* Tab 2: Module Activation & Subscription Restrictions */}
        {activeTab === "modules" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <span>{t("moduleConfig")}</span>
            </h3>

            {/* General Plan Limit Message */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs md:text-sm text-amber-800 text-start">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{locale === "ar" ? "تنبيه قيود الاشتراك:" : "Subscription Limit Notice:"}</span>
                <span className="ms-1">
                  {locale === "ar" 
                    ? `أنت حالياً على الباقة (${planName}). يرجى ترقية باقتك من لوحة الإدارة العامة لإتاحة المزيد من الوحدات الحصرية.` 
                    : `You are currently on the (${planName}). Upgrade your subscription to allow locked medical modules.`}
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {/* Module 1: Patient Portal */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-1 text-start">
                  <span className="font-bold text-gray-900 block">{locale === "ar" ? "بوابة المرضى الإلكترونية" : "Patient Portal"}</span>
                  <span className="text-xs text-gray-500 block">
                    {locale === "ar" ? "تمكين المرضى من حجز المواعيد ورؤية السجلات الطبية والتحاليل." : "Allow patients to book clinic times and view diagnostic results online."}
                  </span>
                </div>
                <div>
                  <input
                    type="checkbox"
                    disabled={!isPortalAllowed}
                    {...register("isPatientPortalEnabled")}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isPortalAllowed && (
                    <span className="block text-[10px] text-red-500 font-bold mt-1 text-center">{locale === "ar" ? "غير مدعوم" : "Locked"}</span>
                  )}
                </div>
              </div>

              {/* Module 2: Telemedicine */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-1 text-start">
                  <span className="font-bold text-gray-900 block">{locale === "ar" ? "الاستشارات الطبية عن بعد" : "Telemedicine Consultation"}</span>
                  <span className="text-xs text-gray-500 block">
                    {locale === "ar" ? "تفعيل غرف المحادثات الطبية والمكالمات المرئية الحية مع الأطباء." : "Enable virtual visual clinic sessions and chat lines with specialized doctors."}
                  </span>
                </div>
                <div>
                  <input
                    type="checkbox"
                    disabled={!isTelemedicineAllowed}
                    {...register("isTelemedicineEnabled")}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isTelemedicineAllowed && (
                    <span className="block text-[10px] text-red-500 font-bold mt-1 text-center">{locale === "ar" ? "غير مدعوم" : "Locked"}</span>
                  )}
                </div>
              </div>

              {/* Module 3: Online Payments (Paymob) */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-1 text-start">
                  <span className="font-bold text-gray-900 block">{locale === "ar" ? "بوابة الدفع الإلكتروني (Paymob)" : "Online Payments Gateway"}</span>
                  <span className="text-xs text-gray-500 block">
                    {locale === "ar" ? "السماح بالمدفوعات الإلكترونية عبر كروت الائتمان، فودافون كاش، وفوري." : "Support credit cards, Fawry, and mobile wallets for clinical payments."}
                  </span>
                </div>
                <div>
                  <input
                    type="checkbox"
                    disabled={!isPaymentsAllowed}
                    {...register("isOnlinePaymentsEnabled")}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isPaymentsAllowed && (
                    <span className="block text-[10px] text-red-500 font-bold mt-1 text-center">{locale === "ar" ? "غير مدعوم" : "Locked"}</span>
                  )}
                </div>
              </div>

              {/* Module 4: Surgical Module */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-1 text-start">
                  <span className="font-bold text-gray-900 block">{locale === "ar" ? "إدارة وحدة العمليات الجراحية والعمليات" : "Surgical & Operating Rooms Module"}</span>
                  <span className="text-xs text-gray-500 block">
                    {locale === "ar" ? "إدارة غرف العمليات، التخدير، قوائم التحقق الجراحية منظمة الصحة العالمية." : "Unlock block scheduling, WHO checklists, and pre-op/anesthesia records."}
                  </span>
                </div>
                <div>
                  <input
                    type="checkbox"
                    disabled={!isSurgicalAllowed}
                    {...register("isSurgicalEnabled")}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isSurgicalAllowed && (
                    <span className="block text-[10px] text-red-500 font-bold mt-1 text-center">{locale === "ar" ? "غير مدعوم" : "Locked"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Paymob Credentials */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <span>{t("paymobConfig")}</span>
            </h3>

            {/* Check if payments enabled first */}
            {!watchedOnlinePayments ? (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-100 text-center text-gray-400 space-y-3">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <p className="font-bold">
                  {locale === "ar" 
                    ? "المدفوعات الإلكترونية غير مفعلة حالياً." 
                    : "Online Payments are disabled."}
                </p>
                <p className="text-xs max-w-md">
                  {locale === "ar" 
                    ? "يرجى التوجه إلى قسم (تفعيل الوحدات) لتفعيل وحدة الدفع الإلكتروني وتفويض بوابات الدفع أولاً." 
                    : "Please toggle and enable 'Online Payments Gateway' in the Module Activation tab first."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 text-start">{t("paymobApiKey")}</label>
                  <input
                    type="password"
                    {...register("paymobApiKey")}
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                    placeholder="e.g. zyx123..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700 text-start">{t("paymobCardId")}</label>
                    <input
                      {...register("paymobCardId")}
                      className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                      placeholder="e.g. 439281"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700 text-start">{t("paymobWalletId")}</label>
                    <input
                      {...register("paymobWalletId")}
                      className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                      placeholder="e.g. 439282"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700 text-start">{t("paymobFawryId")}</label>
                    <input
                      {...register("paymobFawryId")}
                      className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                      placeholder="e.g. 439283"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 text-start">{t("paymobHmacSecret")}</label>
                  <input
                    type="password"
                    {...register("paymobHmacSecret")}
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-start">
                    {locale === "ar" 
                      ? "المستخدم للتحقق من أمان وسلامة إشعارات التغييرات الفورية للعمليات الواردة من Paymob." 
                      : "Used to verify HMAC signatures of Paymob transactional webhooks securely."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Surgical & Housekeeping Configs */}
        {activeTab === "clinical" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-blue-600" />
              <span>{locale === "ar" ? "العمليات والخدمات المعاونة" : "OR & Housekeeping Settings"}</span>
            </h3>

            <div className="space-y-5">
              <div className="space-y-1.5 max-w-sm">
                <label className="block text-sm font-semibold text-gray-700 text-start">{t("cleaningDuration")}</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    {...register("orCleaningDuration", { valueAsNumber: true })}
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-start bg-white"
                  />
                  <span className="absolute end-3 text-xs text-gray-400">{locale === "ar" ? "دقيقة" : "Min"}</span>
                </div>
                {errors.orCleaningDuration && <p className="text-red-500 text-xs text-start">{errors.orCleaningDuration.message}</p>}
                <p className="text-[10px] text-gray-400 text-start">
                  {locale === "ar" 
                    ? "مدة التجهيز والتنظيف اللازمة لغرفة العمليات أو الأسرة بين كل مريض وآخر." 
                    : "Default preparation buffer buffer duration allocated between patient room transfers."}
                </p>
              </div>

              {/* Automatic Housekeeping creation */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-1 text-start max-w-xl">
                  <span className="font-bold text-gray-900 block">{locale === "ar" ? "التوليد التلقائي لمهام التدبير المنزلي" : "Automatic Housekeeping Triggers"}</span>
                  <span className="text-xs text-gray-500 block">
                    {locale === "ar" 
                      ? "توليد طلب تنظيف فوري لغرفة المريض أو سريره فور تسجيل خروجه في النظام وتحديث حالة الغرفة فوراً." 
                      : "Create clean tasks automatically when patients are discharged from their beds."}
                  </span>
                </div>
                <div>
                  <input
                    type="checkbox"
                    {...register("autoHousekeeping")}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 text-sm font-bold"
          >
            <span>{isPending ? tOnboarding("processing") : t("saveSettings")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
