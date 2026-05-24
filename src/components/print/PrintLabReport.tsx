"use client";

import React from "react";
import { useLocale } from "next-intl";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

import { cn } from "@/lib/utils";

interface LabItem {
  id: string;
  testNameAr: string;
  testNameEn: string;
  loincCode: string | null;
  resultValue: string | null;
  unit: string | null;
  normalRange: string | null;
  isCritical: boolean;
  notes: string | null;
}

interface PrintLabReportProps {
  patient: {
    nameAr: string;
    nameEn: string;
    patientNumber: string;
    gender: string;
    age: string | number;
  };
  order: {
    id: string;
    createdAt: Date;
    doctorNameAr: string;
    doctorNameEn: string;
    clinicalNotes?: string | null;
  };
  items: LabItem[];
  hospital: {
    nameAr: string;
    nameEn: string;
    logoUrl?: string;
  };
}

export function PrintLabReport({
  patient,
  order,
  items,
  hospital,
}: PrintLabReportProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const dateLocale = locale === "ar" ? ar : enUS;

  return (
    <div 
      className="p-8 max-w-5xl mx-auto bg-white text-black font-sans leading-relaxed print:p-0 print:m-0"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ── HEADER AREA ────────────────────────── */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className={cn(isRtl ? "text-right" : "text-left")}>
          <h2 className="text-xl font-black uppercase tracking-tight">{hospital.nameAr}</h2>
          <h3 className="text-sm font-bold text-slate-600">{hospital.nameEn}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">قسم التحاليل الطبية / Laboratory Department</p>
        </div>
        <div className="text-center">
          <div className="font-bold text-lg uppercase bg-black text-white px-6 py-2 rounded-md mb-1 tracking-widest">
            تقرير نتائج المختبر / Laboratory Report
          </div>
          <p className="text-[10px] font-mono font-bold tracking-widest uppercase">ISO 15189 ACCREDITED LABORATORY</p>
        </div>
        <div className={cn(isRtl ? "text-left" : "text-right")} dir="ltr">
          <p className="text-xs font-mono font-bold">Report ID: {order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-[10px] text-slate-500">{format(new Date(), "PPpp", { locale: dateLocale })}</p>
        </div>
      </div>

      {/* ── PATIENT & ORDER INFO ────────────────── */}
      <div className="grid grid-cols-2 gap-0 border border-black/40 rounded-lg overflow-hidden mb-6 text-xs">
        <div className="border-e border-black/40 bg-slate-50/50 p-4 space-y-2">
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">المريض / Patient:</span>
            <span className="font-black">{isRtl ? patient.nameAr : patient.nameEn}</span>
          </div>
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">رقم الملف / MRN:</span>
            <span className="font-mono font-bold">{patient.patientNumber}</span>
          </div>
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">العمر والجنس / Age & Sex:</span>
            <span>{patient.age}Y / {patient.gender === "male" ? "ذكر (M)" : "أنثى (F)"}</span>
          </div>
        </div>
        <div className="p-4 bg-slate-50/50 space-y-2">
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">تاريخ الطلب / Request Date:</span>
            <span dir="ltr">{format(order.createdAt, "PPpp", { locale: dateLocale })}</span>
          </div>
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">الطبيب المعالج / Physician:</span>
            <span className="font-bold">{isRtl ? order.doctorNameAr : order.doctorNameEn}</span>
          </div>
          <div className="flex justify-between border-b border-black/10 pb-1">
            <span className="font-bold">الحالة الإكلينيكية / Clinical Info:</span>
            <span className="italic truncate max-w-[150px]">{order.clinicalNotes || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* ── RESULTS TABLE ───────────────────────── */}
      <table className="w-full border-collapse border border-black/60 text-xs mb-8">
        <thead>
          <tr className="bg-slate-100 font-black uppercase text-center border-b border-black/60">
            <th className="border border-black/60 p-3 w-[35%]">{isRtl ? "الفحص" : "Test Description"}</th>
            <th className="border border-black/60 p-3 w-[20%]">{isRtl ? "النتيجة" : "Result"}</th>
            <th className="border border-black/60 p-3 w-[15%]">{isRtl ? "الوحدة" : "Unit"}</th>
            <th className="border border-black/60 p-3 w-[25%]">{isRtl ? "النطاق الطبيعي" : "Normal Range"}</th>
            <th className="border border-black/60 p-3 w-[5%]">#</th>
          </tr>
        </thead>
        <tbody className="font-medium">
          {items.map((item, idx) => (
            <tr key={item.id} className={cn("border-b border-black/20", item.isCritical && "bg-rose-50 font-black")}>
              <td className="border border-black/20 p-3">
                <div className="flex flex-col">
                  <span className="font-bold">{isRtl ? item.testNameAr : item.testNameEn}</span>
                  {item.loincCode && <span className="text-[9px] font-mono text-slate-500">{item.loincCode}</span>}
                </div>
              </td>
              <td className="border border-black/20 p-3 text-center text-lg">
                <span className={cn(item.isCritical && "text-rose-600 underline underline-offset-4")}>
                  {item.resultValue || "PENDING"}
                </span>
              </td>
              <td className="border border-black/20 p-3 text-center text-slate-600">
                {item.unit || "—"}
              </td>
              <td className="border border-black/20 p-3 text-center text-slate-500 font-mono italic" dir="ltr">
                {item.normalRange || "—"}
              </td>
              <td className="border border-black/20 p-3 text-center font-black">
                {item.isCritical ? "H*" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── COMMENTS & INTERPRETATION ───────────── */}
      {items.some(i => i.notes) && (
        <div className="mb-8 p-4 border border-black/20 rounded-xl bg-slate-50/30">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">تعليقات المختبر / Laboratory Comments:</h4>
          <ul className="list-disc ps-5 space-y-2 text-[11px] font-medium italic">
            {items.map(item => item.notes && (
              <li key={item.id}>
                <span className="font-bold not-italic">{isRtl ? item.testNameAr : item.testNameEn}:</span> {item.notes}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── FOOTER & SIGNATURE ──────────────────── */}
      <div className="mt-auto pt-12">
        <div className="grid grid-cols-3 gap-8 text-[11px]">
          <div className="text-center space-y-4">
            <p className="font-bold border-b border-black/20 pb-1">أخصائي التحاليل / Technologist</p>
            <div className="h-16 flex items-center justify-center opacity-30 grayscale contrast-125">
               {/* Placeholder for Signature Stamp */}
               <div className="border-2 border-indigo-600 text-indigo-600 px-4 py-1 rotate-12 font-black text-sm uppercase">Verified Digital</div>
            </div>
          </div>
          <div className="text-center space-y-4">
            <p className="font-bold border-b border-black/20 pb-1">مدير المختبر / Lab Director</p>
            <div className="pt-8">
              <p className="font-black">د. محمود المصري</p>
              <p className="text-[9px] text-slate-500 uppercase">Consultant Clinical Pathologist</p>
            </div>
          </div>
          <div className="text-center space-y-4">
            <p className="font-bold border-b border-black/20 pb-1">ختم المستشفى / Hospital Stamp</p>
            <div className="h-20 w-20 mx-auto rounded-full border-4 border-slate-200 border-double flex items-center justify-center">
               <div className="h-16 w-16 rounded-full border-2 border-slate-200 border-dashed" />
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-[9px] text-slate-400 border-t border-slate-100 pt-4 font-medium uppercase tracking-widest">
          هذا التقرير تم إنشاؤه إلكترونياً ولا يتطلب توقيعاً حياً ما لم يطلب لجهة رسمية خارجية.
          <br />
          This report is electronically generated and verified. No physical signature required.
        </div>
      </div>
    </div>
  );
}
