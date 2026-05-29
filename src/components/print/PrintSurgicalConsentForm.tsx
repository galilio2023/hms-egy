"use client";

import React from "react";
import { useLocale } from "next-intl";
import { formatNationalId } from "@/lib/utils/formatting";

interface PrintSurgicalConsentFormProps {
  patient: {
    name: string;
    nid: string;
    age: string | number;
    gender: string;
  };
  surgery: {
    procedureNameAr: string;
    procedureNameEn: string;
    surgeonName: string;
    anesthesiaType: string;
    date: string;
  };
  hospitalName?: string;
  hospitalLogoUrl?: string;
}

export function PrintSurgicalConsentForm({
  patient,
  surgery,
  hospitalName = "مستشفى مصر التخصصي / Egypt Specialist Hospital",
}: PrintSurgicalConsentFormProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <div 
      className="p-8 max-w-4xl mx-auto bg-white text-black font-sans leading-relaxed print:p-0 print:m-0"
      dir="rtl"
    >
      {/* Printable Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="text-start">
          <h2 className="text-lg font-black">{hospitalName.split(" / ")[0]}</h2>
          <p className="text-xs text-slate-600">جمهورية مصر العربية - وزارة الصحة</p>
        </div>
        <div className="text-center font-bold text-xl uppercase tracking-wider bg-black text-white px-4 py-2 rounded-lg">
          إقرار موافقة جراحية / Surgical Consent
        </div>
        <div className="text-end" dir="ltr">
          <h2 className="text-sm font-bold">{hospitalName.split(" / ")[1]}</h2>
          <p className="text-[10px] text-slate-600">Arab Republic of Egypt - MOH</p>
        </div>
      </div>

      {/* Patient demographics */}
      <div className="grid grid-cols-2 gap-4 border border-black/30 p-4 rounded-xl mb-6 bg-slate-50/50">
        <div className="space-y-2">
          <p className="text-xs font-bold">
            اسم المريض / Patient Name: <span className="font-semibold text-sm me-2">{patient.name}</span>
          </p>
          <p className="text-xs font-bold">
            الرقم القومي / National ID: <span className="font-mono text-sm me-2">{formatNationalId(patient.nid)}</span>
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold">
            العمر / Age: <span className="font-semibold text-sm me-2">{patient.age}</span>
          </p>
          <p className="text-xs font-bold">
            الجنس / Gender: <span className="font-semibold text-sm me-2">{patient.gender === "male" ? "ذكر / Male" : "أنثى / Female"}</span>
          </p>
        </div>
      </div>

      {/* Surgical details */}
      <div className="border border-black/30 p-4 rounded-xl mb-6 space-y-3">
        <h3 className="text-sm font-black border-b border-black/20 pb-1.5 mb-2">تفاصيل الإجراء الجراحي / Procedure Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold">
              العملية المقررة (بالعربية): <span className="font-semibold text-sm me-2">{surgery.procedureNameAr}</span>
            </p>
            <p className="text-xs font-bold">
              Procedure Name (English): <span className="font-semibold text-sm me-2" dir="ltr">{surgery.procedureNameEn}</span>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold">
              الجراح المسؤول / Surgeon: <span className="font-semibold text-sm me-2">{surgery.surgeonName}</span>
            </p>
            <p className="text-xs font-bold">
              نوع التخدير المقترح / Anesthesia: <span className="font-semibold text-sm me-2">{surgery.anesthesiaType}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Legal Arabic & English Consent Clauses */}
      <div className="space-y-4 text-xs leading-relaxed border border-black/30 p-4 rounded-xl mb-8">
        <div>
          <h4 className="font-black text-sm mb-2 border-b border-black/10 pb-1 text-accent">إقرار المريض (القسم العربي)</h4>
          <ol className="list-decimal list-inside space-y-1.5 pe-2">
            <li>أقر أنا الموقع أدناه برغبتي الحرة في إجراء العملية الجراحية الموضحة أعلاه تحت إشراف الطبيب المذكور.</li>
            <li>لقد تم شرح طبيعة العملية، والمخاطر والمضاعفات المحتملة الحدوث، والبدائل العلاجية المتاحة بوضوح تام من قبل الطبيب المعالج.</li>
            <li>أفوض الجراح وفريق العمل الطبي المساعد لاتخاذ أي إجراءات تعديلية أو جراحية إضافية يرونها ضرورية أثناء سير العملية الجراحية لإنقاذ الحياة أو المحافظة على السلامة الصحية.</li>
            <li>أفوض طبيب التخدير المسؤول لاختيار وتطبيق التخدير المناسب لحالتي ومتابعة رعاية علاماتي الحيوية.</li>
          </ol>
        </div>

        <div className="border-t border-dashed border-black/15 pt-3" dir="ltr">
          <h4 className="font-black text-sm mb-2 border-b border-black/10 pb-1 text-slate-700">Patient Consent (English Section)</h4>
          <ol className="list-decimal list-inside space-y-1.5 ps-2 text-[11px] text-slate-800">
            <li>I hereby authorize Dr. <span className="underline">{surgery.surgeonName}</span> and designees to perform the surgical procedure described above.</li>
            <li>The nature of the procedure, its possible risks, complications, and alternative treatments have been explained to me clearly.</li>
            <li>I authorize the surgical team to perform any additional procedures they deem clinically necessary during the course of the operation to preserve life and safety.</li>
            <li>I consent to the administration of proposed anesthesia under the direction of the anesthesia staff.</li>
          </ol>
        </div>
      </div>

      {/* Signature blocks */}
      <div className="grid grid-cols-3 gap-6 pt-6 border-t border-black/20 text-xs">
        <div className="space-y-4">
          <p className="font-black">توقيع المريض أو ولي الأمر / Patient or Guardian Signature:</p>
          <div className="h-12 border-b border-black/40 border-dotted" />
          <p className="text-[10px] text-slate-500">الاسم / Name: _______________________</p>
          <p className="text-[10px] text-slate-500 font-mono">الرقم القومي للولي / Guardian NID: _______________________</p>
        </div>
        <div className="space-y-4">
          <p className="font-black">توقيع الجراح / Surgeon Signature:</p>
          <div className="h-12 border-b border-black/40 border-dotted" />
          <p className="text-[10px] text-slate-500">التاريخ / Date: {surgery.date}</p>
          <p className="text-[10px] text-slate-500">الوقت / Time: _______________________</p>
        </div>
        <div className="space-y-4">
          <p className="font-black">توقيع الممرض الشاهد / Witness Signature:</p>
          <div className="h-12 border-b border-black/40 border-dotted" />
          <p className="text-[10px] text-slate-500 font-mono">رقم القيد النقابي / Nurse License ID: _______________________</p>
          <p className="text-[10px] text-slate-500">التاريخ / Date: _______________________</p>
        </div>
      </div>

      {/* Footer warning block */}
      <div className="mt-8 text-center text-[10px] text-slate-500 border-t border-black/10 pt-4">
        * هذا الإقرار مستند قانوني رسمي ومطابق لمعايير جودة الرعاية الصحية الصادرة عن الهيئة العامة للاعتماد والرقابة الصحية بمصر (GAHAR).
      </div>
    </div>
  );
}
