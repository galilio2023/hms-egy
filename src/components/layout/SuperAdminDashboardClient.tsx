"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleHospitalActive, updateHospitalTier } from "@/lib/actions/super-admin";
import { type PlanTier, PLAN_PRICING } from "@/types/plans.types";
import { 
  Building2, 
  ShieldCheck, 
  Wallet, 
  Search, 
  Filter, 
  Check, 
  X,
  CreditCard,
  Layers,
  Settings,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BorderBeam } from "@/components/magicui/BorderBeam";
import { NumberTicker } from "@/components/magicui/NumberTicker";

interface HospitalWithSettings {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  governorate: string;
  type: "private" | "government" | "military" | "ngo";
  planTier: PlanTier;
  isActive: boolean | null;
  createdAt: Date;
  isSurgicalEnabled: boolean | null;
  isTelemedicineEnabled: boolean | null;
  isPatientPortalEnabled: boolean | null;
  isOnlinePaymentsEnabled: boolean | null;
}

interface SuperAdminDashboardClientProps {
  initialHospitals: HospitalWithSettings[];
  mrrWordsAr: string;
  mrrWordsEn: string;
  locale: string;
}

export default function SuperAdminDashboardClient({
  initialHospitals,
  mrrWordsAr,
  mrrWordsEn,
  locale,
}: SuperAdminDashboardClientProps) {
  const t = useTranslations("superAdmin");
  const tOnboarding = useTranslations("onboarding");
  
  const [hospitalsList, setHospitalsList] = useState<HospitalWithSettings[]>(initialHospitals);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [editingTierHospitalId, setEditingTierHospitalId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<PlanTier>("starter");
  
  const [isPending, startTransition] = useTransition();

  // Statistics calculation
  const totalCount = hospitalsList.length;
  
  const typeCounts = hospitalsList.reduce(
    (acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + 1;
      return acc;
    },
    { private: 0, government: 0, military: 0, ngo: 0 }
  );

  const activeCount = hospitalsList.filter(h => h.isActive).length;
  
  const tierCounts = hospitalsList.reduce(
    (acc, curr) => {
      acc[curr.planTier] = (acc[curr.planTier] || 0) + 1;
      return acc;
    },
    { starter: 0, professional: 0, enterprise: 0 }
  );

  const calculatedMRR = hospitalsList
    .filter((h) => h.isActive)
    .reduce((sum, h) => sum + (PLAN_PRICING[h.planTier] || 0), 0);

  // Filters logic
  const filteredHospitals = hospitalsList.filter((hospital) => {
    const nameMatch = 
      hospital.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.governorate.toLowerCase().includes(searchQuery.toLowerCase());
      
    const typeMatch = typeFilter === "all" || hospital.type === typeFilter;
    const tierMatch = tierFilter === "all" || hospital.planTier === tierFilter;
    
    return nameMatch && typeMatch && tierMatch;
  });

  const handleToggleActive = async (id: string, currentStatus: boolean | null) => {
    const nextStatus = !currentStatus;
    
    // Optimistic UI update
    setHospitalsList(prev => 
      prev.map(h => h.id === id ? { ...h, isActive: nextStatus } : h)
    );

    startTransition(async () => {
      const result = await toggleHospitalActive(id, nextStatus);
      if (result.success) {
        toast.success(
          locale === "ar" 
            ? "تم تحديث حالة المستشفى بنجاح" 
            : "Hospital status updated successfully"
        );
      } else {
        toast.error(
          locale === "ar" 
            ? "فشل في تحديث حالة المستشفى" 
            : "Failed to update hospital status"
        );
        // Rollback
        setHospitalsList(prev => 
          prev.map(h => h.id === id ? { ...h, isActive: currentStatus } : h)
        );
      }
    });
  };

  const handleUpdateTier = async (id: string) => {
    startTransition(async () => {
      const result = await updateHospitalTier(id, selectedTier);
      if (result.success) {
        toast.success(
          locale === "ar" 
            ? "تم ترقية الباقة بنجاح" 
            : "Plan tier updated successfully"
        );
        setHospitalsList(prev => 
          prev.map(h => h.id === id ? { ...h, planTier: selectedTier } : h)
        );
        setEditingTierHospitalId(null);
      } else {
        toast.error(
          locale === "ar" 
            ? "فشل في تحديث الباقة" 
            : "Failed to update plan tier"
        );
      }
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(num);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span>{t("title")}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {locale === "ar" 
              ? "إدارة المستشفيات المشتركة، مراقبة الباقات الفعالة وإحصائيات العوائد في جمهورية مصر العربية." 
              : "Manage hospital tenants, monitor active subscription tiers, and financial MRR metrics."}
          </p>
        </div>
        <div className="self-end md:self-center">
          <LanguageSwitcher />
        </div>
      </header>

      {/* KPI Stats Cards - Glowing Luxury Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: Total Hospitals */}
        <div className="relative group overflow-hidden bg-card p-6 rounded-2xl border border-border/60 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none opacity-50" />
          <BorderBeam colorFrom="#3b82f6" colorTo="#60a5fa" duration={6} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("totalHospitals")}</p>
              <h3 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
                <NumberTicker value={totalCount} />
              </h3>
              <p className="text-xs text-muted-foreground/90 mt-1 font-medium">
                {locale === "ar" ? `${formatNumber(activeCount)} مستشفى نشطة` : `${activeCount} Active Tenants`}
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          {/* Submetrics list */}
          <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{tOnboarding("types.private")}</span>
              <span className="font-semibold px-2 py-0.5 bg-muted rounded-md">{typeCounts.private}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{tOnboarding("types.government")}</span>
              <span className="font-semibold px-2 py-0.5 bg-muted rounded-md">{typeCounts.government}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{tOnboarding("types.military")}</span>
              <span className="font-semibold px-2 py-0.5 bg-muted rounded-md">{typeCounts.military}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{tOnboarding("types.ngo")}</span>
              <span className="font-semibold px-2 py-0.5 bg-muted rounded-md">{typeCounts.ngo}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Active Subscriptions */}
        <div className="relative group overflow-hidden bg-card p-6 rounded-2xl border border-border/60 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none opacity-50" />
          <BorderBeam colorFrom="#10b981" colorTo="#34d399" duration={6} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("activeSubscriptions")}</p>
              <h3 className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
                <NumberTicker value={activeCount} />
              </h3>
              <p className="text-xs text-muted-foreground/90 mt-1 font-medium">
                {locale === "ar" ? "اشتراكات المستشفيات النشطة" : "Active paid tenant plans"}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          {/* Submetrics list */}
          <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-1 text-[10px] md:text-xs">
            <div className="flex flex-col items-center p-2 bg-muted rounded-lg">
              <span className="text-muted-foreground font-medium">{locale === "ar" ? "أساسية" : "Starter"}</span>
              <span className="font-bold text-foreground text-sm mt-0.5">{tierCounts.starter}</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-blue-500/10 rounded-lg">
              <span className="text-blue-600 dark:text-blue-400 font-medium">{locale === "ar" ? "احترافية" : "Pro"}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300 text-sm mt-0.5">{tierCounts.professional}</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-purple-500/10 rounded-lg">
              <span className="text-purple-600 dark:text-purple-400 font-medium">{locale === "ar" ? "مؤسسات" : "Enterprise"}</span>
              <span className="font-bold text-purple-700 dark:text-purple-300 text-sm mt-0.5">{tierCounts.enterprise}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Global Monthly Recurring Revenue */}
        <div className="relative group overflow-hidden bg-card p-6 rounded-2xl border border-border/60 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 md:col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none opacity-50" />
          <BorderBeam colorFrom="#f59e0b" colorTo="#fbbf24" duration={6} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("globalMRR")}</p>
              <h3 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2 tracking-tight animate-pulse-slow">
                <NumberTicker value={calculatedMRR} /> <span className="text-sm font-medium">{locale === "ar" ? "ج.م / شهر" : "EGP / Mo"}</span>
              </h3>
              <p className="text-[10px] md:text-xs text-muted-foreground/90 mt-1.5 font-medium leading-relaxed bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                {locale === "ar" ? mrrWordsAr : mrrWordsEn}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl self-start">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Panel - shadcn-inspired clean aesthetics */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-6 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <span>{t("hospitalList")}</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={locale === "ar" ? "ابحث باسم المستشفى، الرابط، أو المحافظة..." : "Search name, slug, governorate..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full ps-9 pe-4 py-2 text-sm border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-start bg-background text-foreground transition"
              />
            </div>
            
            {/* Filter by Type */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs md:text-sm border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground"
              >
                <option value="all">{locale === "ar" ? "جميع الأنواع" : "All Types"}</option>
                <option value="private">{tOnboarding("types.private")}</option>
                <option value="government">{tOnboarding("types.government")}</option>
                <option value="military">{tOnboarding("types.military")}</option>
                <option value="ngo">{tOnboarding("types.ngo")}</option>
              </select>
            </div>

            {/* Filter by Tier */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="text-xs md:text-sm border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground"
            >
              <option value="all">{locale === "ar" ? "جميع الباقات" : "All Tiers"}</option>
              <option value="starter">{locale === "ar" ? "الباقة الأساسية" : "Starter Tier"}</option>
              <option value="professional">{locale === "ar" ? "الباقة الاحترافية" : "Pro Tier"}</option>
              <option value="enterprise">{locale === "ar" ? "باقة المؤسسات" : "Enterprise Tier"}</option>
            </select>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4 text-start font-bold">{locale === "ar" ? "المستشفى" : "Hospital Name"}</th>
                <th className="px-6 py-4 text-start font-bold">{t("slug")}</th>
                <th className="px-6 py-4 text-start font-bold">{t("type")}</th>
                <th className="px-6 py-4 text-start font-bold">{locale === "ar" ? "الوحدات النشطة" : "Active Modules"}</th>
                <th className="px-6 py-4 text-start font-bold">{t("tier")}</th>
                <th className="px-6 py-4 text-start font-bold">{t("status")}</th>
                <th className="px-6 py-4 text-center font-bold">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    {locale === "ar" ? "لا توجد مستشفيات مطابقة للبحث" : "No registered hospitals found matching the query"}
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((hospital) => (
                  <tr 
                    key={hospital.id} 
                    className="hover:bg-muted/30 transition duration-150"
                  >
                    {/* Hospital Name & Governorate */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-foreground">
                          {locale === "ar" ? hospital.nameAr : hospital.nameEn}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {hospital.governorate} &bull; {hospital.contactEmail}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      /{hospital.slug}
                    </td>

                    {/* Type Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        hospital.type === "private" ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" :
                        hospital.type === "government" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                        hospital.type === "military" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                        "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                      }`}>
                        {tOnboarding(`types.${hospital.type}`)}
                      </span>
                    </td>

                    {/* Enabled Modules */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {hospital.isSurgicalEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 rounded font-medium border border-red-500/20">
                            {locale === "ar" ? "عمليات" : "Surgical"}
                          </span>
                        )}
                        {hospital.isTelemedicineEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded font-medium border border-sky-500/20">
                            {locale === "ar" ? "عن بعد" : "Telemed"}
                          </span>
                        )}
                        {hospital.isPatientPortalEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded font-medium border border-teal-500/20">
                            {locale === "ar" ? "بوابة المرضى" : "Portal"}
                          </span>
                        )}
                        {hospital.isOnlinePaymentsEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded font-medium border border-purple-500/20">
                            {locale === "ar" ? "دفع الكتروني" : "Paymob"}
                          </span>
                        )}
                        {!hospital.isSurgicalEnabled && 
                         !hospital.isTelemedicineEnabled && 
                         !hospital.isPatientPortalEnabled && 
                         !hospital.isOnlinePaymentsEnabled && (
                          <span className="text-xs text-muted-foreground font-normal italic">
                            {locale === "ar" ? "لا توجد وحدات نشطة" : "None"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Plan Tier color-coded */}
                    <td className="px-6 py-4">
                      {editingTierHospitalId === hospital.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedTier}
                            onChange={(e) => setSelectedTier(e.target.value as PlanTier)}
                            className="text-xs border border-border rounded p-1 outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                          >
                            <option value="starter">{locale === "ar" ? "الأساسية" : "Starter"}</option>
                            <option value="professional">{locale === "ar" ? "الاحترافية" : "Pro"}</option>
                            <option value="enterprise">{locale === "ar" ? "المؤسسات" : "Enterprise"}</option>
                          </select>
                          <button
                            onClick={() => handleUpdateTier(hospital.id)}
                            disabled={isPending}
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded transition"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingTierHospitalId(null)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded transition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${
                            hospital.planTier === "starter" ? "bg-muted text-muted-foreground border border-border" :
                            hospital.planTier === "professional" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                            "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}>
                            <CreditCard className="h-3 w-3 opacity-70" />
                            <span>
                              {hospital.planTier === "starter" ? (locale === "ar" ? "الأساسية" : "Starter") :
                               hospital.planTier === "professional" ? (locale === "ar" ? "الاحترافية" : "Pro") :
                               (locale === "ar" ? "المؤسسات" : "Enterprise")}
                            </span>
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Active/Inactive Status Toggle */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(hospital.id, hospital.isActive)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer select-none border ${
                          hospital.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/20"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${hospital.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                        <span>{hospital.isActive ? t("active") : t("inactive")}</span>
                      </button>
                    </td>

                    {/* Actions dropdown/button */}
                    <td className="px-6 py-4 text-center">
                      {editingTierHospitalId !== hospital.id && (
                        <button
                          onClick={() => {
                            setEditingTierHospitalId(hospital.id);
                            setSelectedTier(hospital.planTier);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded-lg hover:bg-primary/10 hover:text-primary transition"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span>{t("changeTier")}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-muted/20 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
          <span>{locale === "ar" ? `إجمالي السجلات: ${totalCount}` : `Total records: ${totalCount}`}</span>
          <span>&copy; {new Date().getFullYear()} HMS Egypt &bull; Super Admin Portal</span>
        </div>
      </div>
    </div>
  );
}
