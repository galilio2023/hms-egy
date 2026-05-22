/**
 * HMS Egypt - Formatting Utilities
 * Handles currency, dates, numbers, and strings with Arabic support.
 */

import { format, formatDistanceToNow, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from "date-fns";
import { arEG } from "date-fns/locale";

/**
 * Formats amount in Egyptian Pounds (EGP).
 */
export function formatEGP(amount: number, options: { arabic?: boolean; compact?: boolean } = {}): string {
  const formatter = new Intl.NumberFormat(options.arabic ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    notation: options.compact ? "compact" : "standard",
  });
  return formatter.format(amount);
}

/**
 * Converts numbers to Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩).
 * WARNING: strictly for UI rendering/PDF outputs. Never use for system logic,
 * parsing, or database queries.
 */
export function toEasternArabicNumerals(n: number | string): string {
  const easternDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return n.toString().replace(/\d/g, (w) => easternDigits[parseInt(w)]);
}

/**
 * Safely parses a string into an integer.
 * Always uses radix 10 and returns undefined instead of NaN for invalid inputs.
 */
export function safeParseInt(val: string | number | undefined | null): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : Math.floor(val);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Formats date in Arabic.
 */
export function formatArabicDate(
  date: Date,
  variant: "short" | "long" | "relative" | "datetime" = "short"
): string {
  if (variant === "relative") {
    return formatDistanceToNow(date, { addSuffix: true, locale: arEG });
  }

  const patterns = {
    short: "yyyy/MM/dd",
    long: "d MMMM yyyy",
    datetime: "yyyy/MM/dd h:mm a",
  };

  return format(date, patterns[variant], { locale: arEG });
}

/**
 * Formats Egyptian phone number.
 */
export function formatEgyptianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
}

/**
 * Masks National ID for privacy.
 */
export function formatNationalId(nid: string): string {
  if (nid.length !== 14) return nid;
  return `${nid.substring(0, 2)}**********${nid.substring(12)}`;
}

/**
 * Formats duration in minutes to a readable string (e.g., "1h 30m").
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Formats age from date of birth.
 * Provides high precision for clinical records (days/weeks/months/years).
 */
export function formatAge(dob: Date, locale: "ar" | "en" = "ar"): string {
  const now = new Date();
  const diffDays = differenceInDays(now, dob);

  if (locale === "ar") {
    if (diffDays < 7) {
      if (diffDays === 1) return "يوم واحد";
      if (diffDays === 2) return "يومان";
      if (diffDays <= 10) return `${diffDays} أيام`;
      return `${diffDays} يوماً`;
    }
    const weeks = differenceInWeeks(now, dob);
    if (diffDays < 30) {
      if (weeks === 1) return "أسبوع واحد";
      if (weeks === 2) return "أسبوعان";
      if (weeks <= 10) return `${weeks} أسابيع`;
      return `${weeks} أسبوعاً`;
    }
    const years = differenceInYears(now, dob);
    if (years === 0) {
      const months = differenceInMonths(now, dob);
      if (months === 1) return "شهر واحد";
      if (months === 2) return "شهران";
      if (months <= 10) return `${months} أشهر`;
      return `${months} شهراً`;
    }
    if (years === 1) return "سنة واحدة";
    if (years === 2) return "سنتان";
    if (years <= 10) return `${years} سنوات`;
    return `${years} سنة`;
  }

  // English fallback
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) return `${differenceInWeeks(now, dob)} weeks`;

  const years = differenceInYears(now, dob);
  if (years === 0) {
    return `${differenceInMonths(now, dob)} months`;
  }
  return `${years} years`;
}

/**
 * Converts amount to Arabic words (Tafgeet).
 * Used for invoices and financial reports to prevent tampering.
 */
export async function amountToArabicWords(amount: number): Promise<string> {
  try {
    // Round to 2 decimal places to prevent floating point issues (e.g. 150.700000002)
    const roundedAmount = Math.round(amount * 100) / 100;
    
    // Lazy load tafgeetjs to keep initial bundle size lean
    const { default: Tafgeet } = await import("tafgeetjs");
    const tafgeet = new Tafgeet(roundedAmount, "EGP");
    return tafgeet.parse();
  } catch (error) {
    console.error("Tafgeet conversion failed", error);
    
    const pounds = Math.floor(amount);
    const piastres = Math.round((amount - pounds) * 100);
    
    let fallback = `فقط ${pounds} جنيه مصري`;
    if (piastres > 0) {
      fallback += ` و ${piastres} قرش`;
    }
    fallback += ` لا غير`;
    
    return fallback;
  }
}
