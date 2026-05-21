"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleHospitalActive, updateHospitalTier } from "@/lib/actions/super-admin";
import { type PlanTier } from "@/types/plans.types";
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

  // Constants for pricing
  const PRICING = {
    starter: 2500,
    professional: 7500,
    enterprise: 25000,
  };

  const calculatedMRR = hospitalsList
    .filter((h) => h.isActive)
    .reduce((sum, h) => sum + (PRICING[h.planTier] || 0), 0);

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
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600 animate-pulse" />
            <span>{t("title")}</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
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
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none opacity-50" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("totalHospitals")}</p>
              <h3 className="text-4xl font-extrabold text-blue-900 mt-2 tracking-tight">
                {formatNumber(totalCount)}
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                {locale === "ar" ? `${formatNumber(activeCount)} مستشفى نشطة` : `${activeCount} Active Tenants`}
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          {/* Submetrics list */}
          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between text-gray-600">
              <span>{tOnboarding("types.private")}</span>
              <span className="font-semibold px-2 py-0.5 bg-gray-100 rounded-md">{typeCounts.private}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>{tOnboarding("types.government")}</span>
              <span className="font-semibold px-2 py-0.5 bg-gray-100 rounded-md">{typeCounts.government}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>{tOnboarding("types.military")}</span>
              <span className="font-semibold px-2 py-0.5 bg-gray-100 rounded-md">{typeCounts.military}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>{tOnboarding("types.ngo")}</span>
              <span className="font-semibold px-2 py-0.5 bg-gray-100 rounded-md">{typeCounts.ngo}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Active Subscriptions */}
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent pointer-events-none opacity-50" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("activeSubscriptions")}</p>
              <h3 className="text-4xl font-extrabold text-emerald-700 mt-2 tracking-tight">
                {formatNumber(activeCount)}
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                {locale === "ar" ? "اشتراكات المستشفيات النشطة" : "Active paid tenant plans"}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          {/* Submetrics list */}
          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-3 gap-1 text-[10px] md:text-xs">
            <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-500 font-medium">{locale === "ar" ? "أساسية" : "Starter"}</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5">{tierCounts.starter}</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-blue-50/50 rounded-lg">
              <span className="text-blue-600 font-medium">{locale === "ar" ? "احترافية" : "Pro"}</span>
              <span className="font-bold text-blue-900 text-sm mt-0.5">{tierCounts.professional}</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-purple-50 rounded-lg">
              <span className="text-purple-600 font-medium">{locale === "ar" ? "مؤسسات" : "Enterprise"}</span>
              <span className="font-bold text-purple-900 text-sm mt-0.5">{tierCounts.enterprise}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Global Monthly Recurring Revenue */}
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 md:col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent pointer-events-none opacity-50" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("globalMRR")}</p>
              <h3 className="text-3xl font-extrabold text-amber-700 mt-2 tracking-tight">
                {formatNumber(calculatedMRR)} <span className="text-sm font-medium">{locale === "ar" ? "ج.م / شهر" : "EGP / Mo"}</span>
              </h3>
              <p className="text-[10px] md:text-xs text-gray-400 mt-1.5 font-medium leading-relaxed bg-amber-50/60 p-1.5 rounded border border-amber-100/50">
                {locale === "ar" ? mrrWordsAr : mrrWordsEn}
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl self-start">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Panel - shadcn-inspired clean aesthetics */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/40">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-500" />
            <span>{t("hospitalList")}</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={locale === "ar" ? "ابحث باسم المستشفى، الرابط، أو المحافظة..." : "Search name, slug, governorate..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-start bg-white transition"
              />
            </div>
            
            {/* Filter by Type */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs md:text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
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
              className="text-xs md:text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
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
              <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 text-start font-bold">{locale === "ar" ? "المستشفى" : "Hospital Name"}</th>
                <th className="px-6 py-4 text-start font-bold">{t("slug")}</th>
                <th className="px-6 py-4 text-start font-bold">{t("type")}</th>
                <th className="px-6 py-4 text-start font-bold">{locale === "ar" ? "الوحدات النشطة" : "Active Modules"}</th>
                <th className="px-6 py-4 text-start font-bold">{t("tier")}</th>
                <th className="px-6 py-4 text-start font-bold">{t("status")}</th>
                <th className="px-6 py-4 text-center font-bold">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">
                    {locale === "ar" ? "لا توجد مستشفيات مطابقة للبحث" : "No registered hospitals found matching the query"}
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((hospital) => (
                  <tr 
                    key={hospital.id} 
                    className="hover:bg-gray-50/50 transition duration-150"
                  >
                    {/* Hospital Name & Governorate */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {locale === "ar" ? hospital.nameAr : hospital.nameEn}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {hospital.governorate} &bull; {hospital.contactEmail}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      /{hospital.slug}
                    </td>

                    {/* Type Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        hospital.type === "private" ? "bg-cyan-50 text-cyan-700" :
                        hospital.type === "government" ? "bg-amber-50 text-amber-700" :
                        hospital.type === "military" ? "bg-rose-50 text-rose-700" :
                        "bg-teal-50 text-teal-700"
                      }`}>
                        {tOnboarding(`types.${hospital.type}`)}
                      </span>
                    </td>

                    {/* Enabled Modules */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {hospital.isSurgicalEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded font-medium border border-red-100">
                            {locale === "ar" ? "عمليات" : "Surgical"}
                          </span>
                        )}
                        {hospital.isTelemedicineEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-sky-50 text-sky-600 rounded font-medium border border-sky-100">
                            {locale === "ar" ? "عن بعد" : "Telemed"}
                          </span>
                        )}
                        {hospital.isPatientPortalEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-teal-50 text-teal-600 rounded font-medium border border-teal-100">
                            {locale === "ar" ? "بوابة المرضى" : "Portal"}
                          </span>
                        )}
                        {hospital.isOnlinePaymentsEnabled && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded font-medium border border-purple-100">
                            {locale === "ar" ? "دفع الكتروني" : "Paymob"}
                          </span>
                        )}
                        {!hospital.isSurgicalEnabled && 
                         !hospital.isTelemedicineEnabled && 
                         !hospital.isPatientPortalEnabled && 
                         !hospital.isOnlinePaymentsEnabled && (
                          <span className="text-xs text-gray-400 font-normal italic">
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
                            className="text-xs border rounded p-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            <option value="starter">{locale === "ar" ? "الأساسية" : "Starter"}</option>
                            <option value="professional">{locale === "ar" ? "الاحترافية" : "Pro"}</option>
                            <option value="enterprise">{locale === "ar" ? "المؤسسات" : "Enterprise"}</option>
                          </select>
                          <button
                            onClick={() => handleUpdateTier(hospital.id)}
                            disabled={isPending}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingTierHospitalId(null)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${
                            hospital.planTier === "starter" ? "bg-gray-100 text-gray-700 border border-gray-200" :
                            hospital.planTier === "professional" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                            "bg-purple-50 text-purple-700 border border-purple-100"
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
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer select-none ${
                          hospital.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-red-50 text-red-700 hover:bg-red-100"
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition"
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
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
          <span>{locale === "ar" ? `إجمالي السجلات: ${totalCount}` : `Total records: ${totalCount}`}</span>
          <span>&copy; {new Date().getFullYear()} HMS Egypt &bull; Super Admin Portal</span>
        </div>
      </div>
    </div>
  );
}
