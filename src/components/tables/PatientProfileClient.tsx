"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, 
  Phone, 
  MapPin, 
  Heart, 
  ShieldAlert, 
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
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  BriefcaseMedical
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientProfileClientProps {
  patient: any;
  surgeries: any[];
  hospitalSlug: string;
}

export function PatientProfileClient({ patient, surgeries, hospitalSlug }: PatientProfileClientProps) {
  const t = useTranslations("patients");
  const locale = useLocale();
  const isRtl = locale === "ar";
  
  const [activeTab, setActiveTab] = useState<"medical" | "admissions" | "surgical" | "financials" | "consents">("surgical");
  const [expandedSurgeryId, setExpandedSurgeryId] = useState<string | null>(null);

  // Parse custom mock values or actual values
  const hasAllergies = patient.address?.includes("Penicillin") || patient.address?.includes("Allergy") || Math.random() > 0.5; // fallback check for demo
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

  const tabs = [
    { id: "medical", label: isRtl ? "السجل الطبي" : "Medical Records", icon: Stethoscope },
    { id: "admissions", label: isRtl ? "التنويم والرعاية" : "Admissions & Care", icon: BriefcaseMedical },
    { id: "surgical", label: isRtl ? "السجل الجراحي" : "Surgical History", icon: Scissors, badge: surgeries.length },
    { id: "financials", label: isRtl ? "الفواتير والحسابات" : "Financials & Invoices", icon: Coins },
    { id: "consents", label: isRtl ? "الموافقات الموقعة" : "Signed Consents", icon: FileText },
  ] as const;

  const toggleSurgeryExpand = (id: string) => {
    setExpandedSurgeryId(expandedSurgeryId === id ? null : id);
  };

  const LeftArrow = isRtl ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      
      {/* 1. Demographics Summary Header Card */}
      <Card className="border border-border/40 shadow-xl overflow-hidden bg-background relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-primary to-emerald-500" />
        
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

        {/* Tab B: Medical Records (Mock clinical info) */}
        {activeTab === "medical" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div>
              <h3 className="text-lg font-black text-foreground">Clinical SOAP & Outpatient encounters</h3>
              <p className="text-xs text-muted-foreground">Historical records of doctor diagnostic assessments, SOAP logs, and pharmacy medication prescriptions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left/Start: Vitals Logs panel */}
              <div className="space-y-4">
                <Card className="border border-border/30 bg-background rounded-2xl shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary border-b pb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Recent Patient Vitals
                    </h4>
                    
                    <div className="space-y-3 font-semibold text-xs">
                      <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50 border border-gray-100/50">
                        <span className="text-muted-foreground">Blood Pressure</span>
                        <span className="font-mono text-foreground font-bold">120/80 mmHg</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50 border border-gray-100/50">
                        <span className="text-muted-foreground">Heart Pulse rate</span>
                        <span className="font-mono text-foreground font-bold">72 bpm</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50 border border-gray-100/50">
                        <span className="text-muted-foreground">SpO2 level</span>
                        <span className="font-mono text-foreground font-bold">98%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50 border border-gray-100/50">
                        <span className="text-muted-foreground">Body Temperature</span>
                        <span className="font-mono text-foreground font-bold">37.0 °C</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right/End: Diagnostic assessment encounters list */}
              <div className="md:col-span-2 space-y-4">
                {[
                  {
                    date: "May 10, 2026",
                    clinic: "Cardiology Clinic",
                    doctor: "Dr. Ahmed El-Shennawy",
                    notes: "Patient complained of mild localized chest discomfort during cardiovascular stress test. Prescribed minor blood thinners, scheduled regular follow-up appointment.",
                    diagnosis: "Mild Hypertension",
                  },
                  {
                    date: "April 18, 2026",
                    clinic: "Internal Medicine",
                    doctor: "Dr. Mariam Farahat",
                    notes: "Routine health screening. Blood glucose and lipid profiles within acceptable boundaries. Patient advised to maintain proper NPO diet plans.",
                    diagnosis: "None (Healthy Assessment)",
                  }
                ].map((item, idx) => (
                  <Card key={idx} className="border border-border/30 bg-background rounded-2xl shadow-sm">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex justify-between items-center border-b border-border/10 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{item.clinic}</h4>
                          <span className="text-[10px] text-muted-foreground font-semibold">{item.doctor}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-accent">{item.date}</span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed font-semibold bg-gray-50/50 p-3 rounded-xl border border-gray-100/60">
                        {item.notes}
                      </p>
                      <div className="text-[10px] text-muted-foreground font-medium pt-1">
                        Primary Diagnosis: <Badge variant="outline" className="text-[9px] font-extrabold">{item.diagnosis}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab C: Admissions & Care (Mock admissions) */}
        {activeTab === "admissions" && (
          <div className="space-y-6 animate-in fade-in duration-300 text-start">
            <div>
              <h3 className="text-lg font-black text-foreground">Inpatient Admissions & Active Ward Beds</h3>
              <p className="text-xs text-muted-foreground">Historical records of surgical ward admissions, critical care bed occupancy, and nursing observation logs.</p>
            </div>

            <Card className="border border-border/30 bg-background rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <Activity className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-bold text-foreground">No Active Admissions</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">This patient is currently being managed as an outpatient and is not admitted to any hospital bed wing.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

      </div>

    </div>
  );
}
