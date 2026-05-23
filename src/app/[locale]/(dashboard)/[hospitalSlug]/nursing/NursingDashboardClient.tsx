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
  Clock,
  Sparkles,
  Search,
  Droplet
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ActivePatient {
  admissionId: string;
  admissionDate: Date | null;
  reason: string | null;
  patientId: string;
  patientNameAr: string;
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
  temperature: string | null;
  oxygenSaturation: number | null;
}

interface NursingDashboardClientProps {
  locale: string;
  hospitalSlug: string;
  activePatients: ActivePatient[];
  pendingCleaningCount: number;
  vitalsByPatient: Record<string, VitalRecord[]>;
}

export default function NursingDashboardClient({
  locale,
  hospitalSlug,
  activePatients,
  pendingCleaningCount,
  vitalsByPatient,
}: NursingDashboardClientProps) {
  const t = useTranslations("nursing");
  const isRtl = locale === "ar";
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return activePatients;
    const lowerQ = searchQuery.toLowerCase();
    return activePatients.filter(
      (p) =>
        p.patientNameAr.toLowerCase().includes(lowerQ) ||
        p.patientNameEn.toLowerCase().includes(lowerQ) ||
        p.patientNumber.toLowerCase().includes(lowerQ) ||
        p.roomNumber?.toLowerCase().includes(lowerQ)
    );
  }, [activePatients, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            {t("title") || "لوحة تمريض المناوبة"}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {isRtl ? "متابعة الحالات الداخلية، المؤشرات الحيوية، وحالة الأسرة" : "Inpatient monitoring, vitals, and bed status."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <Input
              type="text"
              placeholder={isRtl ? "ابحث باسم المريض أو الغرفة..." : "Search patient or room..."}
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
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{isRtl ? "مرضى القسم الداخلي" : "Active Inpatients"}</span>
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
                {isRtl ? "أسرة بانتظار التنظيف" : "Beds Pending Cleaning"}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black text-amber-700 dark:text-amber-400">{pendingCleaningCount}</span>
              </div>
              <p className="text-xs font-semibold text-amber-600/80 mt-1">
                {isRtl ? "يتطلب إرسال فريق النظافة" : "Housekeeping team dispatch required"}
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
                {isRtl ? "تنبيهات حيوية" : "Critical Alerts"}
              </span>
              <span className="text-4xl font-black text-rose-700 dark:text-rose-400 mt-2">0</span>
              <p className="text-xs font-semibold text-rose-600/80 mt-1">
                {isRtl ? "لا توجد مؤشرات حرجة حديثة" : "No recent critical vitals"}
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
            {isRtl ? "حالات المناوبة الحالية" : "Current Shift Patients"}
          </h2>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-bold">
              {isRtl ? "لا توجد حالات حالية" : "No active patients found."}
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
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{isRtl ? "ضغط الدم" : "BP"}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.bloodPressureSystolic && recentVitals?.bloodPressureDiastolic 
                            ? `${recentVitals.bloodPressureSystolic}/${recentVitals.bloodPressureDiastolic}`
                            : "--/--"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <HeartPulseIcon className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{isRtl ? "نبض القلب" : "HR"}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.heartRate ? `${recentVitals.heartRate} bpm` : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{isRtl ? "الحرارة" : "Temp"}</p>
                        <p className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 truncate">
                          {recentVitals?.temperature ? `${recentVitals.temperature}°C` : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-cyan-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{isRtl ? "الأكسجين" : "SpO2"}</p>
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
                      {isRtl ? "تسجيل قراءات" : "Record Vitals"}
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

// Temporary inline icon for HeartPulse
function HeartPulseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}
