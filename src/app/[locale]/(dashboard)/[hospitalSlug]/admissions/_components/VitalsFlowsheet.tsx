"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RefreshCw, Activity, Plus, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { safeParseInt } from "@/lib/utils/formatting";
import { recordInpatientVitals } from "../actions";

interface VitalRecord {
  id: string;
  recordedAt: Date;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperature: string | null;
  oxygenSaturation: number | null;
  weightKg: string | null;
  heightCm: number | null;
  recorderNameAr: string | null;
  recorderNameEn: string | null;
}

interface VitalsFlowsheetProps {
  patientId: string;
  history: VitalRecord[];
  mewsHistory: Record<string, any>;
  locale: string;
}

export function VitalsFlowsheet({
  patientId,
  history,
  mewsHistory,
  locale,
}: VitalsFlowsheetProps) {
  const t = useTranslations("admissions");
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  const [vitalsInput, setVitalsInput] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    heartRate: "",
    respiratoryRate: "",
    temperature: "",
    oxygenSaturation: "",
    weightKg: "",
    heightCm: "",
  });

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      const res = await recordInpatientVitals({
        patientId,
        bloodPressureSystolic: vitalsInput.bpSystolic ? safeParseInt(vitalsInput.bpSystolic) : undefined,
        bloodPressureDiastolic: vitalsInput.bpDiastolic ? safeParseInt(vitalsInput.bpDiastolic) : undefined,
        heartRate: vitalsInput.heartRate ? safeParseInt(vitalsInput.heartRate) : undefined,
        respiratoryRate: vitalsInput.respiratoryRate ? safeParseInt(vitalsInput.respiratoryRate) : undefined,
        temperature: vitalsInput.temperature || undefined,
        oxygenSaturation: vitalsInput.oxygenSaturation ? safeParseInt(vitalsInput.oxygenSaturation) : undefined,
        weightKg: vitalsInput.weightKg || undefined,
        heightCm: vitalsInput.heightCm ? safeParseInt(vitalsInput.heightCm) : undefined,
      });

      if (res.success) {
        toast.success(t("recordVitalsSuccess"));
        setIsFormExpanded(false);
        setVitalsInput({
          bpSystolic: "", bpDiastolic: "", heartRate: "", respiratoryRate: "",
          temperature: "", oxygenSaturation: "", weightKg: "", heightCm: "",
        });
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : "Failed to record vitals.";
        toast.error(errorMsg || "Failed to record vitals.");
      }
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString(isRtl ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          {isRtl ? "مخطط العلامات الحيوية (Flowsheet)" : "Clinical Vitals Flowsheet"}
        </h4>
        <Button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          variant={isFormExpanded ? "ghost" : "outline"}
          size="sm"
          className="h-8 rounded-lg text-[10px] font-bold gap-1.5"
        >
          {isFormExpanded ? (isRtl ? "إغلاق" : "Cancel") : (
            <>
              <Plus className="h-3.5 w-3.5" />
              {isRtl ? "تسجيل قياس جديد" : "Add Vitals"}
            </>
          )}
        </Button>
      </div>

      {isFormExpanded && (
        <Card className="p-4 border-blue-500/20 bg-blue-500/5 animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleRecordVitals} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <VitalsInput label={isRtl ? "الضغط الانقباضي" : "Systolic BP"} value={vitalsInput.bpSystolic} onChange={(val) => setVitalsInput(prev => ({ ...prev, bpSystolic: val }))} placeholder="120" />
              <VitalsInput label={isRtl ? "الضغط الانبساطي" : "Diastolic BP"} value={vitalsInput.bpDiastolic} onChange={(val) => setVitalsInput(prev => ({ ...prev, bpDiastolic: val }))} placeholder="80" />
              <VitalsInput label={isRtl ? "نبض القلب" : "Heart Rate"} value={vitalsInput.heartRate} onChange={(val) => setVitalsInput(prev => ({ ...prev, heartRate: val }))} placeholder="72" />
              <VitalsInput label={isRtl ? "معدل التنفس" : "Resp. Rate"} value={vitalsInput.respiratoryRate} onChange={(val) => setVitalsInput(prev => ({ ...prev, respiratoryRate: val }))} placeholder="16" />
              <VitalsInput label={isRtl ? "درجة الحرارة" : "Body Temp"} value={vitalsInput.temperature} onChange={(val) => setVitalsInput(prev => ({ ...prev, temperature: val }))} placeholder="36.8" type="text" />
              <VitalsInput label={isRtl ? "الأكسجين SpO2" : "SpO2 (%)"} value={vitalsInput.oxygenSaturation} onChange={(val) => setVitalsInput(prev => ({ ...prev, oxygenSaturation: val }))} placeholder="98" />
              <VitalsInput label={isRtl ? "الوزن (كجم)" : "Weight (kg)"} value={vitalsInput.weightKg} onChange={(val) => setVitalsInput(prev => ({ ...prev, weightKg: val }))} placeholder="70" type="text" />
              <VitalsInput label={isRtl ? "الطول (سم)" : "Height (cm)"} value={vitalsInput.heightCm} onChange={(val) => setVitalsInput(prev => ({ ...prev, heightCm: val }))} placeholder="170" />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm text-xs h-9 px-6"
              >
                {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : t("recordVitals")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {history.length > 0 ? (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border/40 font-bold text-muted-foreground text-start">
              <tr>
                <th className="p-3">{isRtl ? "تاريخ القياس" : "Recorded At"}</th>
                <th className="p-3 text-center">{isRtl ? "ضغط الدم" : "BP"}</th>
                <th className="p-3 text-center">{isRtl ? "النبض" : "HR"}</th>
                <th className="p-3 text-center">{isRtl ? "التنفس" : "RR"}</th>
                <th className="p-3 text-center">{isRtl ? "درجة الحرارة" : "Temp"}</th>
                <th className="p-3 text-center">{isRtl ? "الأكسجين" : "SpO2"}</th>
                <th className="p-3 text-center">{isRtl ? "MEWS" : "MEWS"}</th>
                <th className="p-3 text-start hidden sm:table-cell">{isRtl ? "بواسطة" : "Staff"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {history.map((v) => {
                const mews = mewsHistory[v.id] || { score: "—", badgeStyle: "text-muted-foreground" };
                return (
                  <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3 font-semibold text-muted-foreground whitespace-nowrap">{formatDate(v.recordedAt)}</td>
                    <td className="p-3 text-center font-bold">{v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</td>
                    <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{v.heartRate}</td>
                    <td className="p-3 text-center">{v.respiratoryRate}</td>
                    <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">{v.temperature}°C</td>
                    <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-400">{v.oxygenSaturation}%</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm", mews.badgeStyle)}>
                        {mews.score}
                      </span>
                    </td>
                    <td className="p-3 text-start text-muted-foreground/80 truncate hidden sm:table-cell max-w-[120px]">
                      {isRtl ? v.recorderNameAr : v.recorderNameEn}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-2xl p-8 bg-muted/20 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto opacity-20 mb-2" />
          <p className="text-xs">{isRtl ? "لا توجد قياسات مسجلة" : "No measurements logged yet."}</p>
        </div>
      )}
    </div>
  );
}

function VitalsInput({ label, value, onChange, placeholder, type = "number" }: { 
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string 
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-foreground/70 uppercase">{label}</label>
      <Input
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
      />
    </div>
  );
}
