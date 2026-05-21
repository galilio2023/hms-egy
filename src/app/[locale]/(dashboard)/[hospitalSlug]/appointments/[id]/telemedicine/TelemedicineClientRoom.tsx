"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tafqeet } from "@/lib/utils/tafqeet";
import { 
  Video, 
  Clock, 
  User, 
  Activity, 
  FileText, 
  Heart, 
  Shield, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  Stethoscope, 
  ChevronRight, 
  ChevronLeft,
  XCircle,
  TrendingUp,
  AlertCircle,
  Pill
} from "lucide-react";
import { cn } from "@/lib/utils";
import { completeTelemedicineConsultation } from "@/lib/actions/clinical";

// Memoize the Jitsi player to prevent DOM tear-downs on local state updates
const JitsiStream = React.memo(({ url }: { url: string }) => (
  <iframe
    src={url}
    allow="camera; microphone; fullscreen; display-capture"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    className="w-full h-full border-none rounded-2xl flex-1 bg-slate-950"
  />
));
JitsiStream.displayName = "JitsiStream";

interface MedicationProp {
  id: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  form: string;
  strength: string;
  price: number;
}

interface TelemedicineClientRoomProps {
  appointment: {
    id: string;
    patientId: string;
    patientNameAr: string;
    patientNameEn: string;
    patientNumber: string;
    patientPhone: string;
    patientDob: Date | string | null;
    patientGender: string;
    patientNationalId: string | null;
    doctorId: string;
    doctorNameAr: string;
    doctorNameEn: string;
    departmentId: string;
    departmentNameAr: string;
    departmentNameEn: string;
    notes: string | null;
  };
  medications: MedicationProp[];
  hospitalSlug: string;
  locale: string;
  secureRoomName: string;
}

interface PrescriptionItem {
  medicationId: string;
  nameEn: string;
  nameAr: string;
  form: string;
  strength: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
  price: number;
}

export function TelemedicineClientRoom({
  appointment,
  medications,
  hospitalSlug,
  locale,
  secureRoomName,
}: TelemedicineClientRoomProps) {
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Call timers
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallStatus] = useState(true);

  // Tabs state: "soap" | "prescription" | "vitals" | "history"
  const [activeTab, setActiveTab] = useState<"soap" | "prescription" | "vitals">("soap");

  // SOAP State
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // Prescription State
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [selectedMedId, setSelectedMedId] = useState("");
  const [prescriptionNotes, setPrescriptionNotes] = useState("");

  // Dynamic Prescription Inputs
  const [curDosage, setCurDosage] = useState("1 tablet");
  const [curFrequency, setCurFrequency] = useState("3 times daily");
  const [curDuration, setCurDuration] = useState(7);
  const [curInstructions, setCurInstructions] = useState("After meals");

  // Vitals state
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // Jitsi Room URL
  const jitsiRoomName = secureRoomName;
  const jitsiIframeUrl = `https://meet.jit.si/${jitsiRoomName}#config.startWithAudioMuted=true&config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","closedcaptions","desktop","fullscreen","factions","hangup","profile","chat","raisehand","videoquality","tileview"]`;

  // Start call timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Add prescription item
  const handleAddMedication = () => {
    if (!selectedMedId) return;
    const med = medications.find((m) => m.id === selectedMedId);
    if (!med) return;

    // Check duplicate
    if (prescriptionItems.some((item) => item.medicationId === med.id)) {
      toast.error(isRtl ? "هذا الدواء مضاف بالفعل للروشتة." : "This medication is already on the prescription.");
      return;
    }

    const newItem: PrescriptionItem = {
      medicationId: med.id,
      nameEn: med.nameEn,
      nameAr: med.nameAr,
      form: med.form,
      strength: med.strength,
      dosage: curDosage,
      frequency: curFrequency,
      durationDays: curDuration,
      instructions: curInstructions,
      price: med.price,
    };

    setPrescriptionItems((prev) => [...prev, newItem]);
    setSelectedMedId("");
    // Reset defaults
    setCurDosage("1 tablet");
    setCurFrequency("3 times daily");
    setCurDuration(7);
    setCurInstructions("After meals");
    toast.success(isRtl ? "تم إضافة الدواء للوصفة" : "Medication added to prescription");
  };

  const handleRemoveItem = (medId: string) => {
    setPrescriptionItems((prev) => prev.filter((item) => item.medicationId !== medId));
  };

  // Calculate prescription estimated cost
  const getPrescriptionCost = () => {
    const total = prescriptionItems.reduce((acc, cur) => acc + cur.price, 0);
    const textAr = total > 0 ? tafqeet(Math.round(total)) : "";
    return { total, textAr };
  };

  const costInfo = getPrescriptionCost();

  // Clinical note templates helper
  const applySoapTemplate = (type: "normal" | "cardio" | "pediatric") => {
    if (type === "normal") {
      setSubjective(isRtl ? "المريض يشكو من إجهاد عام وصداع طفيف. لا توجد آلام حادة." : "Patient reports mild fatigue and mild headache. No acute severe pain.");
      setObjective(isRtl ? "درجة الحرارة وضغط الدم ضمن المعدلات الطبيعية. الحلق سليم." : "BP and Temp within normal limits. Throat clear, chest clear on auscultation.");
      setAssessment(isRtl ? "صداع إجهادي بسيط (Tension Headache)." : "Tension headache due to fatigue.");
      setPlan(isRtl ? "الراحة الكافية، زيادة شرب السوائل، ومسكن عند اللزوم." : "Adequate rest, hydration, and analgesics as needed.");
      setDiagnosis(isRtl ? "صداع بسبب الإجهاد" : "Tension Headache");
    } else if (type === "cardio") {
      setSubjective(isRtl ? "شكوى من تسارع خفيف في ضربات القلب عند بذل مجهود بسيط." : "Complains of mild exertional palpitation.");
      setObjective(isRtl ? "نبض منتظم، أصوات القلب طبيعية، لا توجد وذمة في الأطراف." : "Regular rhythm, normal S1/S2, no lower limb edema.");
      setAssessment(isRtl ? "خفقان بسيط غير محدد السبب." : "Mild exertional palpitations, R/O arrhythmia.");
      setPlan(isRtl ? "إجراء رسم قلب، تقليل الكافيين، ومراجعة النتائج خلال أسبوع." : "ECG requested, restrict caffeine, follow-up in 1 week.");
      setDiagnosis(isRtl ? "خفقان عارض" : "Mild Palpitation");
    }
    toast.success(isRtl ? "تم تطبيق القالب السريري بنجاح" : "Clinical template applied successfully");
  };

  // Submit complete consultation
  const handleCompleteConsultation = () => {
    if (!subjective && !objective && !assessment && !plan) {
      toast.error(isRtl ? "يرجى تعبئة سجل SOAP الطبي أولاً قبل إغلاق الاستشارة." : "Please enter clinical SOAP notes before completing.");
      return;
    }

    const compiledSoap = `
[Subjective]
${subjective}

[Objective]
${objective}

[Assessment]
${assessment}

[Plan]
${plan}
    `.trim();

    const formattedVitals = {
      bloodPressureSystolic: systolic ? parseInt(systolic) : undefined,
      bloodPressureDiastolic: diastolic ? parseInt(diastolic) : undefined,
      heartRate: heartRate ? parseInt(heartRate) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      temperature: temperature ? temperature : undefined,
      oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : undefined,
      weightKg: weight ? weight : undefined,
      heightCm: height ? parseInt(height) : undefined,
    };

    const formattedPrescriptions = prescriptionItems.map((item) => ({
      medicationId: item.medicationId,
      dosage: item.dosage,
      frequency: item.frequency,
      durationDays: item.durationDays,
      instructions: item.instructions,
    }));

    startTransition(async () => {
      const res = await completeTelemedicineConsultation(
        appointment.id,
        compiledSoap,
        diagnosis || "Telemedicine Consult Completed",
        formattedPrescriptions,
        prescriptionNotes || undefined,
        formattedVitals,
        locale
      );

      if (res.success) {
        toast.success(isRtl ? "تم إنهاء الاستشارة وحفظ الملف الطبي للمريض بنجاح!" : "Telemedicine session completed and medical files saved successfully!");
        router.push(`/${hospitalSlug}/appointments`);
        router.refresh();
      } else {
        const errorMsg = "error" in res ? res.error : undefined;
        toast.error(errorMsg || (isRtl ? "حدث خطأ أثناء حفظ الملف." : "Failed to save consultation records."));
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100 rounded-2xl border border-slate-800/80 shadow-2xl">
      {/* 1. Header Status Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 text-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <Badge variant="outline" className="border-rose-500/20 bg-rose-500/5 text-rose-400 font-mono text-[10px] uppercase font-bold tracking-wider">
              {isRtl ? "بث مرئي آمن مباشر" : "LIVE SECURE CONSULT"}
            </Badge>
            <span className="text-slate-500 font-bold text-xs font-mono">|</span>
            <span className="text-slate-400 font-mono text-xs flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-accent" />
              {formatTimer(callDuration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-black text-slate-100">
              {isRtl ? appointment.patientNameAr : appointment.patientNameEn}
            </h1>
            <span className="text-slate-600 font-bold">#</span>
            <span className="text-xs font-mono text-slate-400 font-bold">#{appointment.patientNumber}</span>
            <span className="text-slate-600 font-bold">·</span>
            <span className="text-xs text-slate-400 font-medium">
              {isRtl ? appointment.departmentNameAr : appointment.departmentNameEn}
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex gap-2 items-center w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(isRtl ? "هل أنت متأكد من الخروج من هذه الاستشارة دون حفظ؟" : "Are you sure you want to leave without saving clinical progress?")) {
                router.push(`/${hospitalSlug}/appointments`);
              }
            }}
            className="text-xs font-bold text-slate-400 border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:text-slate-100"
          >
            {isRtl ? "خروج دون حفظ" : "Exit Without Saving"}
          </Button>

          <Button
            size="sm"
            onClick={handleCompleteConsultation}
            disabled={isPending}
            className="text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 gap-1.5 shadow-lg shadow-emerald-950/20"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isRtl ? "إنهاء الاستشارة وحفظ السجل" : "Complete & Save Consult"}</span>
          </Button>
        </div>
      </header>

      {/* 2. Main Work Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-950">
        
        {/* Left Side: Jitsi Meet Integration (60%) */}
        <div className="lg:col-span-7 flex flex-col p-4 overflow-hidden h-full">
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/40 shadow-inner flex flex-col">
            {callConnected ? (
              <JitsiStream url={jitsiIframeUrl} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <Video className="h-12 w-12 text-slate-600 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-300">{isRtl ? "انقطع اتصال البث المرئي" : "Video stream paused"}</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {isRtl ? "انقر بالأسفل لإعادة تهيئة غرفة الاستشارة المشفرة." : "Click below to initialize the secure outpatient consult room."}
                  </p>
                </div>
                <Button size="sm" onClick={() => setCallStatus(true)} className="bg-accent text-accent-foreground">{isRtl ? "إعادة الاتصال" : "Reconnect"}</Button>
              </div>
            )}

            {/* Bottom patient complaint overlay block */}
            {appointment.notes && (
              <div className="absolute bottom-4 start-4 end-4 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl text-xs space-y-1 text-start shadow-xl">
                <span className="text-[10px] text-accent font-black uppercase tracking-wide block">
                  {isRtl ? "الشكوى المقدمة عند الحجز" : "Initial Symptom Description"}
                </span>
                <p className="text-slate-300 italic font-medium leading-relaxed">"{appointment.notes}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Clinical Logging Sidebar (40%) */}
        <div className="lg:col-span-5 border-s border-slate-800 bg-slate-900/40 flex flex-col h-full overflow-hidden text-start">
          
          {/* Tab bar navigation */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900 shrink-0">
            {[
              { id: "soap" as const, name: isRtl ? "سجل SOAP" : "SOAP Notes", icon: FileText },
              { id: "prescription" as const, name: isRtl ? "روشتة علاجية" : "Prescription", icon: Pill },
              { id: "vitals" as const, name: isRtl ? "العلامات الحيوية" : "Patient Vitals", icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "py-3.5 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs font-black border-b-2 transition-all",
                    activeTab === tab.id
                      ? "border-accent text-accent bg-accent/2"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Tab Body panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">

            {/* TAB 1: SOAP CLINICAL NOTE */}
            {activeTab === "soap" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Stethoscope className="h-4 w-4 text-accent" />
                    {isRtl ? "تدوين الملاحظات السريرية المنهجية" : "Systemic SOAP Outpatient Note"}
                  </h3>

                  {/* Templates Quick Actions */}
                  <div className="flex gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => applySoapTemplate("normal")}
                      className="text-[9px] h-7 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      {isRtl ? "قالب عام" : "General Temp"}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => applySoapTemplate("cardio")}
                      className="text-[9px] h-7 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      {isRtl ? "قالب قلبي" : "Cardio Temp"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Diagnosis */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">
                      {isRtl ? "التشخيص الأولي / ICD-10" : "Encounter Diagnosis (Free text)"}
                    </label>
                    <Input
                      placeholder={isRtl ? "اكتب التشخيص الطبي الرئيسي للزيارة..." : "Enter primary clinical diagnosis..."}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-9 text-xs focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Subjective */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-wide block">
                      {isRtl ? "Subjective (S) - الشكوى والأعراض" : "Subjective (S) - Patient complaints"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "وصف المريض لحالته، تاريخ الشكوى، الأعراض المسرودة..." : "Symptoms, patient's description of illness, history of present illness..."}
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs min-h-[75px] focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Objective */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-wide block">
                      {isRtl ? "Objective (O) - الفحص السريري والملاحظات" : "Objective (O) - Clinical observation & exams"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "الملاحظات العيادية البصرية، علامات المرض، التسمع..." : "Visual observations, general physical examinations, chest auscultation findings..."}
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs min-h-[75px] focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Assessment */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-500 uppercase tracking-wide block">
                      {isRtl ? "Assessment (A) - التقييم الطبي والتحليل" : "Assessment (A) - Medical evaluation"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "الاستنتاج الطبي، تطور الحالة مقارنة بالسابق، درجة الخطورة..." : "Medical reasoning, severity, clinical progress, differential diagnoses..."}
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs min-h-[75px] focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Plan */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-accent uppercase tracking-wide block">
                      {isRtl ? "Plan (P) - الخطة العلاجية والمتابعة" : "Plan (P) - Treatment & Follow-up layout"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "التوصيات العامة، الفحوصات أو التحاليل المطلوبة، مواعيد المراجعة..." : "Next steps, laboratory/imaging referrals, lifestyle guidance, follow-up calendar..."}
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs min-h-[75px] focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: E-PRESCRIPTION PAD */}
            {activeTab === "prescription" && (
              <div className="space-y-5">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Pill className="h-4 w-4 text-accent" />
                  {isRtl ? "تحرير الوصفة الدوائية الإلكترونية" : "E-Prescription & Medication Pad"}
                </h3>

                {/* Form to Select & Configure New Drug */}
                <Card className="border border-slate-800 bg-slate-900/60 shadow-xs">
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "اختر الدواء من الصيدلية" : "Select Available Medication"}</label>
                      <select
                        dir={isRtl ? "rtl" : "ltr"}
                        value={selectedMedId}
                        onChange={(e) => setSelectedMedId(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs shadow-sm transition-colors text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      >
                        <option value="" className="text-start">{isRtl ? "ابحث عن دواء بالاسم التجاري أو العلمي..." : "Search commercial/generic drug..."}</option>
                        {medications.map((med) => (
                          <option key={med.id} value={med.id}>
                            {med.nameEn} ({med.strength} - {med.form}) - {med.price} EGP
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الجرعة المقررة" : "Dosage"}</label>
                        <Input
                          value={curDosage}
                          onChange={(e) => setCurDosage(e.target.value)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "التكرار / التواتر" : "Frequency"}</label>
                        <Input
                          value={curFrequency}
                          onChange={(e) => setCurFrequency(e.target.value)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "مدة العلاج (بالأيام)" : "Duration (Days)"}</label>
                        <Input
                          type="number"
                          value={curDuration}
                          onChange={(e) => setCurDuration(parseInt(e.target.value) || 1)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "إرشادات الاستخدام" : "Instructions"}</label>
                        <Input
                          value={curInstructions}
                          onChange={(e) => setCurInstructions(e.target.value)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleAddMedication}
                      disabled={!selectedMedId}
                      className="w-full text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 mt-2 h-8"
                    >
                      <Plus className="h-4 w-4 me-1" />
                      {isRtl ? "إدراج العلاج في الروشتة" : "Append Medication to Rx"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Prescription Pad Draft list */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {isRtl ? "المسودة العلاجية الحالية" : "Current Prescription Lines"}
                  </h4>

                  {prescriptionItems.length === 0 ? (
                    <div className="p-6 border border-dashed border-slate-800 text-center text-xs text-slate-500 italic rounded-xl">
                      {isRtl ? "لم يتم إضافة أي أدوية بعد." : "No medications assigned to this prescription yet."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prescriptionItems.map((item) => (
                        <div key={item.medicationId} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-accent/10 border-accent/20 text-accent font-bold text-[9px] uppercase">
                                {item.form}
                              </Badge>
                              <span className="font-black text-slate-100">{item.nameEn}</span>
                              <span className="text-slate-500 text-[10px]">({item.strength})</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {item.dosage} · {item.frequency} · {item.durationDays} {isRtl ? "أيام" : "days"}
                            </div>
                            {item.instructions && (
                              <div className="text-[9px] text-slate-500 italic font-semibold">
                                * {item.instructions}
                              </div>
                            )}
                          </div>

                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleRemoveItem(item.medicationId)}
                            className="border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 shrink-0 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}

                      {/* Co-pay and financial estimate for Pharmacy dispensing */}
                      <Card className="border border-slate-800 bg-slate-900/40 mt-4 relative overflow-hidden">
                        <CardContent className="p-4 space-y-2 text-xs">
                          <div className="flex justify-between font-bold text-slate-400">
                            <span>{isRtl ? "رسوم الأدوية المقدرة بالصيدلية" : "Estimated Rx Price at Dispensary"}</span>
                            <span className="font-mono text-slate-100">{costInfo.total}.00 EGP</span>
                          </div>
                          {costInfo.total > 0 && (
                            isRtl ? (
                              <div className="text-[10px] text-slate-500 font-bold text-start" dir="rtl">
                                فقط وقدره: {costInfo.textAr} جنيه مصري لا غير
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-bold text-start">
                                Equivalent to: {costInfo.total}.00 Egyptian Pounds
                              </div>
                            )
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Prescription Notes */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">
                      {isRtl ? "تعليمات عامة للوصفة الطبية" : "General Prescription Advisory"}
                    </label>
                    <Input
                      placeholder={isRtl ? "مثال: مراجعة العيادة في حال تكرار الألم..." : "e.g. Return if symptoms worsen..."}
                      value={prescriptionNotes}
                      onChange={(e) => setPrescriptionNotes(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-9 text-xs focus:border-accent text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PATIENT INFO & VITALS */}
            {activeTab === "vitals" && (
              <div className="space-y-5">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-4 w-4 text-accent" />
                  {isRtl ? "تسجيل وفحص العلامات الحيوية الحالية" : "Record & Monitor Vital Signs"}
                </h3>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {isRtl
                    ? "أدخل القياسات الحيوية الحالية للمريض لتسجيلها في ملف المتابعة والتدفق التاريخي للعلامات الحيوية."
                    : "Log patient's current clinical vital metrics directly to populate their flowsheet history."}
                </p>

                {/* Grid inputs for vitals */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Systolic */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الضغط الانقباضي (مم زئبق)" : "BP Systolic (mmHg)"}</label>
                    <Input
                      type="number"
                      placeholder="120"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Diastolic */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الضغط الانبساطي (مم زئبق)" : "BP Diastolic (mmHg)"}</label>
                    <Input
                      type="number"
                      placeholder="80"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Heart Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "نبض القلب (نبضة/دقيقة)" : "Heart Rate (bpm)"}</label>
                    <Input
                      type="number"
                      placeholder="72"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الحرارة (°م)" : "Temperature (°C)"}</label>
                    <Input
                      placeholder="37.0"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* SpO2 */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "درجة تشبع الأكسجين (%)" : "Oxygen Saturation (%)"}</label>
                    <Input
                      type="number"
                      placeholder="98"
                      value={oxygenSaturation}
                      onChange={(e) => setOxygenSaturation(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Resp Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "معدل التنفس (دورة/دقيقة)" : "Respiratory Rate (rpm)"}</label>
                    <Input
                      type="number"
                      placeholder="16"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Weight */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الوزن (كجم)" : "Weight (kg)"}</label>
                    <Input
                      placeholder="75"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>

                  {/* Height */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">{isRtl ? "الطول (سم)" : "Height (cm)"}</label>
                    <Input
                      type="number"
                      placeholder="175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="bg-slate-900 border-slate-800 h-8 text-xs text-slate-100"
                    />
                  </div>
                </div>

                {/* Normal bounds summary */}
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">{isRtl ? "نطاق السلامة المعتمد" : "Normal Clinical Ranges"}</span>
                  <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    {isRtl
                      ? "الضغط: 120/80 مم زئبق · النبض: 60-100 ن/د · الحرارة: 36.5 - 37.5 °م · الأكسجين: 95% فأعلى"
                      : "BP: <120/80 mmHg · HR: 60-100 bpm · Temp: 36.5 - 37.5 °C · SpO2: 95% - 100%"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
