"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icd10SearchPicker } from "./Icd10SearchPicker";
import { createMedicalRecord } from "@/lib/actions/clinical";
import { ORDER_SETS } from "@/lib/clinical/order-sets";
import { 
  Stethoscope, 
  Activity, 
  Heart, 
  Thermometer, 
  Gauge, 
  Scale, 
  Ruler, 
  FileEdit,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Save,
  CheckCircle2,
  Pill,
  FlaskConical,
  FileImage,
  FolderHeart,
  CheckSquare,
  Square,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientMinimal {
  id: string;
  nameAr: string;
  nameEn: string;
  patientNumber: string;
  gender: string;
  dob: string | Date;
}

interface MedicalRecordFormProps {
  patient: PatientMinimal;
  hospitalSlug: string;
}

export function MedicalRecordForm({ patient, hospitalSlug }: MedicalRecordFormProps) {
  const t = useTranslations("patients");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. Core Clinical States
  const [encounterType, setEncounterType] = useState<"outpatient" | "inpatient" | "emergency">("outpatient");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [soapNotes, setSoapNotes] = useState("");
  const [icdCodes, setIcdCodes] = useState<string[]>([]);

  // 2. Vitals Flowsheet States
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");

  // UI Feedback States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 3. Clinical Order Sets Selection States
  const [selectedOrderSetId, setSelectedOrderSetId] = useState<string>("none");
  const [checkedMeds, setCheckedMeds] = useState<Record<number, boolean>>({});
  const [checkedLabs, setCheckedLabs] = useState<Record<number, boolean>>({});
  const [checkedRadiology, setCheckedRadiology] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<"medications" | "labs" | "radiology">("medications");

  const handleOrderSetChange = (orderSetId: string) => {
    setSelectedOrderSetId(orderSetId);
    if (orderSetId === "none") {
      setCheckedMeds({});
      setCheckedLabs({});
      setCheckedRadiology({});
      return;
    }

    const orderSet = ORDER_SETS.find((os) => os.id === orderSetId);
    if (orderSet) {
      const initialMeds: Record<number, boolean> = {};
      orderSet.medications.forEach((_, idx) => {
        initialMeds[idx] = true;
      });

      const initialLabs: Record<number, boolean> = {};
      orderSet.labs.forEach((_, idx) => {
        initialLabs[idx] = true;
      });

      const initialRadiology: Record<number, boolean> = {};
      orderSet.radiology.forEach((_, idx) => {
        initialRadiology[idx] = true;
      });

      setCheckedMeds(initialMeds);
      setCheckedLabs(initialLabs);
      setCheckedRadiology(initialRadiology);
    }
  };

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!diagnosis.trim()) {
      setError(isRtl ? "تنبيه: التشخيص الطبي حقل إلزامي لتوثيق اللقاء السريري." : "Clinical Error: Medical Diagnosis is required to finalize the record.");
      return;
    }

    startTransition(async () => {
      try {
        const activeOrderSet = ORDER_SETS.find((os) => os.id === selectedOrderSetId);
        
        const orderSetMedications = activeOrderSet && selectedOrderSetId !== "none"
          ? activeOrderSet.medications.filter((_, idx) => checkedMeds[idx])
          : undefined;

        const orderSetLabs = activeOrderSet && selectedOrderSetId !== "none"
          ? activeOrderSet.labs.filter((_, idx) => checkedLabs[idx])
          : undefined;

        const orderSetRadiology = activeOrderSet && selectedOrderSetId !== "none"
          ? activeOrderSet.radiology.filter((_, idx) => checkedRadiology[idx])
          : undefined;

        const payload = {
          patientId: patient.id,
          encounterType,
          symptoms: symptoms.trim() || undefined,
          diagnosis: diagnosis.trim(),
          soapNotes: soapNotes.trim() || undefined,
          icdCodes: icdCodes.length > 0 ? icdCodes : undefined,
          vitals: {
            bloodPressureSystolic: bpSystolic ? parseInt(bpSystolic) : undefined,
            bloodPressureDiastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
            heartRate: heartRate ? parseInt(heartRate) : undefined,
            respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
            temperature: temperature.trim() || undefined,
            oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : undefined,
            weightKg: weightKg.trim() || undefined,
            heightCm: heightCm ? parseInt(heightCm) : undefined,
          },
          locale,
          appliedOrderSetId: selectedOrderSetId !== "none" ? selectedOrderSetId : undefined,
          orderSetMedications,
          orderSetLabs,
          orderSetRadiology,
        };

        const res = await createMedicalRecord(payload);

        if (res.success) {
          setSuccess(true);
          setTimeout(() => {
            router.push(`/${locale}/${hospitalSlug}/patients/${patient.id}`);
          }, 1500);
        } else {
          setError(("error" in res ? res.error : null) || "An unexpected error occurred.");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to submit clinical encounter.");
      }
    });
  };

  const patientName = isRtl ? patient.nameAr : patient.nameEn;

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-start" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Dynamic Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/${hospitalSlug}/patients/${patient.id}`)}
            className="p-2.5 rounded-xl border border-border/40 hover:bg-muted bg-background/50 text-muted-foreground hover:text-foreground transition-all duration-200"
            title={t("backToProfile")}
          >
            <BackIcon className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary" />
              <span>{t("newVisitNotes")}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
              {isRtl ? "تسجيل فحص طبي وصفي شامل وربطه بـ ICD-10 للتعامل الموحد." : "Record complete subjective symptoms, objective vitals, and coded ICD-10 diagnostic plans."}
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-mono font-black py-1 px-3 bg-primary/5 text-primary border-primary/25 rounded-xl">
          {patient.patientNumber}
        </Badge>
      </div>

      {/* Patient Demographic Context Strip */}
      <Card className="border border-border/30 bg-muted/20 rounded-2xl overflow-hidden shadow-xs">
        <CardContent className="p-4 flex flex-wrap gap-x-8 gap-y-2 items-center text-xs font-bold text-foreground/80">
          <span>{isRtl ? "المريض:" : "Patient:"} <span className="text-primary font-black text-sm">{patientName}</span></span>
          <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0 hidden md:block" />
          <span>{isRtl ? "الجنس:" : "Gender:"} <span className="font-black text-foreground">{patient.gender === "male" ? t("male") : t("female")}</span></span>
          <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0 hidden md:block" />
          <span>{isRtl ? "تاريخ الميلاد:" : "Date of Birth:"} <span className="font-mono text-foreground">{new Date(patient.dob).toLocaleDateString()}</span></span>
        </CardContent>
      </Card>

      {/* Error & Success States */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-bold animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 text-center flex flex-col items-center justify-center gap-2 shadow-sm animate-in zoom-in-95 duration-300">
          <CheckCircle2 className="w-10 h-10 animate-bounce text-emerald-500" />
          <h3 className="text-sm font-black">{isRtl ? "تم حفظ اللقاء الطبي والزيارة بنجاح!" : "Clinical Visit Notes Finalized Successfully!"}</h3>
          <p className="text-xs text-emerald-600/70">{isRtl ? "جاري إعادة توجيهك لملف المريض..." : "Redirecting back to patient digital profile..."}</p>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Clinical SOAP Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border/40 bg-card rounded-3xl shadow-md overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
              <CardContent className="p-6 sm:p-8 space-y-6">
                
                {/* A. Encounter Type Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-foreground/80">
                      {t("encounterType")}
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40 border border-border/20">
                      {[
                        { id: "outpatient", label: t("outpatient") },
                        { id: "inpatient", label: t("inpatient") },
                        { id: "emergency", label: t("emergency") }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEncounterType(item.id as "outpatient" | "inpatient" | "emergency")}
                          className={cn(
                            "py-2 px-3 rounded-lg text-xs font-black transition-all duration-200 whitespace-nowrap",
                            encounterType === item.id 
                              ? "bg-background text-primary shadow-xs font-black border border-border/20" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* B. Subjective & Symptoms Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span>{t("symptoms")}</span>
                  </label>
                  <Textarea
                    placeholder={isRtl 
                      ? "اكتب الأعراض التي يشتكي منها المريض بالتفصيل (مثل: صداع مستمر، آلام بالبطن منذ يومين...)" 
                      : "Describe the patient's subjective symptoms and chief complaints..."}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    className="bg-background/50 border-border/50 text-xs font-semibold focus:ring-primary/20 transition-all rounded-xl"
                  />
                </div>

                {/* C. Medical Diagnosis & Assessment */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                    <FileEdit className="w-4 h-4 text-accent" />
                    <span>{t("diagnosis")} <span className="text-destructive">*</span></span>
                  </label>
                  <Input
                    placeholder={isRtl ? "التشخيص الطبي الأولي أو النهائي..." : "Primary medical diagnosis or assessment..."}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="h-11 bg-background/50 border-border/50 text-xs font-bold focus:ring-primary/20 transition-all rounded-xl"
                  />
                </div>

                {/* D. Local ICD-10 Picker */}
                <Icd10SearchPicker
                  selectedCodes={icdCodes}
                  onChange={setIcdCodes}
                  locale={locale}
                />

                {/* E. Detailed SOAP notes / Clinical Exam & Plan */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <span>{t("soapNotes")}</span>
                  </label>
                  <Textarea
                    placeholder={isRtl 
                      ? "تفاصيل الفحص السريري، النتائج الإكلينيكية، الخطة العلاجية والدوائية المقترحة للمريض..." 
                      : "Document detailed objective exam results and therapeutic plan..."}
                    value={soapNotes}
                    onChange={(e) => setSoapNotes(e.target.value)}
                    rows={5}
                    className="bg-background/50 border-border/50 text-xs font-semibold focus:ring-primary/20 transition-all rounded-xl"
                  />
                </div>

              </CardContent>
            </Card>

            {/* F. Clinical Order Sets Application Workstation */}
            <Card className="border border-border/40 bg-card rounded-3xl shadow-md overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-2.5">
                  <FolderHeart className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-black text-foreground">{t("orderSets")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-semibold text-start">
                      {t("orderSetDescription")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="relative">
                    <select
                      value={selectedOrderSetId}
                      onChange={(e) => handleOrderSetChange(e.target.value)}
                      className="h-11 w-full bg-background border border-border/40 hover:border-border/80 focus:border-indigo-500/50 text-xs font-bold rounded-xl px-4 outline-none transition-all appearance-none cursor-pointer text-start pr-10"
                    >
                      <option value="none">{t("none")}</option>
                      {ORDER_SETS.map((os) => (
                        <option key={os.id} value={os.id}>
                          {isRtl ? os.nameAr : os.nameEn}
                        </option>
                      ))}
                    </select>
                    <div className={cn(
                      "absolute inset-y-0 flex items-center px-3 pointer-events-none text-muted-foreground",
                      isRtl ? "left-0" : "right-0"
                    )}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {selectedOrderSetId !== "none" && (() => {
                  const activeSet = ORDER_SETS.find((os) => os.id === selectedOrderSetId);
                  if (!activeSet) return null;

                  const medsCount = activeSet.medications.length;
                  const labsCount = activeSet.labs.length;
                  const radCount = activeSet.radiology.length;

                  const checkedMedsCount = activeSet.medications.filter((_, i) => checkedMeds[i]).length;
                  const checkedLabsCount = activeSet.labs.filter((_, i) => checkedLabs[i]).length;
                  const checkedRadCount = activeSet.radiology.filter((_, i) => checkedRadiology[i]).length;

                  return (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Bilingual Description Badge */}
                      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs font-semibold leading-relaxed text-indigo-950 dark:text-indigo-200 text-start">
                        {isRtl ? activeSet.descriptionAr : activeSet.descriptionEn}
                      </div>

                      {/* Luxury Segmented Tabs */}
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40 border border-border/20">
                        <button
                          type="button"
                          onClick={() => setActiveTab("medications")}
                          className={cn(
                            "py-2.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer",
                            activeTab === "medications"
                              ? "bg-background text-indigo-500 shadow-xs border border-indigo-500/15"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Pill className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">{isRtl ? "الأدوية" : "Meds"}</span>
                          <Badge variant="outline" className={cn(
                            "px-1.5 py-0.25 text-[10px] rounded-md font-bold",
                            activeTab === "medications" ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-muted/80 text-muted-foreground border-transparent"
                          )}>
                            {checkedMedsCount}/{medsCount}
                          </Badge>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab("labs")}
                          className={cn(
                            "py-2.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer",
                            activeTab === "labs"
                              ? "bg-background text-purple-500 shadow-xs border border-purple-500/15"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <FlaskConical className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">{isRtl ? "التحاليل" : "Labs"}</span>
                          <Badge variant="outline" className={cn(
                            "px-1.5 py-0.25 text-[10px] rounded-md font-bold",
                            activeTab === "labs" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-muted/80 text-muted-foreground border-transparent"
                          )}>
                            {checkedLabsCount}/{labsCount}
                          </Badge>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab("radiology")}
                          className={cn(
                            "py-2.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer",
                            activeTab === "radiology"
                              ? "bg-background text-pink-500 shadow-xs border border-pink-500/15"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <FileImage className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">{isRtl ? "الأشعة" : "Radiology"}</span>
                          <Badge variant="outline" className={cn(
                            "px-1.5 py-0.25 text-[10px] rounded-md font-bold",
                            activeTab === "radiology" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-muted/80 text-muted-foreground border-transparent"
                          )}>
                            {checkedRadCount}/{radCount}
                          </Badge>
                        </button>
                      </div>

                      {/* Tab Contents */}
                      <div className="space-y-3 min-h-[160px] p-2 bg-muted/10 rounded-2xl border border-border/10 max-h-[350px] overflow-y-auto">
                        {activeTab === "medications" && (
                          activeSet.medications.length === 0 ? (
                            <div className="py-10 text-center text-xs font-semibold text-muted-foreground">
                              {isRtl ? "لا توجد أدوية موصى بها في هذا البروتوكول." : "No recommended medications in this protocol."}
                            </div>
                          ) : (
                            activeSet.medications.map((item, idx) => {
                              const isChecked = !!checkedMeds[idx];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setCheckedMeds(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  className={cn(
                                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
                                    isChecked
                                      ? "bg-background border-indigo-500/25 shadow-xs"
                                      : "bg-background/40 border-border/20 opacity-60 hover:opacity-85"
                                  )}
                                >
                                  <div className="mt-0.5 text-indigo-500 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-4.5 h-4.5" />
                                    ) : (
                                      <Square className="w-4.5 h-4.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1 text-start">
                                    <h4 className="text-xs font-black text-foreground">
                                      {isRtl ? item.nameAr : item.nameEn}
                                    </h4>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-muted-foreground">
                                      <span className="px-1.5 py-0.25 bg-muted rounded-md text-foreground">{item.strength}</span>
                                      <span className="px-1.5 py-0.25 bg-muted rounded-md text-foreground">{item.form}</span>
                                      <span>{t("dosage")}: {item.dosage}</span>
                                      <span>•</span>
                                      <span>{t("frequency")}: {item.frequency}</span>
                                      <span>•</span>
                                      <span>{t("duration")}: {item.durationDays} {t("days")}</span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-indigo-600/70 dark:text-indigo-400/70 italic mt-1 leading-snug">
                                      {item.instructions}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )
                        )}

                        {activeTab === "labs" && (
                          activeSet.labs.length === 0 ? (
                            <div className="py-10 text-center text-xs font-semibold text-muted-foreground">
                              {isRtl ? "لا توجد تحاليل طبية مطلوبة في هذا البروتوكول." : "No required laboratory tests in this protocol."}
                            </div>
                          ) : (
                            activeSet.labs.map((item, idx) => {
                              const isChecked = !!checkedLabs[idx];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setCheckedLabs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  className={cn(
                                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
                                    isChecked
                                      ? "bg-background border-purple-500/25 shadow-xs"
                                      : "bg-background/40 border-border/20 opacity-60 hover:opacity-85"
                                  )}
                                >
                                  <div className="mt-0.5 text-purple-500 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-4.5 h-4.5" />
                                    ) : (
                                      <Square className="w-4.5 h-4.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1 text-start">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <h4 className="text-xs font-black text-foreground">
                                        {isRtl ? item.nameAr : item.nameEn}
                                      </h4>
                                      <Badge className={cn(
                                        "text-[9px] font-black uppercase py-0 px-1.5 rounded-md border",
                                        item.priority === "stat" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                        item.priority === "urgent" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                        "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                      )}>
                                        {t(item.priority)}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-muted-foreground">
                                      <span className="font-mono bg-muted/80 px-1 py-0.25 rounded-md">LOINC: {item.loincCode}</span>
                                      <span className="font-mono bg-muted/80 px-1 py-0.25 rounded-md">CPT: {item.cptCode}</span>
                                      <span>Range: {item.normalRange} ({item.unit})</span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-purple-600/70 dark:text-purple-400/70 italic mt-1 leading-snug">
                                      {item.instructions}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )
                        )}

                        {activeTab === "radiology" && (
                          activeSet.radiology.length === 0 ? (
                            <div className="py-10 text-center text-xs font-semibold text-muted-foreground">
                              {isRtl ? "لا توجد فحوصات أشعة مطلوبة في هذا البروتوكول." : "No required radiology procedures in this protocol."}
                            </div>
                          ) : (
                            activeSet.radiology.map((item, idx) => {
                              const isChecked = !!checkedRadiology[idx];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setCheckedRadiology(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  className={cn(
                                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
                                    isChecked
                                      ? "bg-background border-pink-500/25 shadow-xs"
                                      : "bg-background/40 border-border/20 opacity-60 hover:opacity-85"
                                  )}
                                >
                                  <div className="mt-0.5 text-pink-500 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-4.5 h-4.5" />
                                    ) : (
                                      <Square className="w-4.5 h-4.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1 text-start">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <h4 className="text-xs font-black text-foreground">
                                        {isRtl ? item.procedureNameAr : item.procedureNameEn}
                                      </h4>
                                      <Badge className={cn(
                                        "text-[9px] font-black uppercase py-0 px-1.5 rounded-md border",
                                        item.priority === "stat" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                        item.priority === "urgent" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                        "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                      )}>
                                        {t(item.priority)}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-muted-foreground">
                                      <span className="font-mono bg-muted/80 px-1 py-0.25 rounded-md">CPT: {item.cptCode}</span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-pink-600/70 dark:text-pink-400/70 italic mt-1 leading-snug">
                                      {item.clinicalNotes}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )
                        )}
                      </div>

                      {/* Cumulative summary confirmation banner */}
                      {(checkedMedsCount > 0 || checkedLabsCount > 0 || checkedRadCount > 0) && (
                        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-300 leading-snug flex items-start gap-2.5 animate-in zoom-in-95 duration-200">
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="space-y-1 text-start">
                            <span className="block font-black">{t("willApplyOrdersSummary")}</span>
                            <div className="flex flex-wrap gap-3 mt-1.5 font-bold">
                              {checkedMedsCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                  {checkedMedsCount} {isRtl ? "أدوية" : "Medications"}
                                </Badge>
                              )}
                              {checkedLabsCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                  {checkedLabsCount} {isRtl ? "فحوصات معملية" : "Labs"}
                                </Badge>
                              )}
                              {checkedRadCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                  {checkedRadCount} {isRtl ? "أشعة تشخيصية" : "Radiology"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}

              </CardContent>
            </Card>
          </div>

          {/* Accompanying Vitals Flows Panel */}
          <div className="space-y-6">
            <Card className="border border-border/40 bg-card rounded-3xl shadow-md overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              <CardContent className="p-6 space-y-5">
                
                <h3 className="text-sm font-black text-foreground flex items-center gap-2 border-b pb-3.5 border-border/30">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span>{t("vitals")}</span>
                </h3>

                <div className="space-y-4 text-xs font-bold text-foreground/80">
                  
                  {/* Blood Pressure Systolic / Diastolic */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold">{t("bp")} (mmHg)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Sys"
                        value={bpSystolic}
                        onChange={(e) => setBpSystolic(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Dia"
                        value={bpDiastolic}
                        onChange={(e) => setBpDiastolic(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* Heart Rate & Respiratory Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{t("pulse")} (bpm)</span>
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 72"
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold">{t("respiratory")} (/min)</label>
                      <Input
                        type="number"
                        placeholder="e.g. 18"
                        value={respiratoryRate}
                        onChange={(e) => setRespiratoryRate(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* Temperature & SpO2 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{t("temp")} (°C)</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 37.0"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{t("spo2")} (%)</span>
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 98"
                        value={oxygenSaturation}
                        onChange={(e) => setOxygenSaturation(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* Weight & Height */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{t("weight")} (kg)</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 72.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{t("height")} (cm)</span>
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 175"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className="h-10 text-center font-mono font-bold bg-background/50 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                </div>

              </CardContent>
            </Card>

            {/* Action Finalization Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => router.push(`/${locale}/${hospitalSlug}/patients/${patient.id}`)}
                className="flex-1 h-12 rounded-2xl border-border/40 text-xs font-bold font-black bg-background/50 hover:bg-muted"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 h-12 rounded-2xl text-xs font-black shadow-md bg-gradient-to-r from-primary to-primary/90 text-primary-foreground flex gap-2 items-center justify-center cursor-pointer hover:opacity-95 transition-opacity"
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{t("submitRecord")}</span>
              </Button>
            </div>
          </div>

        </form>
      )}

    </div>
  );
}
