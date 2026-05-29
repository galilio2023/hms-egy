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

  // 3. Normalize Arabic orthographic variations for robust matching (Alif, Taa Marbuta, Yaa/Alef Maksura)
  // This complies with Law No. 151 and handles rapid clinical data entry variations.
  sanitized = sanitized
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ي/g, "ى");

  // 4. Scrub common name prefixes/names in Egyptian contexts (Arabic & English)
  // These dictionaries are pre-normalized to match the transformed text above.
  const namePrefixesAr = [
    "المريض", "المريضه", "استاذ", "استاذه", "دكتور", "دكتوره", "يا", "مدام", "انسه",
    "حاج", "حاجه", "عم", "بشمهندس", "باشمهندس", "باشا", "بيه"
  ].map(p => p.replace(/ي/g, "ى"));
  const namePrefixesEn = ["Patient", "Mr.", "Mrs.", "Ms.", "Dr.", "A/O", "Madam", "Miss"];

  const verbPrefixesAr = [
    "قال", "قالت", "دخل", "دخلت", "جاء", "زار", "زارت", "اسم",
    "كشف", "كشفت", "حضر", "حضرت", "خرج", "خرجت", "كلم", "كلمت",
    "سال", "سالت", "طلب", "طلبت", "بلغ", "بلغت", "اشتكى", "اشتكت",
    "اتصل", "اتصلت", "حول", "حولت", "رفض", "رفضت"
  ].map(p => p.replace(/ي/g, "ى"));

  // Logic: Proclitics (و/ف/ب) and the definite article (ال) can be attached to Arabic verbs and honorifics.
  const procliticsAr = "(?:[وفب]ال?|[وفب]|ال)";
  // Prefix sorting (descending length) is critical for greedy matching (e.g., "المريضه" before "المريض")
  const allPrefixesAr = [...namePrefixesAr, ...verbPrefixesAr].sort((a, b) => b.length - a.length);
  const allPrefixesPatternAr = allPrefixesAr.join("|");

  // Negative Lookahead Boundaries: Preserves clinical timeline integrity.
  // Note: "على" is removed to prevent leaking the common name "علي" (Ali) after normalization.
  const stopTokensAr = [
    "اتحجز", "اتحول", "اتكتب", "اخد", "خد", "مات", "توفى", "تحسن", "ساءت",
    "ضغط", "نبض", "حراره", "سكر", "عشان", "بس", "لما",
    "انه", "انها", "تم", "يتم", "كان", "كانت", "في", "من", "الى", "مع", "بنا", "بواسطه"
  ].map(p => p.replace(/ي/g, "ى")).sort((a, b) => b.length - a.length);
  const stopPatternAr = `(?:${procliticsAr}?(?:${[...allPrefixesAr, ...stopTokensAr].join("|")}))`;

  // Compound Name Logic: Match 1-4 Arabic tokens, but each token must not be a clinical stop-token.
  // This handles theophoric (عبد الرحمن) and other multi-word Egyptian names.
  const nameTokenAr = `(?!(?:${stopPatternAr})(?:$|[\\s\\p{P}]))\\p{Script=Arabic}{2,}`;
  const compoundNameAr = `(?:${nameTokenAr}(?:\\s+${nameTokenAr}){0,3})`;

  const combinedPatternAr = new RegExp(
    `((?:^|[\\s\\p{P}])(?:${procliticsAr}?(?:${allPrefixesPatternAr}))\\s+)(${compoundNameAr})`,
    "gu"
  );

  // English prefix regex: Capture hyphenated or space-separated compound names (e.g. Jean-Luc or Sarah Jane)
  const escapedPrefixesEn = namePrefixesEn.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const compoundNameEn = `[A-Z][a-zA-Z]*(?:[-'\\s][A-Z][a-zA-Z]*){0,3}`;
  const prefixPatternEn = new RegExp(`((?:^|[\\s\\p{P}])(?:${escapedPrefixesEn.join("|")})\\s+)(${compoundNameEn})`, "gu");

  sanitized = sanitized.replace(combinedPatternAr, (match, p1) => {
    return `${p1}[PATIENT_NAME]`;
  });

  sanitized = sanitized.replace(prefixPatternEn, (match, p1) => {
    return `${p1}[PATIENT_NAME]`;
  });

  // 5. Scrub explicit name mentions like "Patient name is [X]" or "اسمه [X]"
  // Logic: Upgraded to support multi-word compound names in both scripts.
  const mentionPattern = new RegExp(
    `((?:^|[\\s\\p{P}])(?:Patient\\s+name\\s+is|His\\s+name\\s+is|Her\\s+name\\s+is|اسم\\s+المريض|اسمه|اسمها)\\s+)(${compoundNameAr}|${compoundNameEn})`,
    "gui"
  );

  sanitized = sanitized.replace(mentionPattern, (match, p1) => {
    return `${p1}[PATIENT_NAME]`;
  });

  return sanitized;
}
