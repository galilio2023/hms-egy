import { toZonedTime } from "date-fns-tz";

export const GOVERNORATES: Record<string, { code: string; ar: string; en: string }> = {
  "01": { code: "01", ar: "القاهرة", en: "Cairo" },
  "02": { code: "02", ar: "الإسكندرية", en: "Alexandria" },
  "03": { code: "03", ar: "بورسعيد", en: "Port Said" },
  "04": { code: "04", ar: "السويس", en: "Suez" },
  "11": { code: "11", ar: "دمياط", en: "Damietta" },
  "12": { code: "12", ar: "الدقهلية", en: "Dakahlia" },
  "13": { code: "13", ar: "الشرقية", en: "Sharqia" },
  "14": { code: "14", ar: "القليوبية", en: "Qalyubia" },
  "15": { code: "15", ar: "كفر الشيخ", en: "Kafr El Sheikh" },
  "16": { code: "16", ar: "الغربية", en: "Gharbia" },
  "17": { code: "17", ar: "المنوفية", en: "Menofia" },
  "18": { code: "18", ar: "البحيرة", en: "Beheira" },
  "19": { code: "19", ar: "الإسماعيلية", en: "Ismailia" },
  "21": { code: "21", ar: "الجيزة", en: "Giza" },
  "22": { code: "22", ar: "بني سويف", en: "Beni Suef" },
  "23": { code: "23", ar: "الفيوم", en: "Fayoum" },
  "24": { code: "24", ar: "المنيا", en: "Minya" },
  "25": { code: "25", ar: "أسيوط", en: "Asyut" },
  "26": { code: "26", ar: "سوهاج", en: "Sohag" },
  "27": { code: "27", ar: "قنا", en: "Qena" },
  "28": { code: "28", ar: "أسوان", en: "Aswan" },
  "29": { code: "29", ar: "الأقصر", en: "Luxor" },
  "31": { code: "31", ar: "البحر الأحمر", en: "Red Sea" },
  "32": { code: "32", ar: "الوادي الجديد", en: "New Valley" },
  "33": { code: "33", ar: "مطروح", en: "Matrouh" },
  "34": { code: "34", ar: "شمال سيناء", en: "North Sinai" },
  "35": { code: "35", ar: "جنوب سيناء", en: "South Sinai" },
  "88": { code: "88", ar: "خارج الجمهورية", en: "Outside Egypt" },
};

export const EGYPTIAN_INSURANCE_PROVIDERS = [
  { 
    id: "hio", 
    nameAr: "الهيئة العامة للتأمين الصحي", 
    nameEn: "Health Insurance Organization (HIO)", 
    type: "government" 
  },
  { 
    id: "uhis", 
    nameAr: "التأمين الصحي الشامل", 
    nameEn: "Universal Health Insurance System (UHIS)", 
    type: "government",
    rolloutGovernorates: ["03", "29", "19", "35", "04", "28"] // Port Said, Luxor, Ismailia, South Sinai, Suez, Aswan
  },
  { id: "axa", nameAr: "أكسا للتأمين", nameEn: "AXA Insurance", type: "private" },
  { id: "metlife", nameAr: "متلايف", nameEn: "MetLife", type: "private" },
  { id: "bupa", nameAr: "بوبا", nameEn: "Bupa", type: "private" },
  { id: "misr", nameAr: "مصر للتأمين", nameEn: "Misr Insurance", type: "private" },
  { id: "military", nameAr: "إدارة الخدمات الطبية للقوات المسلحة", nameEn: "Armed Forces Medical Service", type: "military" },
];

/**
 * Validates the 14-digit Egyptian National ID with strict date checking.
 */
export function validateNationalId(nid: string): boolean {
  if (!/^\d{14}$/.test(nid)) return false;

  const centuryCode = parseInt(nid[0]);
  if (centuryCode !== 2 && centuryCode !== 3) return false;

  const year = parseInt(nid.substring(1, 3)) + (centuryCode === 2 ? 1900 : 2000);
  const month = parseInt(nid.substring(3, 5)) - 1; // JS months are 0-indexed
  const day = parseInt(nid.substring(5, 7));

  const dob = new Date(year, month, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month || dob.getDate() !== day) {
    return false;
  }

  const govCode = nid.substring(7, 9);
  if (!GOVERNORATES[govCode]) return false;

  return true;
}

/**
 * Parses birth date, gender, and governorate from Egyptian National ID.
 */
export function parseNationalId(nid: string) {
  if (!validateNationalId(nid)) return null;

  const centuryCode = parseInt(nid[0]);
  const century = centuryCode === 2 ? 1900 : 2000;
  const year = parseInt(nid.substring(1, 3)) + century;
  const month = parseInt(nid.substring(3, 5)) - 1;
  const day = parseInt(nid.substring(5, 7));
  const dob = new Date(year, month, day);

  const govCode = nid.substring(7, 9);
  const governorate = GOVERNORATES[govCode];

  const genderCode = parseInt(nid[12]);
  const gender = genderCode % 2 === 0 ? "female" : "male";

  return { dob, gender, governorate, century };
}

/**
 * Formats a unique patient number.
 * Pattern: HMS-{HOSPITAL_CODE}-{YYYY}-{NNNNNN}
 */
export function formatPatientNumber(hospitalCode: string, year: number, seq: number): string {
  return `HMS-${hospitalCode}-${year}-${seq.toString().padStart(6, "0")}`;
}

/**
 * Checks if a given date is a working day in Egypt (excludes Fridays and Saturdays).
 * Accounts for Africa/Cairo timezone.
 */
export function isWorkingDay(date: Date): boolean {
  const zonedDate = toZonedTime(date, "Africa/Cairo");
  const day = zonedDate.getDay();
  return day !== 5 && day !== 6; // 5 = Friday, 6 = Saturday
}

/**
 * Returns common public holidays in Egypt for a given year.
 * Note: Islamic holidays are approximations as they depend on the lunar calendar.
 */
export function getPublicHolidays(year: number) {
  return [
    { date: new Date(year, 0, 7), nameAr: "عيد الميلاد المجيد", nameEn: "Coptic Christmas Day", isIslamic: false },
    { date: new Date(year, 0, 25), nameAr: "ثورة ٢٥ يناير / عيد الشرطة", nameEn: "Revolution Day / Police Day", isIslamic: false },
    { date: new Date(year, 3, 25), nameAr: "عيد تحرير سيناء", nameEn: "Sinai Liberation Day", isIslamic: false },
    { date: new Date(year, 4, 1), nameAr: "عيد العمال", nameEn: "Labor Day", isIslamic: false },
    { date: new Date(year, 5, 30), nameAr: "ثورة ٣٠ يونيو", nameEn: "June 30 Revolution Day", isIslamic: false },
    { date: new Date(year, 6, 23), nameAr: "عيد الثورة", nameEn: "Revolution Day", isIslamic: false },
    { date: new Date(year, 9, 6), nameAr: "عيد القوات المسلحة", nameEn: "Armed Forces Day", isIslamic: false },
  ];
}
