"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";
import { setupHospital } from "@/lib/actions/onboarding";
import { useRouter } from "@/i18n/routing";
import { GOVERNORATES } from "@/lib/utils/egypt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Building2, LayoutGrid, UserCog, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function HospitalOnboardingForm() {
  const t = useTranslations("onboarding");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  const modules = watch("modules");

  return (
    <Card className="max-w-3xl mx-auto shadow-xl border-border/40 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black text-foreground tracking-tight">
              {t("title")}
            </CardTitle>
            <CardDescription className="text-sm font-medium text-muted-foreground mt-0.5">
              {t("subtitle") || "Configure your hospital's digital infrastructure"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <LayoutGrid className="w-4 h-4" />
              <h3 className="text-sm font-black uppercase tracking-wider">{t("basicInfo") || "Basic Information"}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="nameAr" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("nameAr")}
                </label>
                <Input
                  id="nameAr"
                  {...register("nameAr")}
                  placeholder={t("placeholders.nameAr")}
                  className="h-11 font-bold text-start"
                />
                {errors.nameAr && <p className="text-destructive text-[10px] font-bold">{errors.nameAr.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="nameEn" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("nameEn")}
                </label>
                <Input
                  id="nameEn"
                  {...register("nameEn")}
                  placeholder={t("placeholders.nameEn")}
                  className="h-11 font-bold text-start"
                />
                {errors.nameEn && <p className="text-destructive text-[10px] font-bold">{errors.nameEn.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="slug" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                {t("slug")}
              </label>
              <div className="relative">
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder={t("placeholders.slug")}
                  className="h-11 font-mono font-bold ps-4 text-start"
                />
                <div className="absolute inset-y-0 end-0 flex items-center pe-4 pointer-events-none text-muted-foreground/40 text-xs font-mono">
                  .hms.eg
                </div>
              </div>
              {errors.slug && <p className="text-destructive text-[10px] font-bold">{errors.slug.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="contactEmail" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("contactEmail")}
                </label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  className="h-11 font-bold text-start"
                />
                {errors.contactEmail && <p className="text-destructive text-[10px] font-bold">{errors.contactEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="contactPhone" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("contactPhone")}
                </label>
                <Input
                  id="contactPhone"
                  {...register("contactPhone")}
                  placeholder={t("placeholders.phone")}
                  className="h-11 font-bold text-start"
                />
                {errors.contactPhone && <p className="text-destructive text-[10px] font-bold">{errors.contactPhone.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                {t("address")}
              </label>
              <Input
                id="address"
                {...register("address")}
                placeholder={t("placeholders.address")}
                className="h-11 font-bold text-start"
              />
              {errors.address && <p className="text-destructive text-[10px] font-bold">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("governorate")}
                </label>
                <select 
                  {...register("governorate")} 
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                >
                  <option value="" disabled>{t("placeholders.selectGov")}</option>
                  {Object.values(GOVERNORATES).map((gov) => (
                    <option key={gov.code} value={gov.code}>
                      {gov.en} ({gov.ar})
                    </option>
                  ))}
                </select>
                {errors.governorate && <p className="text-destructive text-[10px] font-bold">{errors.governorate.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("type")}
                </label>
                <select 
                  {...register("type")} 
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                  defaultValue="private"
                >
                  {(["private", "government", "military", "ngo"] as const).map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
                {errors.type && <p className="text-destructive text-[10px] font-bold">{errors.type.message}</p>}
              </div>
            </div>
          </div>

          {/* SECTION 2: MODULE ACTIVATION */}
          <div className="space-y-6 pt-6 border-t border-border/10">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <LayoutGrid className="w-4 h-4" />
              <h3 className="text-sm font-black uppercase tracking-wider">{t("modulesTitle")}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["surgical", "telemedicine", "portal", "payments"] as const).map((module) => (
                <div 
                  key={module}
                  onClick={() => setValue(`modules.${module}`, !modules[module])}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer select-none",
                    modules[module] 
                      ? "bg-blue-500/5 border-blue-500/40 shadow-sm" 
                      : "bg-muted/10 border-transparent hover:border-border/60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!modules[module]}
                    readOnly
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-black text-foreground capitalize">{module}</span>
                    <p className="text-[10px] font-bold text-muted-foreground leading-tight">
                      {t(`modulesDesc.${module}`) || `Activate the ${module} module for your hospital.`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: ADMIN ACCOUNT */}
          <div className="space-y-6 pt-6 border-t border-border/10">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <UserCog className="w-4 h-4" />
              <h3 className="text-sm font-black uppercase tracking-wider">{t("adminTitle")}</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label htmlFor="adminName" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                  {t("adminName")}
                </label>
                <Input
                  id="adminName"
                  {...register("adminName")}
                  className="h-11 font-bold text-start"
                />
                {errors.adminName && <p className="text-destructive text-[10px] font-bold">{errors.adminName.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="adminEmail" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                    {t("adminEmail")}
                  </label>
                  <Input
                    id="adminEmail"
                    type="email"
                    {...register("adminEmail")}
                    className="h-11 font-bold text-start"
                  />
                  {errors.adminEmail && <p className="text-destructive text-[10px] font-bold">{errors.adminEmail.message}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="adminPassword" className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                    {t("adminPassword")}
                  </label>
                  <Input
                    id="adminPassword"
                    type="password"
                    {...register("adminPassword")}
                    className="h-11 font-bold text-start"
                  />
                  {errors.adminPassword && <p className="text-destructive text-[10px] font-bold">{errors.adminPassword.message}</p>}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/5 border border-destructive/20 text-destructive rounded-xl text-xs font-black flex items-center gap-2 animate-in fade-in zoom-in-95">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t("processing")}</span>
              </div>
            ) : (
              t("submit")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
