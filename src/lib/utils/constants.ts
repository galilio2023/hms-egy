/**
 * HMS Egypt - Global Constants
 */

export const DEPARTMENTS = [
  { id: "general", ar: "الطب العام", en: "General Medicine" },
  { id: "pediatrics", ar: "طب الأطفال", en: "Pediatrics" },
  { id: "cardiology", ar: "أمراض القلب", en: "Cardiology" },
  { id: "orthopedics", ar: "جراحة العظام", en: "Orthopedics" },
  { id: "obstetrics", ar: "النساء والتوليد", en: "Obstetrics & Gynecology" },
  { id: "dermatology", ar: "الأمراض الجلدية", en: "Dermatology" },
  { id: "ophthalmology", ar: "طب العيون", en: "Ophthalmology" },
  { id: "ent", ar: "الأنف والأذن والحنجرة", en: "ENT" },
  { id: "urology", ar: "المسالك البولية", en: "Urology" },
  { id: "neurology", ar: "المخ والأعصاب", en: "Neurology" },
  { id: "psychiatry", ar: "الطب النفسي", en: "Psychiatry" },
  { id: "dentistry", ar: "طب الأسنان", en: "Dentistry" },
  { id: "radiology", ar: "الأشعة", en: "Radiology" },
  { id: "laboratory", ar: "المختبر", en: "Laboratory" },
];

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const PAYMENT_METHODS = [
  { id: "cash", ar: "نقداً", en: "Cash" },
  { id: "card", ar: "بطاقة بنكية", en: "Credit/Debit Card" },
  { id: "vodafone_cash", ar: "فودافون كاش", en: "Vodafone Cash" },
  { id: "fawry", ar: "فوري", en: "Fawry" },
  { id: "instapay", ar: "إنستاباي", en: "InstaPay" },
  { id: "insurance", ar: "تأمين طبي", en: "Insurance" },
];

export const APPOINTMENT_STATUSES = [
  { id: "scheduled", ar: "مجدول", en: "Scheduled" },
  { id: "confirmed", ar: "مؤكد", en: "Confirmed" },
  { id: "arrived", ar: "وصل المريض", en: "Arrived" },
  { id: "in_consultation", ar: "قيد الكشف", en: "In Consultation" },
  { id: "completed", ar: "مكتمل", en: "Completed" },
  { id: "cancelled", ar: "ملغي", en: "Cancelled" },
  { id: "no_show", ar: "لم يحضر", en: "No Show" },
];

export const VAT_RATE = 0.14; // 14% Egyptian VAT
export const STAMP_TAX_RATE = 0.005; // 0.5% Stamp Tax

export const MAX_DAILY_SMS_PER_PATIENT = 3;
export const SESSION_TIMEOUT_MINUTES = 30;
