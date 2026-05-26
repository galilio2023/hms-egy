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

/**
 * Resolves a governorate string (either code, Arabic name, or English name) to its 2-digit code.
 */
export function getGovernorateCode(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim();
  if (GOVERNORATES[cleaned]) return cleaned;
  
  const lower = cleaned.toLowerCase();
  for (const [code, gov] of Object.entries(GOVERNORATES)) {
    if (gov.en.toLowerCase() === lower || gov.ar === cleaned) {
      return code;
    }
  }
  return null;
}


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
 * Note: Only supports patients born between 1900 and 2099 (century codes 2 and 3).
 */
export function validateNationalId(nid: string): boolean {
  if (!/^\d{14}$/.test(nid)) return false;

  const centuryCode = parseInt(nid[0]);
  if (centuryCode !== 2 && centuryCode !== 3 && centuryCode !== 4) return false;

  const century = centuryCode === 2 ? 1900 : centuryCode === 3 ? 2000 : 2100;
  const year = parseInt(nid.substring(1, 3)) + century;
  const month = parseInt(nid.substring(3, 5)) - 1; // JS months are 0-indexed
  const day = parseInt(nid.substring(5, 7));

  const dob = new Date(Date.UTC(year, month, day));
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month || dob.getUTCDate() !== day) {
    return false;
  }

  if (dob > new Date()) {
    return false;
  }

  const govCode = nid.substring(7, 9);
  if (!GOVERNORATES[govCode]) return false;

  return true;
}

/**
 * Parses birth date, gender, and governorate from Egyptian National ID.
 */
export function parseEgyptianNationalId(nid: string) {
  if (!validateNationalId(nid)) return null;

  const centuryCode = parseInt(nid[0]);
  const century = centuryCode === 2 ? 1900 : centuryCode === 3 ? 2000 : 2100;
  const year = parseInt(nid.substring(1, 3)) + century;
  const month = parseInt(nid.substring(3, 5)) - 1;
  const day = parseInt(nid.substring(5, 7));
  const dob = new Date(Date.UTC(year, month, day));

  const govCode = nid.substring(7, 9);
  const governorate = GOVERNORATES[govCode];

  const genderCode = parseInt(nid[12]);
  const gender = genderCode % 2 === 0 ? "female" : "male";

  return { dob, gender, governorate, century };
}

/**
 * @deprecated Use parseEgyptianNationalId instead
 */
export const parseNationalId = parseEgyptianNationalId;

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
 * Database of Egyptian shifting/lunar public holidays (2024–2030).
 * Months are 0-indexed to match JS Date.
 */
const SHIFTING_HOLIDAYS_DB: Record<number, { month: number; day: number; nameAr: string; nameEn: string }[]> = {
  2024: [
    { month: 4, day: 6, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 3, day: 9, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 10, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 11, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 12, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 5, day: 15, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 5, day: 16, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 17, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 18, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 19, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 6, day: 7, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 8, day: 15, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2025: [
    { month: 3, day: 21, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 2, day: 30, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 2, day: 31, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 1, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 5, day: 6, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 5, day: 7, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 8, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 9, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 10, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 26, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 8, day: 4, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2026: [
    { month: 3, day: 13, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 2, day: 19, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 2, day: 20, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 2, day: 21, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 4, day: 26, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 4, day: 27, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 28, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 29, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 30, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 16, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 7, day: 25, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2027: [
    { month: 4, day: 3, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 2, day: 9, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 2, day: 10, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 2, day: 11, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 4, day: 16, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 4, day: 17, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 18, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 19, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 20, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 5, day: 5, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 7, day: 14, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2028: [
    { month: 3, day: 17, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 1, day: 26, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 27, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 28, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 4, day: 4, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 4, day: 5, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 6, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 7, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 8, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 24, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 7, day: 2, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2029: [
    { month: 3, day: 9, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 1, day: 14, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 15, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 16, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 23, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 3, day: 24, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 25, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 26, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 27, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 13, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 6, day: 23, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
  2030: [
    { month: 3, day: 29, nameAr: "شم النسيم", nameEn: "Sham El-Nessim" },
    { month: 1, day: 4, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 5, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 1, day: 6, nameAr: "عيد الفطر المبارك", nameEn: "Eid Al-Fitr" },
    { month: 3, day: 12, nameAr: "وقفة عرفات", nameEn: "Arafat Day" },
    { month: 3, day: 13, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 14, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 15, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 3, day: 16, nameAr: "عيد الأضحى المبارك", nameEn: "Eid Al-Adha" },
    { month: 4, day: 2, nameAr: "رأس السنة الهجرية", nameEn: "Islamic New Year" },
    { month: 6, day: 12, nameAr: "المولد النبوي الشريف", nameEn: "Prophet's Birthday" },
  ],
};

/**
 * Returns common public holidays in Egypt for a given year.
 * Combines fixed national holidays and dynamic shifting holidays.
 */
export function getPublicHolidays(year: number) {
  const fixed = [
    { date: new Date(Date.UTC(year, 0, 7)), nameAr: "عيد الميلاد المجيد", nameEn: "Coptic Christmas Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 0, 25)), nameAr: "ثورة ٢٥ يناير / عيد الشرطة", nameEn: "Revolution Day / Police Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 3, 25)), nameAr: "عيد تحرير سيناء", nameEn: "Sinai Liberation Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 4, 1)), nameAr: "عيد العمال", nameEn: "Labor Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 5, 30)), nameAr: "ثورة ٣٠ يونيو", nameEn: "June 30 Revolution Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 6, 23)), nameAr: "عيد الثورة", nameEn: "Revolution Day", isIslamic: false },
    { date: new Date(Date.UTC(year, 9, 6)), nameAr: "عيد القوات المسلحة", nameEn: "Armed Forces Day", isIslamic: false },
  ];

  const shifting = SHIFTING_HOLIDAYS_DB[year] || [];
  const shiftingMapped = shifting.map((h) => ({
    date: new Date(Date.UTC(year, h.month, h.day)),
    nameAr: h.nameAr,
    nameEn: h.nameEn,
    isIslamic: h.nameAr !== "شم النسيم",
  }));

  return [...fixed, ...shiftingMapped];
}

/**
 * Checks if a given date is an official public holiday in Egypt.
 * Resolves dates in the Africa/Cairo timezone to avoid off-by-one errors.
 */
export function isEgyptianPublicHoliday(date: Date): { isHoliday: boolean; nameAr?: string; nameEn?: string } | null {
  const zoned = toZonedTime(date, "Africa/Cairo");
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();

  const holidays = getPublicHolidays(year);
  for (const h of holidays) {
    const hZoned = toZonedTime(h.date, "Africa/Cairo");
    if (
      hZoned.getFullYear() === year &&
      hZoned.getMonth() === month &&
      hZoned.getDate() === day
    ) {
      return { isHoliday: true, nameAr: h.nameAr, nameEn: h.nameEn };
    }
  }

  return { isHoliday: false };
}

/**
 * Converts any date to Africa/Cairo timezone ensuring DST shifts are mitigated.
 * Useful for ensuring server-side cron jobs run at the correct local hour.
 */
export function toCairoTime(date: Date | string | number): Date {
  return toZonedTime(new Date(date), "Africa/Cairo");
}

/**
 * Parses a Postgres TIME column (e.g. "09:30:00") into a timezone-aware Date object
 * relative to a specific scheduled date in Cairo time.
 * Prevents scheduling drift due to DST transitions.
 */
export function parseCairoTime(timeStr: string, baseDate: Date = new Date()): Date {
  const cairoDate = toCairoTime(baseDate);
  const [hours, minutes, seconds = "0"] = timeStr.split(":");
  
  // Set the hours and minutes in the local Cairo timezone
  cairoDate.setHours(parseInt(hours, 10));
  cairoDate.setMinutes(parseInt(minutes, 10));
  cairoDate.setSeconds(parseInt(seconds, 10));
  cairoDate.setMilliseconds(0);
  
  return cairoDate;
}

/**
 * Normalizes Arabic text for consistent indexing and searching.
 * Handles common orthographic variations:
 * - Alef with Hamza/Madda -> Plain Alef (أ إ آ -> ا)
 * - Teh Marbuta -> Heh (ة -> ه)
 * - Yeh/Alef Layena -> (ي -> ى)
 * - Removes common Harakat (vocalization marks)
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  
  return text
    .trim()
    // Remove Harakat
    .replace(/[\u064B-\u0652]/g, "")
    // Normalize Alef
    .replace(/[أإآ]/g, "ا")
    // Normalize Teh Marbuta
    .replace(/ة/g, "ه")
    // Normalize Yeh
    .replace(/ي/g, "ى");
}

/**
 * Normalizes Eastern Arabic (٠-٩) and Persian (۰-۹) numerals to standard Western digits (0-9).
 * Use this for IDs, phone numbers, and other non-decimal numeric strings.
 * Implementation: Uses an O(1) dictionary map to prevent character corruption (e.g. Persian 7, 8, 9).
 */
export function latinizeNumerals(str: string): string {
  if (!str) return "";
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };
  return str.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}


/**
 * Normalizes localized decimal inputs (handles Arabic commas and Eastern numerals)
 * and returns a standard numeric value or null.
 */
/**
 * NOTE: Strictly for clinical inputs (vitals, weights). Do not use for financial 
 * calculations or invoices as it will corrupt thousands-separator commas (e.g. 1,250.50).
 * 
 * Normalizes Eastern Arabic (٠-٩) and Persian (۰-۹) numerals to standard Western digits (0-9)
 * and converts Arabic/localized decimal separators (٫, ،) to standard dots (.).
 */
export const normalizeDecimal = (str: string | number | null | undefined): number | null => {
  if (str === null || str === undefined || String(str).trim() === "") return null;

  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };

  const normalized = String(str)
    .replace(/[،,٫]/g, ".") // Convert Arabic, standard, and Eastern decimal separators to dots
    .replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  const num = Number(normalized);
  return isNaN(num) ? null : num;
};


/**
 * Normalizes a search term by converting it to lowercase, normalizing Arabic characters, 
 * and translating all numeral systems (Eastern, Persian) to Western digits for robust matching.
 */
export const normalizeSearchTerm = (str: string): string => {
  if (!str) return "";
  const lower = str.toLowerCase();
  // 1. Normalize Arabic characters (Alef, Yeh, Te Marbuta)
  const normArabic = normalizeArabic(lower);
  // 2. Normalize all Eastern and Persian numerals to Western digits
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };
  return normArabic.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};

