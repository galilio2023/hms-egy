"use client";

import React from "react";
import { useLocale } from "next-intl";
import { formatNationalId } from "@/lib/utils/formatting";

interface VitalsSample {
  time: string;
  bp: string; // e.g. "120/80"
  hr: number;
  spo2: number;
  etco2?: number;
  temp?: number;
}

interface PrintAnesthesiaRecordProps {
  patient: {
    name: string;
    nid: string;
    age: string | number;
    gender: string;
  };
  anesthesia: {
    anesthesiologistName: string;
    asaClass: string;
    anesthesiaType: string;
    npoStatus: string;
    inductionAgents: string[];
    maintenanceAgents: string[];
    intubationType: string;
    vascularAccess: string[];
    vitalsTrend: VitalsSample[];
    recoveryScore?: number;
    startTime: string;
    endTime: string;
    notes?: string;
  };
  caseNumber: string;
}

export function PrintAnesthesiaRecord({
  patient,
  anesthesia,
  caseNumber,
}: PrintAnesthesiaRecordProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <div 
      className="p-8 max-w-5xl mx-auto bg-white text-black font-sans leading-relaxed print:p-0 print:m-0"
      dir="rtl"
    >
      {/* Header Area */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="text-start">
          <h2 className="text-md font-bold">مستشفى مصر التخصصي</h2>
          <p className="text-[10px] text-slate-500">قسم التخدير والرعاية المركزة</p>
        </div>
        <div className="text-center font-bold text-lg uppercase bg-slate-900 text-white px-4 py-1.5 rounded-md">
          سجل التخدير العملياتي / Intraoperative Anesthesia Record
        </div>
        <div className="text-end" dir="ltr">
          <p className="text-xs font-mono font-bold">Case Ref: {caseNumber}</p>
          <p className="text-[10px] text-slate-500">Egypt Specialist Hospital</p>
        </div>
      </div>

      {/* Demographics Grid */}
      <table className="w-full border-collapse border border-black/30 text-xs mb-6">
        <tbody>
          <tr>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">اسم المريض / Patient:</td>
            <td className="border border-black/30 p-2 font-semibold">{patient.name}</td>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">الرقم القومي / NID:</td>
            <td className="border border-black/30 p-2 font-mono">{formatNationalId(patient.nid)}</td>
          </tr>
          <tr>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">العمر / Age:</td>
            <td className="border border-black/30 p-2">{patient.age}</td>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">الجنس / Gender:</td>
            <td className="border border-black/30 p-2">{patient.gender === "male" ? "ذكر / Male" : "أنثى / Female"}</td>
          </tr>
          <tr>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">طبيب التخدير / Anesthesiologist:</td>
            <td className="border border-black/30 p-2 font-semibold">{anesthesia.anesthesiologistName}</td>
            <td className="border border-black/30 p-2 font-bold bg-slate-50">تصنيف الجمعية الأمريكية (ASA):</td>
            <td className="border border-black/30 p-2 font-bold text-accent">{anesthesia.asaClass.toUpperCase()}</td>
          </tr>
        </tbody>
      </table>

      {/* Clinical details */}
      <div className="grid grid-cols-2 gap-4 border border-black/30 p-4 rounded-xl mb-6">
        <div className="space-y-2 text-xs">
          <h4 className="font-bold border-b border-black/10 pb-1 mb-1.5 text-accent">عوامل التخدير والأدوات / Anesthesia & Airway</h4>
          <p><span className="font-bold">نوع التخدير / Type:</span> {anesthesia.anesthesiaType}</p>
          <p><span className="font-bold">حالة الصيام / NPO Status:</span> {anesthesia.npoStatus}</p>
          <p><span className="font-bold">طريقة التنفس / Intubation:</span> {anesthesia.intubationType}</p>
          <p>
            <span className="font-bold">المنافذ الوريدية / Vascular Access:</span>{" "}
            {anesthesia.vascularAccess?.join(" | ") || "لا يوجد"}
          </p>
        </div>
        <div className="space-y-2 text-xs">
          <h4 className="font-bold border-b border-black/10 pb-1 mb-1.5 text-slate-700">الأدوية المستخدمة / Agents Given</h4>
          <p>
            <span className="font-bold">أدوية الحث / Induction:</span>{" "}
            <span className="font-mono text-[11px]">{anesthesia.inductionAgents?.join(", ") || "لا يوجد"}</span>
          </p>
          <p>
            <span className="font-bold">أدوية الحفاظ / Maintenance:</span>{" "}
            <span className="font-mono text-[11px]">{anesthesia.maintenanceAgents?.join(", ") || "لا يوجد"}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-black/5">
            <p><span className="font-bold">البدء / Start:</span> <span dir="ltr">{anesthesia.startTime}</span></p>
            <p><span className="font-bold">الانتهاء / End:</span> <span dir="ltr">{anesthesia.endTime}</span></p>
          </div>
        </div>
      </div>

      {/* Vitals grid at 5-minute intervals */}
      <div className="mb-6">
        <h4 className="text-xs font-black mb-2 border-b border-black pb-1">مخطط العلامات الحيوية أثناء العملية / Intraoperative Vitals Trend Grid</h4>
        <table className="w-full border-collapse border border-black/40 text-center text-[10px] font-mono">
          <thead>
            <tr className="bg-slate-100 text-xs font-sans font-bold">
              <th className="border border-black/40 p-2">الوقت / Time</th>
              <th className="border border-black/40 p-2">الضغط الشرياني / BP</th>
              <th className="border border-black/40 p-2">نبض القلب / HR (bpm)</th>
              <th className="border border-black/40 p-2">نسبة الأكسجين / SpO2 (%)</th>
              <th className="border border-black/40 p-2">ثاني أكسيد الكربون / EtCO2</th>
              <th className="border border-black/40 p-2">حرارة الجسم / Temp (°C)</th>
            </tr>
          </thead>
          <tbody>
            {anesthesia.vitalsTrend && anesthesia.vitalsTrend.length > 0 ? (
              anesthesia.vitalsTrend.map((v, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-black/40 p-1.5 font-bold">{v.time}</td>
                  <td className="border border-black/40 p-1.5">{v.bp}</td>
                  <td className="border border-black/40 p-1.5 font-bold text-red-600">{v.hr}</td>
                  <td className="border border-black/40 p-1.5 font-bold text-emerald-600">{v.spo2}</td>
                  <td className="border border-black/40 p-1.5">{v.etco2 ?? "-"}</td>
                  <td className="border border-black/40 p-1.5">{v.temp ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border border-black/40 p-4 font-sans text-muted-foreground text-center">
                  لم يتم تسجيل قراءات حيوية أثناء العملية بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Post-op details and recovery score */}
      <div className="grid grid-cols-3 gap-4 border border-black/30 p-4 rounded-xl mb-6 text-xs">
        <div className="col-span-2 space-y-1.5">
          <p className="font-bold">ملاحظات الإفاقة والرعاية اللاحقة / Post-Op Recovery Notes:</p>
          <p className="text-slate-700 min-h-[40px] italic">{anesthesia.notes || "لا توجد ملاحظات إضافية."}</p>
        </div>
        <div className="border-r border-black/15 pe-4 flex flex-col justify-center items-center text-center">
          <span className="font-bold block mb-1">مقياس الدريت للإفاقة / Aldrete Score</span>
          <div className="text-2xl font-black text-accent bg-accent/10 border border-accent/25 px-4 py-1.5 rounded-lg">
            {anesthesia.recoveryScore ?? "-"} / 10
          </div>
          <span className="text-[9px] text-slate-500 mt-1">الدرجة ≥ 9 تؤهل للخروج لجناح المرضى</span>
        </div>
      </div>

      {/* Signature */}
      <div className="flex justify-between items-center pt-6 border-t border-black/20 text-xs">
        <div>
          <p className="font-bold">طبيب التخدير المتابع / Attending Anesthesiologist:</p>
          <p className="text-slate-600 mt-1">د. {anesthesia.anesthesiologistName}</p>
        </div>
        <div className="text-end" dir="ltr">
          <p className="font-bold">Signature / التوقيع الإلكتروني أو اليدوي:</p>
          <div className="h-10 w-48 border-b border-black/40 border-dotted mt-1" />
        </div>
      </div>
    </div>
  );
}
