"use client";

import React from "react";
import { useLocale } from "next-intl";

interface PlannedCase {
  caseNumber: string;
  time: string; // e.g. "09:00 - 11:30"
  orRoomName: string; // e.g. "OR-1"
  patientName: string;
  procedureName: string;
  surgeonName: string;
  anesthesiaType: string;
  priority: "routine" | "urgent" | "emergency";
}

interface PrintOrScheduleProps {
  date: string;
  plannedCases: PlannedCase[];
  hospitalName?: string;
}

export function PrintOrSchedule({
  date,
  plannedCases,
  hospitalName = "مستشفى مصر التخصصي / Egypt Specialist Hospital",
}: PrintOrScheduleProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "emergency": return "طوارئ قصوى / Emergency";
      case "urgent": return "عاجل / Urgent";
      default: return "عادي / Routine";
    }
  };

  const getPriorityColorClass = (p: string) => {
    switch (p) {
      case "emergency": return "text-red-600 bg-red-500/10 border-red-500/20";
      case "urgent": return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  return (
    <div 
      className="p-8 max-w-5xl mx-auto bg-white text-black font-sans leading-relaxed print:p-0 print:m-0"
      dir="rtl"
    >
      {/* Header Area */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="text-right">
          <h2 className="text-lg font-black">{hospitalName.split(" / ")[0]}</h2>
          <p className="text-xs text-slate-500">مجمع غرف العمليات والكتل الجراحية</p>
        </div>
        <div className="text-center">
          <span className="font-bold text-lg bg-black text-white px-4 py-2 rounded-lg block mb-1">
            جدول العمليات اليومي / Daily OR Block Schedule
          </span>
          <p className="text-xs font-bold mt-1">تاريخ اليوم / Date: <span className="underline font-mono">{date}</span></p>
        </div>
        <div className="text-left" dir="ltr">
          <h2 className="text-sm font-bold">{hospitalName.split(" / ")[1]}</h2>
          <p className="text-[10px] text-slate-500">Operating Suite Management</p>
        </div>
      </div>

      {/* Main Cases Table Grid */}
      <table className="w-full border-collapse border border-black/40 text-xs text-right">
        <thead>
          <tr className="bg-slate-100 text-center font-bold">
            <th className="border border-black/40 p-2.5 w-12">التوقيت / Time</th>
            <th className="border border-black/40 p-2.5 w-16">رقم العمليات / Room</th>
            <th className="border border-black/40 p-2.5 w-32">المريض / Patient Name</th>
            <th className="border border-black/40 p-2.5 w-48">الإجراء الجراحي / Planned Procedure</th>
            <th className="border border-black/40 p-2.5 w-32">الجراح / Surgeon</th>
            <th className="border border-black/40 p-2.5 w-24">التخدير / Anesthesia</th>
            <th className="border border-black/40 p-2.5 w-24">الأولوية / Priority</th>
          </tr>
        </thead>
        <tbody>
          {plannedCases && plannedCases.length > 0 ? (
            plannedCases.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-all border-b border-black/20">
                <td className="border border-black/40 p-2 text-center font-mono font-bold" dir="ltr">{item.time}</td>
                <td className="border border-black/40 p-2 text-center font-bold text-accent bg-accent/5">{item.orRoomName}</td>
                <td className="border border-black/40 p-2 font-semibold">
                  {item.patientName}
                  <span className="block text-[9px] text-slate-500 font-mono" dir="ltr">{item.caseNumber}</span>
                </td>
                <td className="border border-black/40 p-2 leading-tight font-medium">{item.procedureName}</td>
                <td className="border border-black/40 p-2 font-semibold">د. {item.surgeonName}</td>
                <td className="border border-black/40 p-2">{item.anesthesiaType}</td>
                <td className="border border-black/40 p-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded font-bold border text-[10px] ${getPriorityColorClass(item.priority)}`}>
                    {getPriorityLabel(item.priority)}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="border border-black/40 p-6 text-center text-slate-500 font-bold">
                لا توجد عمليات مبرمجة في هذا التاريخ.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Layout signatures and disclaimer footer */}
      <div className="grid grid-cols-2 gap-8 pt-10 mt-12 border-t border-black/20 text-xs">
        <div className="space-y-4">
          <p className="font-bold">المشرف المسؤول على مجمع غرف العمليات / OR Charge Nurse Supervisor:</p>
          <div className="h-10 w-64 border-b border-black/40 border-dotted" />
          <p className="text-[10px] text-slate-500">الاسم والتوقيع / Signature & ID: _______________________</p>
        </div>
        <div className="space-y-4 text-left" dir="ltr">
          <p className="font-bold">Chief of Surgical Services / رئيس قسم العمليات والجراحة:</p>
          <div className="h-10 w-64 border-b border-black/40 border-dotted me-auto" />
          <p className="text-[10px] text-slate-500">Signature / التوقيع: _______________________</p>
        </div>
      </div>

      {/* Audit compliance notes */}
      <div className="mt-8 text-center text-[9px] text-slate-400 border-t border-black/5 pt-4">
        هذا الجدول مستند رسمي داخلي لإدارة الطاقم والجاهزية، يخضع للتحديث الدوري من قبل مكتب التنسيق الطبي بمستشفى مصر التخصصي.
      </div>
    </div>
  );
}
