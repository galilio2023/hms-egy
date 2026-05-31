"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Plus, Menu, CalendarRange, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppointmentFiltersProps {
  departments: { id: string; nameAr: string; nameEn: string }[];
  doctors: { id: string; nameAr: string; nameEn: string }[];
  waitingListCount: number;
  hospitalSlug: string;
  locale: string;
}

export function AppointmentFilters({
  departments,
  doctors,
  waitingListCount,
  hospitalSlug,
  locale,
}: AppointmentFiltersProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("query") || "");

  // Update URL on search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (search) params.set("query", search);
      else params.delete("query");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, pathname, router, searchParams]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleWaitingList = () => {
    const params = new URLSearchParams(searchParams);
    if (params.get("showWaiting") === "true") params.delete("showWaiting");
    else params.set("showWaiting", "true");
    router.push(`${pathname}?${params.toString()}`);
  };

  const viewMode = searchParams.get("view") || "week";
  const showWaiting = searchParams.get("showWaiting") === "true";

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-xs">
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <div className="relative w-full md:w-64">
          <Search className="absolute top-[11px] start-3.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-9 text-xs"
          />
        </div>

        <select 
          className="hms-select-native" 
          value={searchParams.get("dept") || ""} 
          onChange={(e) => updateParam("dept", e.target.value)}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <option value="">{isRtl ? "جميع العيادات" : "All Clinics"}</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {isRtl ? dept.nameAr : dept.nameEn}
            </option>
          ))}
        </select>

        <select 
          className="hms-select-native" 
          value={searchParams.get("doctor") || ""} 
          onChange={(e) => updateParam("doctor", e.target.value)}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <option value="">{isRtl ? "جميع الأطباء" : "All Doctors"}</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {isRtl ? doc.nameAr : doc.nameEn}
            </option>
          ))}
        </select>

        <select 
          className="hms-select-native" 
          value={searchParams.get("status") || ""} 
          onChange={(e) => updateParam("status", e.target.value)}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <option value="">{isRtl ? "كل الحالات" : "All Statuses"}</option>
          <option value="scheduled">{isRtl ? "مؤكد" : "Scheduled"}</option>
          <option value="completed">{isRtl ? "مكتمل" : "Completed"}</option>
          <option value="cancelled">{isRtl ? "ملغي" : "Cancelled"}</option>
          <option value="no_show">{isRtl ? "غائب" : "No Show"}</option>
        </select>
      </div>

      <div className="flex items-center gap-2 self-stretch md:self-auto justify-end w-full md:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleWaitingList}
          className={cn(
            "text-xs font-black relative h-9 px-3 gap-1.5",
            showWaiting && "bg-amber-500/10 text-amber-700 border-amber-500/30"
          )}
        >
          <Menu className="h-4 w-4" />
          <span>{t("waitingList")}</span>
          {waitingListCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold px-1 ring-2 ring-white">
              {waitingListCount}
            </span>
          )}
        </Button>

        <div className="border border-border/40 p-0.5 rounded-lg flex gap-0.5 bg-muted/40">
          <Button
            variant={viewMode === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => updateParam("view", "week")}
            className="h-8 text-xs font-bold px-2.5"
          >
            <CalendarRange className="h-3.5 w-3.5 me-1" />
            {isRtl ? "الأسبوع" : "Week"}
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => updateParam("view", "list")}
            className="h-8 text-xs font-bold px-2.5"
          >
            <BookOpen className="h-3.5 w-3.5 me-1" />
            {isRtl ? "القائمة" : "List"}
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => router.push(`/${hospitalSlug}/appointments/new`)}
          className="text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-3 gap-1"
        >
          <Plus className="h-4 w-4" />
          <span>{t("newAppointment")}</span>
        </Button>
      </div>
    </div>
  );
}
