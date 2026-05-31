"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toZonedTime } from "date-fns-tz";

interface Appointment {
  id: string;
  startTime: string;
  type: string;
  status: string;
  patientNameAr?: string;
  patientNameEn?: string;
  doctorNameAr?: string;
  doctorNameEn?: string;
  scheduledDate: string | Date;
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  locale: string;
}

export function AppointmentCalendar({ appointments, locale }: AppointmentCalendarProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const targetWeekStartStr = searchParams.get("weekStart");
  const targetWeekStart = targetWeekStartStr ? new Date(targetWeekStartStr) : (() => {
    const d = toZonedTime(new Date(), "Africa/Cairo");
    const day = d.getDay();
    const diff = d.getDate() - day; 
    return new Date(d.setDate(diff));
  })();

  const getWeekDates = (start: Date) => {
    const dates = [];
    const curr = new Date(start);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates(targetWeekStart);

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((app) => {
      const d = new Date(app.scheduledDate);
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth() === date.getMonth() &&
             d.getDate() === date.getDate();
    });
  };

  const updateWeek = (offset: number) => {
    const d = new Date(targetWeekStart);
    d.setDate(d.getDate() + offset);
    const params = new URLSearchParams(searchParams);
    params.set("weekStart", d.toISOString().split("T")[0]);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRowClick = (appId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("selectedAppId", appId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "checkup":
      case "consultation":
        return <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-violet-500/10 text-violet-600 font-bold uppercase">{t("checkup")}</span>;
      case "follow_up":
        return <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-indigo-500/10 text-indigo-600 font-bold uppercase">{t("follow_up")}</span>;
      case "procedure":
        return <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-rose-500/10 text-rose-600 font-bold uppercase">{t("procedure")}</span>;
      case "telemedicine":
        return <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-teal-500/10 text-teal-600 font-bold uppercase">{t("telemedicine")}</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-gray-500/10 text-gray-600 font-bold uppercase">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border/40 shadow-xs">
        <Button variant="outline" size="sm" onClick={() => updateWeek(-7)} className="h-8 px-2.5">
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <span className="font-black text-sm tracking-tight text-foreground">
          {weekDates[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <Button variant="outline" size="sm" onClick={() => updateWeek(7)} className="h-8 px-2.5">
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {weekDates.map((date, idx) => {
          const dayApps = getAppointmentsForDate(date);
          const isToday = new Date().toDateString() === date.toDateString();
          const isWeekend = date.getDay() === 5 || date.getDay() === 6;

          return (
            <div 
              key={idx} 
              className={cn(
                "rounded-xl border flex flex-col bg-card min-h-[400px] shadow-xs text-start transition-all",
                isToday ? "border-accent ring-1 ring-accent/30 shadow-md bg-accent/2" : "border-border/40 hover:border-border/80",
                isWeekend && "bg-gray-50/20"
              )}
            >
              <div 
                className={cn(
                  "p-3 border-b border-border/30 flex flex-col items-start gap-0.5",
                  isToday && "bg-accent/5"
                )}
              >
                <span className={cn("text-xs font-black", isToday ? "text-accent" : "text-foreground")}>
                  {date.toLocaleDateString(locale, { weekday: 'long' })}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono font-bold">
                  {date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-thin max-h-[350px]">
                {dayApps.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <span className="text-[10px] text-muted-foreground/60 font-semibold italic text-center leading-relaxed">
                      {isWeekend 
                        ? (isRtl ? "عطلة نهاية الأسبوع 🌴" : "Weekend Off 🌴")
                        : (isRtl ? "لا توجد مواعيد" : "No appointments")}
                    </span>
                  </div>
                ) : (
                  dayApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleRowClick(app.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-start flex flex-col gap-1.5 transition-all outline-hidden text-[11px] shadow-2xs hover:shadow-xs group",
                        app.status === "cancelled" 
                          ? "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-800" 
                          : app.status === "completed"
                            ? "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-800"
                            : "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10 text-blue-800"
                      )}
                    >
                      <div className="flex justify-between items-center gap-1 w-full">
                        <span className="font-mono font-black text-[9px] opacity-70">
                          {app.startTime.substring(0, 5)}
                        </span>
                        {renderTypeBadge(app.type)}
                      </div>
                      <span className="font-black truncate text-foreground leading-snug group-hover:text-primary transition-colors">
                        {isRtl ? app.patientNameAr : app.patientNameEn}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-semibold truncate flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                        د. {isRtl ? app.doctorNameAr : app.doctorNameEn}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
