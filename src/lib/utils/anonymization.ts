import { latinizeNumerals } from "@/lib/utils/egypt";

/**
 * Sanitizes sensitive personal patient identifiers (PII) from conversational
 * transcripts or structured clinical data to comply with Egyptian Data Protection
 * Law No. 151 of 2020 cross-border sovereignty.
 *
 * Logic:
 * 1. Recursively traverses objects and arrays.
 * 2. Pre-converts all Eastern Arabic/Persian digits to Western Latin digits (0-9).
 * 3. Scrubs explicit 14-digit National IDs, 11-digit phone numbers, and common name prefixes.
 */
export function anonymizePatientData(input: any, seen = new WeakSet()): any {
  if (input === null || input === undefined) return input;

  // Handle Objects and Arrays with circular reference protection
  if (typeof input === "object") {
    if (seen.has(input)) return "[CIRCULAR]";

    // Preserve Date objects
    if (input instanceof Date) return input;

    // Preserve other specialized objects that shouldn't be traversed
    if (input instanceof RegExp || (typeof Blob !== "undefined" && input instanceof Blob) || (typeof File !== "undefined" && input instanceof File)) return input;

    seen.add(input);

    if (Array.isArray(input)) {
      return input.map(item => anonymizePatientData(item, seen));
    }

    // Handle Plain Objects
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[key] = anonymizePatientData(value, seen);
    }
    return sanitizedObj;
  }

  // Handle non-string primitives
  if (typeof input !== "string") return input;

  // Detect and handle embedded JSON strings to prevent "naive top-level conversion" corruption
  if ((input.startsWith("{") && input.endsWith("}")) || (input.startsWith("[") && input.endsWith("]"))) {
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(anonymizePatientData(parsed));
    } catch (e) {
      // Not valid JSON, proceed as normal string
    }
  }

  let text = input;

  // Code Review Fix: Pre-convert Eastern Arabic digits to Latin digits
  let sanitized = latinizeNumerals(text);

  // 1. Scrub 14-digit Egyptian National ID patterns (Precise match for 2nd/3rd/4th century births)
  sanitized = sanitized.replace(/\b[234]\d{13}\b/g, "[NATIONAL_ID]");

  // 2. Scrub phone numbers (international, Egyptian mobile blocks, 10-11 digits)
  // Target: +20..., 010..., 011..., 012..., 015..., 00201...
  sanitized = sanitized.replace(/\b(?:\+?20|0)?1[0125]\d{8}\b/g, "[PHONE_NUMBER]");
  sanitized = sanitized.replace(/\b00201[0125]\d{8}\b/g, "[PHONE_NUMBER]");

  // 3. Scrub common name prefixes/names in Egyptian contexts (Arabic & English)
  // Captures "المريض علي", "يا علي", "أستاذ أحمد", "Mr. Ahmed", "Patient Sarah"
  // Code Review Improvement: Expanded prefixes and cross-script support (transliterated names)
  const namePrefixesAr = ["المريض", "أستاذ", "أستاذة", "دكتور", "دكتورة", "يا", "مدام", "أنسة"];
  const namePrefixesEn = ["Patient", "Mr.", "Mrs.", "Ms.", "Dr.", "A/O", "Madam", "Miss"];

  // Code Review Fix: Expand Arabic prefix pattern to capture conversational verbs preceding standalone names
  // Code Review Fix: Allow longer matches for compound multi-word Egyptian names
  const verbPrefixesAr = ["قال", "قالت", "دخل", "دخلت", "جاء", "زار", "زارت", "اسم"];
  const combinedPatternAr = new RegExp(
    `(?:${[...namePrefixesAr, ...verbPrefixesAr].join("|")})\\s+([\\p{Script=Arabic}\\s]{3,25})`,
    "gu"
  );

  // Code Review Fix: Expand English prefix regex to capture hyphenated or space-separated compound names
  const escapedPrefixesEn = namePrefixesEn.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const prefixPatternEn = new RegExp(`(?:${escapedPrefixesEn.join("|")})\\s+[A-Z][a-zA-Z]*(?:[-'\\s][A-Z][a-zA-Z]*)?`, "gu");

  sanitized = sanitized.replace(combinedPatternAr, (match) => {
    const parts = match.split(/\s+/);
    return `${parts[0]} [PATIENT_NAME]`;
  });

  sanitized = sanitized.replace(prefixPatternEn, (match) => {
    const parts = match.split(/\s+/);
    return `${parts[0]} [PATIENT_NAME]`;
  });

  // 4. Scrub explicit name mentions like "Patient name is [X]" or "اسمه [X]"
  // Code Review Fix: Use Unicode property escapes here as well for clinical safety.
  sanitized = sanitized.replace(/(?:Patient\s+name\s+is|His\s+name\s+is|Her\s+name\s+is|اسم\s+المريض|اسمه|اسمها)\s+(\p{Script=Arabic}+|[A-Zأ-ي][a-zأ-ي]*)/gui, (match) => {
    const parts = match.split(/\s+/);
    const lastPart = parts.pop();
    return `${parts.join(" ")} [PATIENT_NAME]`;
  });

  return sanitized;
}
