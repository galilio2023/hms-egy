"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  Bed as BedIcon,
  Activity,
  UserCheck,
  AlertCircle,
  Thermometer,
  Sparkles,
  Search,
  Droplet,
  HeartPulse
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeSearchTerm, normalizeDecimal } from "@/lib/utils/egypt";
import { PHYSIO_THRESHOLDS } from "@/lib/utils/clinical-thresholds";

interface ActivePatient {
  admissionId: string;
  admissionDate: Date | null;
  reason: string | null;
  patientId: string;
  patientNameAr: string;
  patientNormalizedNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  gender: "male" | "female" | null;
  dob: Date | null;
  bedId: string | null;
  bedNumber: string | null;
  roomId: string | null;
  roomNumber: string | null;
  roomType: string | null;
  floor: string | null;
  wing: string | null;
  doctorId: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
}

interface VitalRecord {
  patientId: string;
  recordedAt: Date;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  temperature: string | number | null; // Postgres decimal casted or raw string
  oxygenSaturation: number | null;
}

interface NursingDashboardClientProps {
  locale: string;
  hospitalSlug: string;
  activePatients: ActivePatient[];
  pendingCleaningCount: number;
  vitalsByPatient: Record<string, VitalRecord[]>;
  showAll: boolean;
  hasDepartment: boolean;
}

export default function NursingDashboardClient({
  locale,
  hospitalSlug,
  activePatients,
  pendingCleaningCount,
  vitalsByPatient,
  showAll,
  hasDepartment,
}: NursingDashboardClientProps) {
  const t = useTranslations("nursing");
  const isRtl = locale === "ar";
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const normalizedPatients = useMemo(() => {
    return activePatients.map(p => ({
      ...p,
      normalizedNameEn: normalizeSearchTerm(p.patientNameEn || ""),
      normalizedNumber: normalizeSearchTerm(p.patientNumber || ""),
      normalizedRoom: p.roomNumber ? normalizeSearchTerm(p.roomNumber) : ""
    }));
  }, [activePatients]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return normalizedPatients;
    
    const normalizedQuery = normalizeSearchTerm(searchQuery);

    return normalizedPatients.filter(
      (p) =>
        (p.patientNormalizedNameAr && p.patientNormalizedNameAr.includes(normalizedQuery)) ||
        p.normalizedNameEn.includes(normalizedQuery) ||
        p.normalizedNumber.includes(normalizedQuery) ||
        p.normalizedRoom.includes(normalizedQuery)
    );
  }, [normalizedPatients, searchQuery]);

  const criticalAlertsCount = useMemo(() => {
    let count = 0;
    Object.values(vitalsByPatient).forEach((records) => {
      const recentVitals = records?.[0];
      if (!recentVitals) return;
      
      const hr = recentVitals.heartRate;
      const spo2 = recentVitals.oxygenSaturation;
      const sys = recentVitals.bloodPressureSystolic;
      const temp = normalizeDecimal(recentVitals.temperature);

      // Standard physiological thresholds from clinical config
      if (
        (hr !== null && (hr > PHYSIO_THRESHOLDS.heartRate.max || hr < PHYSIO_THRESHOLDS.heartRate.min)) ||
        (spo2 !== null && spo2 < PHYSIO_THRESHOLDS.oxygenSaturation.min) ||
        (temp !== null && (temp > PHYSIO_THRESHOLDS.temperature.max || temp < PHYSIO_THRESHOLDS.temperature.min)) ||
        (sys !== null && (sys > PHYSIO_THRESHOLDS.bloodPressure.systolic.max || sys < PHYSIO_THRESHOLDS.bloodPressure.systolic.min))
      ) {
        count++;
      }
    });
    return count;
  }, [vitalsByPatient]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasDepartment && (
            <Button
              variant={showAll ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams();
                if (!showAll) params.set("view", "all");
                router.push(`/${hospitalSlug}/nursing?${params.toString()}`);
              }}
              className={cn(
                "font-bold text-xs rounded-xl shadow-sm gap-2",
                showAll 
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              )}
            >
              <Sparkles className={cn("w-4 h-4", showAll ? "text-amber-500" : "text-slate-400")} />
              {showAll ? t("departmentOnly") : t("showAllPatients")}
            </Button>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl ps-9"
            />
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg shadow-teal-500/5 overflow-hidden relative rounded-2xl bg-white dark:bg-slate-950">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <UserCheck className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("activeInpatients")}</span>
              <span className="text-4xl font-black text-slate-900 dark:text-white mt-2">{activePatients.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-amber-500/5 overflow-hidden relative rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <Sparkles className="w-16 h-16 text-amber-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                {t("bedsPendingCleaning")}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black text-amber-700 dark:text-amber-400">{pendingCleaningCount}</span>
              </div>
              <p className="text-xs font-semibold text-amber-600/80 mt-1">
                {t("cleaningRequired")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-rose-500/5 overflow-hidden relative rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/20">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <AlertCircle className="w-16 h-16 text-rose-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-rose-700 dark:text-rose-500 uppercase tracking-wider">
                {t("criticalAlerts")}
              </span>
              <span className="text-4xl font-black text-rose-700 dark:text-rose-400 mt-2">{criticalAlertsCount}</span>
              <p className="text-xs font-semibold text-rose-600/80 mt-1">
                {criticalAlertsCount === 0 ? t("noCriticalVitals") : t("interventionRequired")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── PATIENTS LIST ──────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <BedIcon className="w-4 h-4 text-teal-600" />
            {t("currentShiftPatients")}
          </h2>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-bold">
              {t("noActivePatients")}
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const recentVitals = vitalsByPatient[patient.patientId]?.[0];

              return (
                <div key={patient.admissionId} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                  
                  {/* Patient Info */}
                  <div className="flex gap-4 items-start w-full lg:w-1/3">
                    <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 flex items-center justify-center font-black shrink-0 border border-teal-200 dark:border-teal-800">
                      {patient.roomNumber || "-"}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {isRtl ? patient.patientNameAr : patient.patientNameEn}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                          {patient.patientNumber}
                        </span>
                        <span>•</span>
                        <span>{isRtl ? patient.doctorNameAr : patient.doctorNameEn}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vitals Summary */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t("bp")}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.bloodPressureSystolic && recentVitals?.bloodPressureDiastolic 
                            ? `${recentVitals.bloodPressureSystolic}/${recentVitals.bloodPressureDiastolic}`
                            : "--/--"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t("hr")}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.heartRate ? `${recentVitals.heartRate} bpm` : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t("temp")}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.temperature ? `${recentVitals.temperature}°C` : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-cyan-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t("spo2")}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.oxygenSaturation ? `${recentVitals.oxygenSaturation}%` : "--"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="w-full lg:w-auto flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="font-bold text-xs rounded-xl shadow-sm border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                      onClick={() => router.push(`/${hospitalSlug}/admissions`)}
                    >
                      {t("recordVitals")}
                    </Button>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
