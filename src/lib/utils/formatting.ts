/**
 * HMS Egypt - Formatting Utilities
 * Handles currency, dates, numbers, and strings with Arabic support.
 */

import { format, formatDistanceToNow } from "date-fns";
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
 */
export function toEasternArabicNumerals(n: number | string): string {
  const easternDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return n.toString().replace(/\d/g, (w) => easternDigits[parseInt(w)]);
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

  return format(date, patterns[variant === "relative" ? "short" : variant], { locale: arEG });
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
 */
export function formatAge(dob: Date): string {
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  const months = ageDate.getUTCMonths();

  if (years === 0) return `${months} months`;
  return `${years} years`;
}

/**
 * Placeholder for converting amount to Arabic words.
 * In production, a library like 'tafgeet' should be used.
 */
export function amountToArabicWords(amount: number): string {
  return `${amount} جنيه مصري فقط لا غير`; // Simplified placeholder
}
