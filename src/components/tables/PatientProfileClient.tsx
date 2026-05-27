"use client";

import React, { useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, 
  Phone, 
  MapPin, 
  Heart, 
  Activity, 
  Calendar, 
  FileText, 
  Clock, 
  Scissors, 
  Coins, 
  CheckCircle2, 
  Printer, 
  ChevronDown, 
  ChevronUp,
  AlertOctagon,
  Stethoscope,
  BriefcaseMedical,
  FlaskConical,
  Plus,
  Pill,
  Thermometer,
  Droplet,
  Weight,
  Ruler,
  FileCheck2,
  CalendarDays,
  Send,
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";

import { createReferralAction, updateReferralStatusAction } from "@/lib/actions/referrals";
import { createCertificateAction } from "@/lib/actions/certificates";
import { NursingAssessmentForm } from "@/components/forms/NursingAssessmentForm";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PatientProfileClientProps {
  patient: {
    id: string;
    nameAr: string;
    nameEn: string;
    patientNumber: string;
    gender: string;
    dob: string | Date;
    contactPhone?: string;
    address?: string;
    bloodType?: string;
    isUhisActive?: boolean;
    uhisNumber?: string;
    createdAt: string | Date;
  };
  surgeries: {
    id: string;
    caseNumber: string;
    scheduledDate: string | Date;
    scheduledStartTime: string;
    procedureName: string;
    procedureNameAr: string;
    surgeonNameAr?: string;
    surgeonNameEn?: string;
    orNameAr?: string;
    orNameEn?: string;
    anesthesiaType?: string;
    complications?: string;
    surgeonNotes?: string;
    anesthesiaNotes?: string;
    bloodLossML?: number;
  }[];
  records: {
    id: string;
    encounterType: string;
    symptoms?: string;
    diagnosis?: string;
    soapNotes?: string;
    icdCodes?: string[];
    createdAt: string | Date;
    doctorNameAr?: string;
    doctorNameEn?: string;
  }[];
  vitals: {
    id?: string;
    recordedAt: string | Date;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperature?: string;
    oxygenSaturation?: number;
    weightKg?: string;
    heightCm?: number;
  }[];
  hospitalSlug: string;
  hospitalId: string;
  departments?: {
    id: string;
    nameAr: string;
    nameEn: string;
  }[];
  doctors?: {
    id: string;
    nameAr: string;
    nameEn: string;
    role: string;
  }[];
  referrals?: {
    id: string;
    reason: string;
    urgency: string;
    status: string;
    notes?: string | null;
    createdAt: string | Date;
    targetDepartmentNameAr?: string | null;
    targetDepartmentNameEn?: string | null;
    referringDoctorNameAr?: string | null;
    referringDoctorNameEn?: string | null;
    targetDoctorNameAr?: string | null;
    targetDoctorNameEn?: string | null;
  }[];
  certificates?: {
    id: string;
    serialNumber: string;
    certificateType: string;
    diagnosis: string;
    startDate: string | Date;
    endDate: string | Date;
    notes?: string | null;
    createdAt: string | Date;
    doctorNameAr?: string | null;
    doctorNameEn?: string | null;
  }[];
  assessments?: {
    id: string;
    type: string;
    data: any;
    notes?: string;
    createdAt: string | Date;
    recordedByNameAr?: string;
    recordedByNameEn?: string;
  }[];
}

export function PatientProfileClient({ 
  patient, 
  surgeries, 
  records = [], 
  vitals = [], 
  hospitalSlug,
  hospitalId,
  departments = [],
  doctors = [],
  referrals = [],
  certificates = [],
  assessments = []
}: PatientProfileClientProps) {
  const t = useTranslations("patients");
  const locale = useLocale();
  const isRtl = locale === "ar";
  
  const [activeTab, setActiveTab] = useState<"medical" | "admissions" | "surgical" | "financials" | "consents" | "referrals" | "certificates" | "laboratory">("medical");
  const [expandedSurgeryId, setExpandedSurgeryId] = useState<string | null>(null);

  // Referrals State
  const [isReferralDialogOpen, setIsReferralDialogOpen] = useState(false);
  const [referralTargetDept, setReferralTargetDept] = useState("");
  const [referralTargetDoc, setReferralTargetDoc] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [referralUrgency, setReferralUrgency] = useState<"routine" | "urgent" | "emergency">("routine");
  const [referralNotes, setReferralNotes] = useState("");
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);

  // Certificates State
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);
  const [certificateType, setCertificateType] = useState<"sick_leave" | "fitness" | "companion">("sick_leave");
  const [certDiagnosis, setCertDiagnosis] = useState("");
  const [certStartDate, setCertStartDate] = useState("");
  const [certEndDate, setCertEndDate] = useState("");
  const [certRestDays, setCertRestDays] = useState(0);
  const [certNotes, setCertNotes] = useState("");
  const [isSubmittingCert, setIsSubmittingCert] = useState(false);
  const [selectedCertificateForPrint, setSelectedCertificateForPrint] = useState<any | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Nursing Assessment State
  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false);

  // Parse custom mock values or actual values
  // Use patient.id to compute allergies deterministically and purely (no Math.random in render)
  const hasAllergies = patient.address?.includes("Penicillin") || patient.address?.includes("Allergy") || (patient.id ? patient.id.charCodeAt(0) % 2 === 0 : false);
  const allergyList = hasAllergies ? ["Penicillin G", "Sulfa Drugs", "Aspirin"] : [];

  const getAge = (dobString: string | Date) => {
    if (!dobString) return 0;
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = getAge(patient.dob);

  const calculateRestDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const diffTime = e.getTime() - s.getTime();
    if (diffTime < 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleStartDateChange = (val: string) => {
    setCertStartDate(val);
    setCertRestDays(calculateRestDays(val, certEndDate));
  };

  const handleEndDateChange = (val: string) => {
    setCertEndDate(val);
    setCertRestDays(calculateRestDays(certStartDate, val));
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralTargetDept || !referralReason) {
      toast.error(isRtl ? "يرجى ملء جميع الحقول المطلوبة." : "Please fill in all required fields.");
      return;
    }

    setIsSubmittingReferral(true);
    try {
      const res = await createReferralAction({
        patientId: patient.id,
        targetDepartmentId: referralTargetDept,
        targetDoctorId: referralTargetDoc || null,
        reason: referralReason,
        urgency: referralUrgency,
        notes: referralNotes || null,
      });

      if (res.success) {
        toast.success(isRtl ? "تم إنشاء الإحالة الطبية بنجاح." : "Internal referral created successfully.");
        setIsReferralDialogOpen(false);
        // Reset form
        setReferralTargetDept("");
        setReferralTargetDoc("");
        setReferralReason("");
        setReferralUrgency("routine");
        setReferralNotes("");
      } else {
        const errorMessage = "error" in res ? res.error : (isRtl ? "فشل إنشاء الإحالة." : "Failed to create referral.");
        toast.error(errorMessage);
      }
    } catch (err: any) {
      toast.error(err?.message || (isRtl ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally {
      setIsSubmittingReferral(false);
    }
  };

  const handleUpdateReferralStatus = async (referralId: string, status: "accepted" | "completed" | "cancelled") => {
    try {
      const res = await updateReferralStatusAction(referralId, status);
      if (res.success) {
        toast.success(isRtl ? "تم تحديث حالة الإحالة بنجاح." : "Referral status updated successfully.");
      } else {
        const errorMessage = "error" in res ? res.error : (isRtl ? "فشل تحديث حالة الإحالة." : "Failed to update referral status.");
        toast.error(errorMessage);
      }
    } catch (err: any) {
      toast.error(err?.message || (isRtl ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    }
  };

  const handleCreateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certDiagnosis || !certStartDate || !certEndDate) {
      toast.error(isRtl ? "يرجى ملء جميع الحقول المطلوبة." : "Please fill in all required fields.");
      return;
    }

    const calculatedDays = calculateRestDays(certStartDate, certEndDate);
    if (calculatedDays <= 0) {
      toast.error(isRtl ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." : "End date must be after start date.");
      return;
    }

    setIsSubmittingCert(true);
    try {
      const res = await createCertificateAction({
        patientId: patient.id,
        certificateType,
        diagnosis: certDiagnosis,
        startDate: certStartDate,
        endDate: certEndDate,
        restDays: calculatedDays,
        notes: certNotes || null,
      });

      if (res.success) {
        toast.success(isRtl ? "تم إصدار الشهادة الطبية بنجاح." : "Medical certificate created successfully.");
        setIsCertificateDialogOpen(false);
        // Reset form
        setCertificateType("sick_leave");
        setCertDiagnosis("");
        setCertStartDate("");
        setCertEndDate("");
        setCertRestDays(0);
        setCertNotes("");
      } else {
        const errorMessage = "error" in res ? res.error : (isRtl ? "فشل إصدار الشهادة." : "Failed to issue medical certificate.");
        toast.error(errorMessage);
      }
    } catch (err: any) {
      toast.error(err?.message || (isRtl ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
    } finally {
      setIsSubmittingCert(false);
    }
  };

  const tabs = [
    { id: "medical", label: isRtl ? "السجل الطبي" : "Medical Records", icon: Stethoscope },
    { id: "admissions", label: isRtl ? "التنويم والرعاية" : "Admissions & Care", icon: BriefcaseMedical },
    { id: "laboratory", label: isRtl ? "المختبر" : "Laboratory", icon: FlaskConical },
    { id: "surgical", label: isRtl ? "السجل الجراحي" : "Surgical History", icon: Scissors, badge: surgeries.length },
    { id: "referrals", label: isRtl ? "الإحالات الداخلية" : "Internal Referrals", icon: BriefcaseMedical, badge: referrals.length },
    { id: "certificates", label: isRtl ? "الشهادات الطبية" : "Medical Certificates", icon: FileText, badge: certificates.length },
    { id: "financials", label: isRtl ? "الفواتير والحسابات" : "Financials & Invoices", icon: Coins },
    { id: "consents", label: isRtl ? "الموافقات الموقعة" : "Signed Consents", icon: FileText },
  ] as const;

  const toggleSurgeryExpand = (id: string) => {
    setExpandedSurgeryId(expandedSurgeryId === id ? null : id);
  };



  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      
      {/* 1. Demographics Summary Header Card */}
      <Card className="border border-border/40 shadow-xl overflow-hidden bg-background relative">
        <div className="absolute top-0 start-0 end-0 h-1.5 bg-gradient-to-r from-accent via-primary to-emerald-500" />
        
        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left/Start: Avatar and Basic Details */}
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-start lg:col-span-2">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-accent/20 to-primary/20 border border-primary/20 flex items-center justify-center text-primary font-black text-3xl shadow-md shrink-0">
                {patient.nameAr.slice(0, 1)}
              </div>

              <div className="space-y-3 flex-1">
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h2 className="text-2xl font-black tracking-tight text-foreground">{isRtl ? patient.nameAr : patient.nameEn}</h2>
                    <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/10 tracking-widest uppercase">
                      {patient.patientNumber}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-1 font-semibold tracking-wide">
                    {isRtl ? patient.nameEn : patient.nameAr}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-semibold text-foreground/80">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{age} {isRtl ? "عام" : "y/o"} • {patient.gender === "male" ? t("male") : t("female")}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono">{patient.contactPhone}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{patient.address}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{isRtl ? `مسجل منذ ${new Date(patient.createdAt).toLocaleDateString("ar-EG")}` : `Registered ${new Date(patient.createdAt).toLocaleDateString()}`}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5 h-6">
                    🩸 Blood: {patient.bloodType || "O+"}
                  </Badge>
                  {patient.isUhisActive ? (
                    <Badge variant="success" className="text-[10px] font-extrabold h-6 flex items-center gap-1 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      ✓ UHIS Active • {patient.uhisNumber || "Active Card"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] font-bold h-6 py-0.5 bg-gray-100 border border-gray-200 text-gray-700">
                      Cash Patient
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right/End: Dynamic Allergy Clinical Alert Banner */}
            <div className="w-full">
              {hasAllergies ? (
                <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 animate-bounce shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider">{t("allergyAlert")}</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {allergyList.map((allergy, index) => (
                      <Badge key={index} variant="destructive" className="text-[10px] font-extrabold bg-destructive border border-destructive-foreground/10 text-white rounded-lg shadow-sm">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-destructive-foreground/70 leading-normal font-semibold">
                    {isRtl 
                      ? "تنبيه: يجب فحص ملف حساسية المريض بالكامل قبل إعطاء أي نوع من العقاقير أو التخدير الجراحي." 
                      : "CAUTION: Patient allergy profile must be verified before prescribing or administering anesthetic substances."}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 text-emerald-600 flex items-start gap-2.5 font-semibold text-xs">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4>No Known Drug Allergies (NKDA)</h4>
                    <p className="text-[10px] text-emerald-600/70 mt-1">No severe adverse pharmaceutical reactions reported by patient.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* 2. Custom Sleek Tabs Header */}
      <div className="flex border-b border-border/40 overflow-x-auto scrollbar-none gap-2">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-xs font-black border-b-2 transition-all duration-300 relative whitespace-nowrap focus:outline-hidden",
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
              {"badge" in tab && tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-full border border-primary/20">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Dynamic Tabbed Panels */}
      <div className="min-h-96">
        
        {/* Tab A: Surgical History Grid */}
        {activeTab === "surgical" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">{t("surgicalHistory")}</h3>
                <p className="text-xs text-muted-foreground">{isRtl ? "استعرض سجل وتفاصيل العمليات الجراحية السابقة لهذا المريض." : "Audit all historically performed surgical procedures for this patient."}</p>
              </div>
            </div>

            {surgeries.length === 0 ? (
              <Card className="border border-dashed border-border p-12 text-center bg-background rounded-2xl">
                <Scissors className="w-12 h-12 mx-auto text-muted-foreground/40 stroke-1 mb-4" />
                <h4 className="text-sm font-bold text-foreground">{t("noSurgicalCases")}</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">No operating room case schedules or perioperative checklists found in records.</p>
              </Card>
            ) : (
              <div className="rounded-2xl border border-border/40 bg-card text-card-foreground shadow-sm overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 text-muted-foreground font-black text-xs uppercase">
                      <th className="p-4 text-start">Case Number</th>
                      <th className="p-4 text-start">{t("date")}</th>
                      <th className="p-4 text-start">{t("procedure")}</th>
                      <th className="p-4 text-start">{t("surgeon")}</th>
                      <th className="p-4 text-start">{t("or")}</th>
                      <th className="p-4 text-start">{t("anesthesia")}</th>
                      <th className="p-4 text-start">Complications</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {surgeries.map((sc) => {
                      const isExpanded = expandedSurgeryId === sc.id;
                      
                      return (
                        <React.Fragment key={sc.id}>
                          <tr 
                            onClick={() => toggleSurgeryExpand(sc.id)}
                            className={cn(
                              "border-b border-border/20 hover:bg-muted/20 cursor-pointer transition-colors duration-150 last:border-0",
                              isExpanded && "bg-muted/30 hover:bg-muted/30"
                            )}
                          >
                            <td className="p-4 font-mono font-bold text-accent text-xs">
                              {sc.caseNumber}
                            </td>
                            <td className="p-4 text-xs font-semibold text-foreground/80">
                              <div className="flex flex-col gap-0.5 text-start">
                                <span>{new Date(sc.scheduledDate).toLocaleDateString()}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {sc.scheduledStartTime}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-start">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-sm text-foreground">{isRtl ? sc.procedureNameAr : sc.procedureName}</span>
                                <span className="text-[10px] text-muted-foreground/80 font-semibold">{isRtl ? sc.procedureName : sc.procedureNameAr}</span>
                              </div>
                            </td>
                            <td className="p-4 text-xs font-bold text-foreground/80">
                              {isRtl ? sc.surgeonNameAr : sc.surgeonNameEn}
                            </td>
                            <td className="p-4 text-xs font-semibold text-muted-foreground">
                              {isRtl ? sc.orNameAr : sc.orNameEn}
                            </td>
                            <td className="p-4 text-xs">
                              <Badge variant="outline" className="text-[10px] font-bold py-0.5">
                                {sc.anesthesiaType}
                              </Badge>
                            </td>
                            <td className="p-4 text-xs">
                              {sc.complications ? (
                                <Badge variant="destructive" className="text-[10px] font-bold">
                                  Yes
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px] font-bold">
                                  None
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                          </tr>

                          {/* Expanded Surgery notes drawer-like panel */}
                          {isExpanded && (
                            <tr className="bg-muted/15 border-b border-border/20">
                              <td colSpan={8} className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
                                  {/* Surgeon Perioperative notes */}
                                  <div className="space-y-2 border-s-2 border-primary ps-4">
                                    <h5 className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                                      <Scissors className="w-3.5 h-3.5" />
                                      Perioperative Surgeon Notes
                                    </h5>
                                    <p className="text-xs text-foreground/80 leading-relaxed font-semibold bg-background/50 p-3 rounded-xl border border-border/20">
                                      {sc.surgeonNotes || "No surgeon notes compiled for this surgical intervention case."}
                                    </p>
                                    <div className="text-[10px] text-muted-foreground font-medium pt-1">
                                      Estimated Blood Loss: <span className="font-bold text-accent">{sc.bloodLossML || 0} ML</span>
                                    </div>
                                  </div>

                                  {/* Anesthesiologist notes */}
                                  <div className="space-y-2 border-s-2 border-accent ps-4">
                                    <h5 className="text-xs font-black uppercase text-accent tracking-wider flex items-center gap-1.5">
                                      <Activity className="w-3.5 h-3.5" />
                                      Anesthesiologist Log notes
                                    </h5>
                                    <p className="text-xs text-foreground/80 leading-relaxed font-semibold bg-background/50 p-3 rounded-xl border border-border/20">
                                      {sc.anesthesiaNotes || "No anesthesiologist logs compiled for this anesthesia cycle."}
                                    </p>
                                    <div className="text-[10px] text-muted-foreground font-medium pt-1">
                                      Anesthesia complications: <span className="font-bold text-destructive">{sc.complications || "None reported"}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab B: Medical Records (Real clinical info) */}
        {activeTab === "medical" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  {t("medicalRecords")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRtl 
                    ? "الاستعراض السريري للملاحظات الطبية، خطط العلاج SOAP، والتشخيصات المسجلة للمريض." 
                    : "Review doctor SOAP encounter notes, diagnostics assessments, and recorded outpatient vitals flowsheet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 border-indigo-500/30 text-indigo-600 hover:bg-indigo-50">
                  <Link href={`/${hospitalSlug}/patients/${patient.id}/prescribe`}>
                    <Pill className="w-4 h-4" />
                    {isRtl ? "صرف دواء" : "Prescribe Meds"}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 border-purple-500/30 text-purple-600 hover:bg-purple-50">
                  <Link href={`/${hospitalSlug}/patients/${patient.id}/labs/new`}>
                    <FlaskConical className="w-4 h-4" />
                    {isRtl ? "طلب فحص" : "Order Labs"}
                  </Link>
                </Button>
                <Button asChild size="sm" className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground">
                  <Link href={`/${hospitalSlug}/patients/${patient.id}/records/new`}>
                    <Plus className="w-4 h-4" />
                    {t("recordNewVisit")}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Vitals Flows Logs panel (1/3 width) */}
              <div className="space-y-6">
                <Card className="border border-border/30 bg-background/50 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden relative">
                  <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                  <CardContent className="p-5 space-y-5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-teal-600 border-b border-border/10 pb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-500" />
                      {t("recentVitals")}
                    </h4>
                    
                    {vitals && vitals.length > 0 ? (
                      <div className="space-y-4">
                        {/* Vital Grid Cards */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* BP */}
                          <div className="p-3 rounded-2xl bg-teal-50/5 border border-teal-500/10 hover:border-teal-500/20 transition-all">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">{t("bp")}</span>
                            <span className="font-mono text-sm text-foreground font-black">
                              {vitals[0].bloodPressureSystolic && vitals[0].bloodPressureDiastolic 
                                ? `${vitals[0].bloodPressureSystolic}/${vitals[0].bloodPressureDiastolic}`
                                : "—"}
                            </span>
                            <span className="text-[9px] text-muted-foreground block font-medium">mmHg</span>
                          </div>
                          {/* Heart Rate */}
                          <div className="p-3 rounded-2xl bg-rose-50/5 border border-rose-500/10 hover:border-rose-500/20 transition-all">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-500 shrink-0" />
                              {t("pulse")}
                            </span>
                            <span className="font-mono text-sm text-foreground font-black">
                              {vitals[0].heartRate ?? "—"}
                            </span>
                            <span className="text-[9px] text-muted-foreground block font-medium">bpm</span>
                          </div>
                          {/* Temp */}
                          <div className="p-3 rounded-2xl bg-amber-50/5 border border-amber-500/10 hover:border-amber-500/20 transition-all">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                              <Thermometer className="w-3 h-3 text-amber-500 shrink-0" />
                              {t("temp")}
                            </span>
                            <span className="font-mono text-sm text-foreground font-black">
                              {vitals[0].temperature ? `${Number(vitals[0].temperature).toFixed(1)}` : "—"}
                            </span>
                            <span className="text-[9px] text-muted-foreground block font-medium">°C</span>
                          </div>
                          {/* SpO2 */}
                          <div className="p-3 rounded-2xl bg-sky-50/5 border border-sky-500/10 hover:border-sky-500/20 transition-all">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                              <Droplet className="w-3 h-3 text-sky-500 shrink-0" />
                              {t("spo2")}
                            </span>
                            <span className="font-mono text-sm text-foreground font-black">
                              {vitals[0].oxygenSaturation ? `${vitals[0].oxygenSaturation}` : "—"}
                            </span>
                            <span className="text-[9px] text-muted-foreground block font-medium">%</span>
                          </div>
                        </div>

                        {/* Extra minor vitals block */}
                        <div className="space-y-2 border-t border-border/10 pt-3 text-xs font-semibold">
                          <div className="flex justify-between items-center p-2 rounded-xl bg-muted/30">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-muted-foreground/60" />
                              {t("respiratory")}
                            </span>
                            <span className="font-mono text-foreground font-black">
                              {vitals[0].respiratoryRate ? `${vitals[0].respiratoryRate} rpm` : "—"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 rounded-xl bg-muted/30">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Weight className="w-3.5 h-3.5 text-muted-foreground/60" />
                              {t("weight")}
                            </span>
                            <span className="font-mono text-foreground font-black">
                              {vitals[0].weightKg ? `${Number(vitals[0].weightKg).toFixed(1)} kg` : "—"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 rounded-xl bg-muted/30">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Ruler className="w-3.5 h-3.5 text-muted-foreground/60" />
                              {t("height")}
                            </span>
                            <span className="font-mono text-foreground font-black">
                              {vitals[0].heightCm ? `${vitals[0].heightCm} cm` : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground text-center font-medium pt-1">
                          {isRtl 
                            ? `آخر قراءة سجلت في: ${new Date(vitals[0].recordedAt).toLocaleString("ar-EG")}` 
                            : `Last checked: ${new Date(vitals[0].recordedAt).toLocaleString()}`}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto stroke-1 mb-2 animate-pulse" />
                        <p className="text-[11px] text-muted-foreground font-semibold">
                          {isRtl ? "لا توجد قراءات علامات حيوية مسجلة" : "No vitals registered yet"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Vitals History Timeline (Collapsible/Scrollable) */}
                {vitals && vitals.length > 1 && (
                  <Card className="border border-border/30 bg-background/50 rounded-2xl shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <h5 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        {isRtl ? "تاريخ القياسات السابقة" : "Vitals History Logs"}
                      </h5>
                      <div className="max-h-60 overflow-y-auto pe-1 space-y-2 scrollbar-thin">
                        {vitals.slice(1).map((vit, idx) => (
                          <div key={vit.id || idx} className="p-2.5 rounded-xl border border-border/10 hover:border-border/20 bg-muted/10 text-xs font-semibold space-y-1">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                              <span>
                                {new Date(vit.recordedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 font-mono text-[10px] font-bold text-center">
                              {vit.bloodPressureSystolic && (
                                <span className="bg-teal-500/5 text-teal-600 p-0.5 rounded">
                                  BP: {vit.bloodPressureSystolic}/{vit.bloodPressureDiastolic}
                                </span>
                              )}
                              {vit.heartRate && (
                                <span className="bg-rose-500/5 text-rose-600 p-0.5 rounded">
                                  HR: {vit.heartRate}
                                </span>
                              )}
                              {vit.temperature && (
                                <span className="bg-amber-500/5 text-amber-600 p-0.5 rounded">
                                  T: {Number(vit.temperature).toFixed(1)}°
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Diagnostic assessment encounters list (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                {records.length === 0 ? (
                  <Card className="border border-dashed border-border p-12 text-center bg-background rounded-2xl">
                    <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/30 stroke-1 mb-4" />
                    <h4 className="text-sm font-bold text-foreground">{t("noRecords")}</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      {isRtl 
                        ? "ابدأ بتسجيل زيارة عيادية جديدة لتوثيق الأعراض، الفحص الطبي، والتشخيص السريري." 
                        : "Initialize by recording an outpatient visit to file medical complaints, diagnostic assessment, and clinical codes."}
                    </p>
                    <div className="pt-4">
                      <Button asChild size="sm" className="font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground">
                        <Link href={`/${hospitalSlug}/patients/${patient.id}/records/new`}>
                          <Plus className="w-4 h-4 me-1.5" />
                          {t("recordNewVisit")}
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {records.map((record) => {
                      const doctorName = isRtl ? record.doctorNameAr : record.doctorNameEn;
                      const dateFormatted = new Date(record.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : "en-US",
                        { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
                      );
                      
                      let badgeStyle = "bg-blue-500/10 text-blue-600 border border-blue-500/20";
                      let resolvedType = t("outpatient");
                      if (record.encounterType === "inpatient") {
                        badgeStyle = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                        resolvedType = t("inpatient");
                      } else if (record.encounterType === "emergency") {
                        badgeStyle = "bg-red-500/10 text-red-600 border border-red-500/20";
                        resolvedType = t("emergency");
                      }

                      return (
                        <Card key={record.id} className="border border-border/30 bg-background hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden relative group">
                          <div className={cn(
                            "absolute top-0 bottom-0 w-1 bg-blue-500",
                            record.encounterType === "inpatient" && "bg-emerald-500",
                            record.encounterType === "emergency" && "bg-red-500"
                          )} />
                          <CardContent className="p-6 space-y-4">
                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/10 pb-3">
                              <div className="flex items-center gap-2.5">
                                <Badge variant="outline" className={cn("text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-lg shrink-0", badgeStyle)}>
                                  {resolvedType}
                                </Badge>
                                <div>
                                  <h4 className="text-xs font-black text-foreground">{doctorName || "Medical Professional"}</h4>
                                  <span className="text-[10px] text-muted-foreground font-semibold">HMS Medical Practitioner</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-accent bg-accent/5 border border-accent/10 px-2 py-0.5 rounded-md self-start sm:self-auto">
                                {dateFormatted}
                              </span>
                            </div>

                            {/* Symptoms Section */}
                            {record.symptoms && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-muted-foreground/80 tracking-wider block">
                                  {t("symptoms")}
                                </span>
                                <div className="text-xs font-semibold text-foreground/80 bg-muted/10 p-3 rounded-xl border border-border/5">
                                  {record.symptoms}
                                </div>
                              </div>
                            )}

                            {/* SOAP Notes Plan Section */}
                            {record.soapNotes && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-muted-foreground/80 tracking-wider block">
                                  {t("soapNotes")}
                                </span>
                                <div className="whitespace-pre-line text-xs font-medium text-foreground/90 bg-muted/20 p-3.5 rounded-xl border border-border/20 shadow-2xs leading-relaxed font-sans">
                                  {record.soapNotes}
                                </div>
                              </div>
                            )}

                            {/* Diagnosis & Assessment Section */}
                            <div className="border-t border-border/10 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-muted-foreground/80 tracking-wider block">
                                  {t("diagnosis")}
                                </span>
                                <span className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  {record.diagnosis || "Symptomatic Examination Check"}
                                </span>
                              </div>

                              {/* ICD-10 Diagnosis Codes */}
                              {record.icdCodes && record.icdCodes.length > 0 && (
                                <div className="space-y-1 shrink-0">
                                  <span className="text-[10px] font-black uppercase text-muted-foreground/80 tracking-wider block text-start sm:text-end">
                                    {t("icd10Codes")}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                                    {record.icdCodes.map((codeStr: string, cIdx: number) => (
                                      <Badge key={cIdx} variant="secondary" className="font-mono text-[10px] font-black tracking-wider px-2 py-0.5 rounded bg-muted text-accent border border-border/40">
                                        {codeStr}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab C: Admissions & Care (Mock admissions) */}
        {activeTab === "admissions" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <BriefcaseMedical className="w-5 h-5 text-emerald-600" />
                  {isRtl ? "التنويم والرعاية التمريضية" : "Inpatient Admissions & Nursing Care"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRtl 
                    ? "إدارة سجلات التنويم، توزيع الأسرة، وتقييمات الرعاية التمريضية المستمرة." 
                    : "Manage ward admissions, bed assignments, and continuous nursing assessment logs."}
                </p>
              </div>
              <Button 
                onClick={() => setIsAssessmentDialogOpen(true)}
                size="sm" 
                className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="w-4 h-4" />
                {isRtl ? "تسجيل تقييم تمريضي" : "New Nursing Assessment"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Active Admission Mock Card (Optional) */}
              <Card className="border border-border/30 bg-background rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                    <Activity className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{isRtl ? "لا توجد تنويمات نشطة" : "No Active Admissions"}</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {isRtl 
                          ? "هذا المريض يعالج حالياً كحالة خارجية وغير مسجل على أي سرير في أجنحة التنويم." 
                          : "This patient is currently being managed as an outpatient and is not assigned to a clinical ward bed."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nursing Assessments History */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4" />
                  {isRtl ? "سجل التقييمات التمريضية" : "Nursing Assessment Logs"}
                </h4>
                
                {assessments.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-2xl">
                    <p className="text-xs text-muted-foreground font-semibold">
                      {isRtl ? "لا توجد تقييمات تمريضية مسجلة بعد." : "No nursing assessments recorded yet."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {assessments.map((ass) => {
                      const recordedBy = isRtl 
                        ? (ass.recordedByNameAr || ass.recordedByNameEn) 
                        : (ass.recordedByNameEn || ass.recordedByNameAr);
                      const dateStr = new Date(ass.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <Card key={ass.id} className="border border-border/20 bg-background/50 hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                          <CardContent className="p-5 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase">
                                  {ass.type}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono font-bold">{dateStr}</span>
                              </div>
                              <span className="text-[10px] font-bold text-foreground/70">
                                {isRtl ? "بواسطة: " : "By: "} <span className="text-primary">{recordedBy || "Nurse"}</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {/* Summary of key data points if available */}
                              {ass.data?.vitals?.bp && (
                                <div className="text-[10px] font-semibold bg-muted/30 p-2 rounded-lg">
                                  <span className="text-muted-foreground block">{isRtl ? "ضغط الدم" : "BP"}</span>
                                  <span className="text-foreground">{ass.data.vitals.bp}</span>
                                </div>
                              )}
                              {ass.data?.pain?.level !== undefined && (
                                <div className="text-[10px] font-semibold bg-muted/30 p-2 rounded-lg">
                                  <span className="text-muted-foreground block">{isRtl ? "الألم" : "Pain"}</span>
                                  <span className={cn(
                                    "font-black",
                                    Number(ass.data.pain.level) > 7 ? "text-destructive" : "text-amber-600"
                                  )}>{ass.data.pain.level}/10</span>
                                </div>
                              )}
                            </div>

                            {ass.notes && (
                              <div className="bg-muted/10 p-3 rounded-xl border border-border/5 text-xs font-medium text-foreground/80 italic">
                                "{ass.notes}"
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab D: Financials & Invoices */}
        {activeTab === "financials" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div>
              <h3 className="text-lg font-black text-foreground">Billing statements & Paymob receipts</h3>
              <p className="text-xs text-muted-foreground">Track co-payments, statutory insurance claims, online transaction logs, and printed tax invoices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: "INV-2026-00325", date: "May 21, 2026", desc: "Outpatient consult and clinical diagnostics", amount: "750.00 EGP", status: "paid" },
                { id: "INV-2026-00214", date: "May 10, 2026", desc: "Surgical consult & pre-operative anesthesia assess", amount: "1,200.00 EGP", status: "paid" }
              ].map((inv) => (
                <Card key={inv.id} className="border border-border/30 bg-background rounded-2xl shadow-sm">
                  <CardContent className="p-5 flex justify-between items-start">
                    <div className="space-y-1.5">
                      <span className="font-mono text-[10px] font-black text-accent tracking-wide uppercase">{inv.id}</span>
                      <h4 className="text-xs font-bold text-foreground">{inv.desc}</h4>
                      <p className="text-[10px] text-muted-foreground font-semibold">{inv.date}</p>
                    </div>
                    <div className="text-end space-y-2">
                      <span className="block font-mono text-sm font-extrabold text-foreground">{inv.amount}</span>
                      <Badge variant="success" className="text-[9px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg">
                        SUCCESS PAID
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab E: Signed Consents */}
        {activeTab === "consents" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">{isRtl ? "الموافقات والإقرارات الطبية الموقعة" : "Signed Statutory Consent Documents"}</h3>
                <p className="text-xs text-muted-foreground">Verify legally-binding patient treatment agreements, witness logs, and legal document versions.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { type: "general", name: isRtl ? "إقرار الموافقة على العلاج الطبي العام" : "General Medical Onboarding Consent", version: "v1.0", witness: "Receptionist", date: new Date(patient.createdAt).toLocaleDateString() }
              ].map((consent, idx) => (
                <Card key={idx} className="border border-border/30 bg-background rounded-2xl shadow-sm">
                  <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-foreground">{consent.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          Version: <span className="font-mono font-bold text-accent">{consent.version}</span> • Signed on <span className="font-mono">{consent.date}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="text-start sm:text-end shrink-0">
                        <span className="block text-[10px] text-muted-foreground font-semibold">Witness Sign-off</span>
                        <span className="text-xs font-bold text-foreground/80">{consent.witness}</span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 h-9 font-bold px-3 ms-auto">
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isRtl ? "طباعة" : "Print PDF"}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab F: Referrals (Internal Referrals) */}
        {activeTab === "referrals" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <BriefcaseMedical className="w-5 h-5 text-primary" />
                  {isRtl ? "الإحالات الطبية الداخلية" : "Internal Clinical Referrals"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRtl 
                    ? "إصدار وإدارة إحالات المرضى الداخلية بين الأقسام والأطباء داخل المستشفى." 
                    : "Create and audit internal patient transfers and consultations between specialty departments."}
                </p>
              </div>
              <Button 
                onClick={() => setIsReferralDialogOpen(true)}
                size="sm" 
                className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                <Plus className="w-4 h-4" />
                {isRtl ? "إصدار إحالة جديدة" : "New Referral"}
              </Button>
            </div>

            {referrals.length === 0 ? (
              <Card className="border border-dashed border-border p-12 text-center bg-background rounded-2xl">
                <BriefcaseMedical className="w-12 h-12 mx-auto text-muted-foreground/30 stroke-1 mb-4" />
                <h4 className="text-sm font-bold text-foreground">{isRtl ? "لا توجد إحالات حالية" : "No Active Referrals"}</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {isRtl 
                    ? "لم يتم تسجيل أي إحالات داخلية لهذا المريض بعد." 
                    : "No internal referrals have been issued for this patient yet."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {referrals.map((ref) => {
                  const dateStr = new Date(ref.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <Card key={ref.id} className="border border-border/30 bg-background hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden relative group">
                      <div className={cn(
                        "absolute top-0 bottom-0 w-1 bg-gray-400",
                        ref.urgency === "urgent" && "bg-amber-500",
                        ref.urgency === "emergency" && "bg-destructive",
                        ref.status === "completed" && "bg-emerald-500"
                      )} />
                      <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn(
                              "text-[10px] font-black uppercase py-0.5",
                              ref.urgency === "routine" && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                              ref.urgency === "urgent" && "bg-amber-500/10 text-amber-600 border border-amber-500/20",
                              ref.urgency === "emergency" && "bg-destructive/10 text-destructive border border-destructive/20 animate-pulse"
                            )}>
                              {isRtl 
                                ? (ref.urgency === "routine" ? "عادية" : ref.urgency === "urgent" ? "عاجلة" : "طارئة") 
                                : ref.urgency}
                            </Badge>
                            <Badge className={cn(
                              "text-[10px] font-black uppercase py-0.5",
                              ref.status === "pending" && "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20",
                              ref.status === "accepted" && "bg-sky-500/10 text-sky-600 border border-sky-500/20",
                              ref.status === "completed" && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
                              ref.status === "cancelled" && "bg-red-500/10 text-red-600 border border-red-500/20"
                            )}>
                              {isRtl 
                                ? (ref.status === "pending" ? "قيد الانتظار" : ref.status === "accepted" ? "مقبولة" : ref.status === "completed" ? "مكتملة" : "ملغاة") 
                                : ref.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono font-semibold">{dateStr}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground/80 pt-1">
                            <div>
                              <span className="text-muted-foreground">{isRtl ? "الطبيب المحيل: " : "Referring: "}</span>
                              <span className="font-bold">{isRtl ? ref.referringDoctorNameAr : ref.referringDoctorNameEn}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{isRtl ? "القسم المحال إليه: " : "Target Dept: "}</span>
                              <span className="font-bold">{isRtl ? ref.targetDepartmentNameAr : ref.targetDepartmentNameEn}</span>
                            </div>
                            {ref.targetDoctorNameAr && (
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">{isRtl ? "الأخصائي المستهدف: " : "Target Specialist: "}</span>
                                <span className="font-bold">{isRtl ? ref.targetDoctorNameAr : ref.targetDoctorNameEn}</span>
                              </div>
                            )}
                          </div>

                          <div className="text-xs bg-muted/20 p-3 rounded-xl border border-border/10 space-y-1">
                            <span className="font-bold text-foreground/90 block">{isRtl ? "سبب الإحالة:" : "Reason for Referral:"}</span>
                            <p className="text-muted-foreground">{ref.reason}</p>
                            {ref.notes && (
                              <div className="mt-2 pt-2 border-t border-border/5">
                                <span className="font-bold text-foreground/90 block">{isRtl ? "ملاحظات إضافية:" : "Clinical Notes:"}</span>
                                <p className="text-muted-foreground">{ref.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {ref.status === "pending" && (
                          <div className="flex gap-2 w-full md:w-auto md:flex-col justify-end">
                            <Button 
                              onClick={() => handleUpdateReferralStatus(ref.id, "accepted")}
                              size="sm" 
                              className="font-bold bg-sky-500 hover:bg-sky-600 text-white shrink-0"
                            >
                              {isRtl ? "قبول الإحالة" : "Accept Referral"}
                            </Button>
                            <Button 
                              onClick={() => handleUpdateReferralStatus(ref.id, "cancelled")}
                              variant="outline" 
                              size="sm" 
                              className="font-bold border-destructive hover:bg-destructive/10 text-destructive shrink-0"
                            >
                              {isRtl ? "إلغاء الإحالة" : "Cancel"}
                            </Button>
                          </div>
                        )}

                        {ref.status === "accepted" && (
                          <div className="flex gap-2 w-full md:w-auto md:flex-col justify-end">
                            <Button 
                              onClick={() => handleUpdateReferralStatus(ref.id, "completed")}
                              size="sm" 
                              className="font-bold bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                            >
                              {isRtl ? "إكمال الإحالة" : "Mark Completed"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab G: Certificates (Medical Certificates) */}
        {activeTab === "certificates" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {isRtl ? "الشهادات والتقارير الطبية" : "Medical Certificates & Reports"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRtl 
                    ? "إصدار وطباعة الإجازات المرضية، شهادات اللياقة البدنية، وتقارير المرافقين الرسمية." 
                    : "Generate official sick leaves, fitness certificates, and companion medical clearance records."}
                </p>
              </div>
              <Button 
                onClick={() => setIsCertificateDialogOpen(true)}
                size="sm" 
                className="font-extrabold gap-1.5 h-10 shadow-xs self-start sm:self-auto shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                <Plus className="w-4 h-4" />
                {isRtl ? "إنشاء شهادة جديدة" : "New Certificate"}
              </Button>
            </div>

            {certificates.length === 0 ? (
              <Card className="border border-dashed border-border p-12 text-center bg-background rounded-2xl">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 stroke-1 mb-4" />
                <h4 className="text-sm font-bold text-foreground">{isRtl ? "لا توجد شهادات صادرة" : "No Medical Certificates"}</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {isRtl 
                    ? "لم يتم إصدار أي شهادات طبية لهذا المريض حتى الآن." 
                    : "No official medical certificates have been generated for this patient yet."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {certificates.map((cert) => {
                  const typeLabel = cert.certificateType === "sick_leave" 
                    ? (isRtl ? "إجازة مرضية" : "Sick Leave")
                    : cert.certificateType === "fitness"
                    ? (isRtl ? "شهادة لياقة بدنية" : "Fitness Certificate")
                    : (isRtl ? "تقرير طبي لمرافق" : "Companion Certificate");

                  const formattedStartDate = new Date(cert.startDate).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");
                  const formattedEndDate = new Date(cert.endDate).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");

                  return (
                    <Card key={cert.id} className="border border-border/30 bg-background hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden relative group">
                      <div className="absolute top-0 bottom-0 w-1 bg-primary" />
                      <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-black text-accent tracking-wide uppercase">{cert.serialNumber}</span>
                            <Badge className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {typeLabel}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-extrabold border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                              {(() => {
                                const start = cert.startDate ? new Date(cert.startDate) : null;
                                const end = cert.endDate ? new Date(cert.endDate) : null;
                                return (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()))
                                  ? Math.max(1, differenceInCalendarDays(end, start))
                                  : 1;
                              })()} {isRtl ? "أيام راحة" : "Rest Days"}
                            </Badge>
                          </div>

                          <h4 className="text-sm font-black text-foreground">{cert.diagnosis}</h4>
                          <p className="text-xs text-muted-foreground font-semibold">
                            {isRtl ? "الفترة: " : "Duration: "} <span className="font-mono font-bold text-foreground/80">{formattedStartDate}</span> {isRtl ? "إلى" : "to"} <span className="font-mono font-bold text-foreground/80">{formattedEndDate}</span>
                          </p>

                          <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-2">
                            <span>{isRtl ? "بواسطة الأخصائي:" : "Issued By:"} <span className="text-foreground/80 font-bold">{isRtl ? cert.doctorNameAr : cert.doctorNameEn}</span></span>
                          </div>
                        </div>

                        <Button 
                          onClick={() => {
                            setSelectedCertificateForPrint(cert);
                            setIsPrintPreviewOpen(true);
                          }}
                          variant="outline" 
                          size="sm" 
                          className="gap-1.5 h-9 font-bold px-3 shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isRtl ? "معاينة وطباعة" : "Print Certificate"}</span>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Referral Dialog */}
      <Dialog open={isReferralDialogOpen} onOpenChange={setIsReferralDialogOpen}>
        <DialogContent className="max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
          <form onSubmit={handleCreateReferral}>
            <DialogHeader onClose={() => setIsReferralDialogOpen(false)} className="px-6 py-4">
              <DialogTitle>{isRtl ? "إصدار إحالة طبية جديدة" : "New Internal Referral"}</DialogTitle>
              <DialogDescription>
                {isRtl ? "قم بتسجيل تفاصيل إحالة المريض إلى قسم أو أخصائي آخر." : "Select the target department, specialist, and clinical reason."}
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "القسم المستهدف *" : "Target Department *"}</label>
                <select 
                  value={referralTargetDept} 
                  onChange={(e) => setReferralTargetDept(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                  required
                >
                  <option value="">{isRtl ? "-- اختر القسم --" : "-- Select Department --"}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {isRtl ? dept.nameAr : dept.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "الطبيب المستهدف (اختياري)" : "Target Doctor (Optional)"}</label>
                <select 
                  value={referralTargetDoc} 
                  onChange={(e) => setReferralTargetDoc(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                >
                  <option value="">{isRtl ? "-- اختر الطبيب (اختياري) --" : "-- Select Doctor (Optional) --"}</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {isRtl ? doc.nameAr : doc.nameEn} ({doc.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "درجة الاستعجال *" : "Urgency Level *"}</label>
                <select 
                  value={referralUrgency} 
                  onChange={(e) => setReferralUrgency(e.target.value as any)}
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                  required
                >
                  <option value="routine">{isRtl ? "روتينية (عادية)" : "Routine"}</option>
                  <option value="urgent">{isRtl ? "عاجلة" : "Urgent"}</option>
                  <option value="emergency">{isRtl ? "طارئة" : "Emergency"}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "سبب الإحالة الطبي *" : "Clinical Reason *"}</label>
                <Textarea 
                  value={referralReason} 
                  onChange={(e) => setReferralReason(e.target.value)}
                  placeholder={isRtl ? "ادخل سبب الإحالة أو الشكوى الطبية الرئيسية..." : "Enter primary medical reason for referral..."}
                  required
                  className="min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "ملاحظات إضافية" : "Additional Notes"}</label>
                <Textarea 
                  value={referralNotes} 
                  onChange={(e) => setReferralNotes(e.target.value)}
                  placeholder={isRtl ? "توصيات أو إرشادات إضافية للأخصائي..." : "Additional notes or clinical instructions..."}
                  className="min-h-16"
                />
              </div>
            </DialogContent>

            <DialogFooter className="px-6 py-4">
              <Button 
                type="submit" 
                disabled={isSubmittingReferral}
                className="font-bold gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                {isSubmittingReferral ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? "جاري الإرسال..." : "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isRtl ? "إرسال الإحالة" : "Submit Referral"}</span>
                  </>
                )}
              </Button>
              <Button 
                type="button" 
                onClick={() => setIsReferralDialogOpen(false)}
                variant="outline"
                className="font-bold"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Certificate Dialog */}
      <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
        <DialogContent className="max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
          <form onSubmit={handleCreateCertificate}>
            <DialogHeader onClose={() => setIsCertificateDialogOpen(false)} className="px-6 py-4">
              <DialogTitle>{isRtl ? "إصدار شهادة طبية جديدة" : "New Medical Certificate"}</DialogTitle>
              <DialogDescription>
                {isRtl ? "قم بتسجيل وتفصيل شهادة الإجازة المرضية أو اللياقة البدنية الرسمية للمريض." : "Fill in type, diagnosis, and rest period details."}
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "نوع الشهادة *" : "Certificate Type *"}</label>
                <select 
                  value={certificateType} 
                  onChange={(e) => setCertificateType(e.target.value as any)}
                  className="flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-bold"
                  required
                >
                  <option value="sick_leave">{isRtl ? "إجازة مرضية" : "Sick Leave"}</option>
                  <option value="fitness">{isRtl ? "شهادة لياقة بدنية" : "Fitness Certificate"}</option>
                  <option value="companion">{isRtl ? "شهادة مرافق مريض" : "Companion Certificate"}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "التشخيص الطبي المعتمد *" : "Clinical Diagnosis *"}</label>
                <Input 
                  value={certDiagnosis} 
                  onChange={(e) => setCertDiagnosis(e.target.value)}
                  placeholder={isRtl ? "ادخل التشخيص المعتمد للشهادة..." : "Enter confirmed clinical diagnosis..."}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "تاريخ البدء *" : "Start Date *"}</label>
                  <Input 
                    type="date"
                    value={certStartDate} 
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "تاريخ الانتهاء *" : "End Date *"}</label>
                  <Input 
                    type="date"
                    value={certEndDate} 
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground">{isRtl ? "إجمالي أيام الراحة المحتسبة:" : "Calculated Rest Days:"}</span>
                <span className="font-mono text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-lg">
                  {certRestDays} {isRtl ? "أيام" : "Days"}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 block">{isRtl ? "ملاحظات وتوصيات إضافية" : "Recommendations & Notes"}</label>
                <Textarea 
                  value={certNotes} 
                  onChange={(e) => setCertNotes(e.target.value)}
                  placeholder={isRtl ? "ادخل أي توصيات إضافية أو إرشادات..." : "Enter secondary recommendations..."}
                  className="min-h-20"
                />
              </div>
            </DialogContent>

            <DialogFooter className="px-6 py-4">
              <Button 
                type="submit" 
                disabled={isSubmittingCert}
                className="font-bold gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                {isSubmittingCert ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? "جاري الإصدار..." : "Generating..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isRtl ? "إصدار الشهادة" : "Issue Certificate"}</span>
                  </>
                )}
              </Button>
              <Button 
                type="button" 
                onClick={() => setIsCertificateDialogOpen(false)}
                variant="outline"
                className="font-bold"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader onClose={() => setIsPrintPreviewOpen(false)} className="px-6 py-4">
            <DialogTitle>{isRtl ? "معاينة الطباعة الرسمية" : "Official Print Preview"}</DialogTitle>
            <DialogDescription>
              {isRtl ? "شهادة طبية رسمية متوافقة مع معايير وزارة الصحة المصرية" : "Official Ministry of Health compliant medical certificate layout."}
            </DialogDescription>
          </DialogHeader>

          {selectedCertificateForPrint && (
            <>
              {/* Printable container */}
              <div className="p-8 bg-neutral-50/50 dark:bg-neutral-900/50 flex justify-center items-center overflow-auto max-h-[60vh]">
                {/* Certificate sheet wrapper (mimicking A5 paper layout on screen) */}
                <div 
                  id="printable-certificate" 
                  dir="rtl" 
                  className="w-[595px] min-h-[420px] bg-white text-black p-6 border-8 border-double border-emerald-800 shadow-lg rounded-sm relative font-sans text-start select-none"
                >
                  {/* Background watermarked emblem */}
                  <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
                    <svg className="w-80 h-80 text-emerald-800" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                    </svg>
                  </div>

                  {/* Egyptian official header */}
                  <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-3 text-xs font-bold text-emerald-950 font-serif">
                    <div className="space-y-1">
                      <div>جمهورية مصر العربية</div>
                      <div>وزارة الصحة والسكان</div>
                      <div>مديرية الشؤون الصحية بمحافظة القاهرة</div>
                      <div className="font-sans text-[10px] text-neutral-500">Arab Republic of Egypt</div>
                    </div>
                    
                    <div className="text-center space-y-1">
                      {/* Simulated Egyptian Health Crest */}
                      <div className="w-12 h-12 bg-neutral-100 border border-neutral-300 rounded-full flex items-center justify-center mx-auto text-emerald-950 text-xl font-bold">
                        🦅
                      </div>
                      <div className="text-[10px]">شعار الوزارة</div>
                    </div>

                    <div className="text-left space-y-1" dir="ltr">
                      <div>Ministry of Health & Population</div>
                      <div>Directorate of Health Affairs</div>
                      <div className="font-mono text-[9px] text-emerald-800">{selectedCertificateForPrint.serialNumber}</div>
                    </div>
                  </div>

                  {/* Certificate Title */}
                  <div className="text-center my-4 space-y-1">
                    <h2 className="text-xl font-black tracking-widest text-emerald-900 font-serif">
                      {selectedCertificateForPrint.certificateType === "sick_leave" && "شهادة إجازة مرضية رسمية"}
                      {selectedCertificateForPrint.certificateType === "fitness" && "تقرير اللياقة الطبية"}
                      {selectedCertificateForPrint.certificateType === "companion" && "شهادة مرافق مريض"}
                    </h2>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">
                      {selectedCertificateForPrint.certificateType === "sick_leave" && "OFFICIAL MEDICAL SICK LEAVE CERTIFICATE"}
                      {selectedCertificateForPrint.certificateType === "fitness" && "OFFICIAL MEDICAL FITNESS CERTIFICATE"}
                      {selectedCertificateForPrint.certificateType === "companion" && "OFFICIAL COMPANION MEDICAL CLEARANCE"}
                    </p>
                  </div>

                  {/* Certificate Body Content */}
                  <div className="space-y-3.5 text-xs text-neutral-800 leading-relaxed font-semibold">
                    <p>
                      بناءً على الكشف الطبي السريري والفحص المعتمد في مستشفى HMS Egypt، نشهد أن المريض:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-3 rounded-md border border-emerald-100">
                      <div>
                        <span className="text-neutral-500 block text-[10px]">اسم المريض / Patient Name:</span>
                        <span className="text-sm font-black text-black">{patient.nameAr}</span>
                        <span className="text-[10px] text-neutral-500 block">{patient.nameEn}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">الرقم التعريفي / Patient No:</span>
                        <span className="font-mono text-sm font-bold text-black">{patient.patientNumber}</span>
                        <span className="text-[10px] text-neutral-500 block">NID: {patient.uhisNumber || "14-Digit Egyptian NID"}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px]">التشخيص الطبي المعتمد / Diagnosis Assessment:</span>
                      <span className="text-sm font-black text-black">{selectedCertificateForPrint.diagnosis}</span>
                    </div>

                    <p>
                      وقد تبيّن عدم قدرته على أداء عمله، ولذلك يُمنح إجازة مرضية لمدة 
                      <span className="mx-1 text-sm font-black text-emerald-800 underline decoration-2">{selectedCertificateForPrint.restDays}</span> 
                      يوماً (أيام) تبدأ من تاريخ 
                      <span className="mx-1 font-bold text-black">{new Date(selectedCertificateForPrint.startDate).toLocaleDateString("ar-EG")}</span> 
                      وتنتهي في تاريخ 
                      <span className="mx-1 font-bold text-black">{new Date(selectedCertificateForPrint.endDate).toLocaleDateString("ar-EG")}</span>.
                    </p>

                    {selectedCertificateForPrint.notes && (
                      <div className="border-t border-dashed border-neutral-300 pt-2">
                        <span className="text-neutral-500 block text-[10px]">ملاحظات وتوصيات طبية إضافية / Medical Recommendations:</span>
                        <p className="text-black italic">{selectedCertificateForPrint.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Official Stamps and Signatures */}
                  <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-neutral-200 text-[10px] text-neutral-700 font-semibold items-end">
                    {/* QR Verification */}
                    <div className="space-y-1">
                      {/* Simulated QR Code */}
                      <div className="w-16 h-16 bg-neutral-200 border border-neutral-300 p-1 flex items-center justify-center rounded">
                        <div className="w-full h-full" style={{ backgroundImage: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)", backgroundSize: "6px 6px" }} />
                      </div>
                      <div>التحقق الرقمي للشهادة</div>
                      <div className="font-mono text-[8px] text-neutral-400">Scan to Verify Authenticity</div>
                    </div>

                    {/* Official Stamp */}
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full border-4 border-dashed border-red-500/30 flex items-center justify-center text-red-500/40 text-[9px] font-black mx-auto rotate-12 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-center leading-3">مستشفى<br/>HMS Egypt</div>
                      </div>
                      <div>خاتم المستشفى الرسمي</div>
                    </div>

                    {/* Doctor Signatures */}
                    <div className="text-left space-y-3" dir="ltr">
                      <div>
                        <span className="text-neutral-500 block text-[9px]">Physician Signature:</span>
                        <span className="font-serif italic text-black font-bold block pt-1 border-b border-neutral-300 pb-0.5">{selectedCertificateForPrint.doctorNameEn || "Authorized Doctor"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[9px]">Medical Director:</span>
                        <span className="border-b border-neutral-300 w-full block pt-1 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4">
                <Button 
                  onClick={() => window.print()}
                  className="font-bold gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Printer className="w-4 h-4" />
                  {isRtl ? "تنفيذ الطباعة الآن" : "Trigger Print Job"}
                </Button>
                <Button 
                  onClick={() => setIsPrintPreviewOpen(false)}
                  variant="outline"
                  className="font-bold"
                >
                  {isRtl ? "إغلاق المعاينة" : "Close"}
                </Button>
              </DialogFooter>
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-certificate, #printable-certificate * {
                    visibility: visible;
                  }
                  #printable-certificate {
                    position: fixed;
                    left: 50% !important;
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: auto !important;
                    background: white !important;
                    border: 8px double #064e3b !important;
                    box-shadow: none !important;
                    margin: 0 !important;
                    padding: 2rem !important;
                    box-sizing: border-box !important;
                  }
                }
              `}} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nursing Assessment Dialog */}
      <Dialog open={isAssessmentDialogOpen} onOpenChange={setIsAssessmentDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-2xl p-0">
          <DialogHeader onClose={() => setIsAssessmentDialogOpen(false)} className="px-6 py-4 border-b border-border/10">
            <DialogTitle>{isRtl ? "تقييم تمريضي جديد" : "New Nursing Assessment"}</DialogTitle>
            <DialogDescription>
              {isRtl ? "سجل العلامات السريرية، مستوى الألم، وملاحظات الرعاية التمريضية." : "Record clinical observations, pain levels, and nursing care plan details."}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <NursingAssessmentForm 
              patientId={patient.id}
              hospitalId={hospitalId}
              hospitalSlug={hospitalSlug}
              onSuccess={() => setIsAssessmentDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
