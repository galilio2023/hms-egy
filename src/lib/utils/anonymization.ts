import { latinizeNumerals } from "@/lib/utils/egypt";

/**
 * Helper to create a regex-safe pattern that matches common Arabic orthographic variations
 * (Alif hamzas, Taa Marbuta/Haa, Yaa/Alef Maksura) without destructive normalization.
 */
function makeArabicVariantPattern(token: string): string {
  return token
    .replace(/[أإآا]/g, "[أإآا]")
    .replace(/[ةه]/g, "[ةه]")
    .replace(/[يى]/g, "[يى]");
}

// 1. Arabic Prefix Dictionaries (Move to module scope for performance)
const NAME_PREFIXES_AR = ["المريض", "المريضه", "استاذ", "استاذه", "دكتور", "دكتوره", "يا", "مدام", "انسه", "حاج", "حاجه", "عم", "بشمهندس", "باشمهندس", "باشا", "بيه"];
const VERB_PREFIXES_AR = [
  "قال", "قالت", "دخل", "دخلت", "جاء", "زار", "زارت", "اسم",
  "كشف", "كشفت", "حضر", "حضرت", "خرج", "خرجت", "كلم", "كلمت",
  "سال", "سالت", "طلب", "طلبت", "بلغ", "بلغت", "اشتكى", "اشتكت",
  "اتصل", "اتصلت", "حول", "حولت", "رفض", "رفضت"
];

const ALL_PREFIXES_AR = [...NAME_PREFIXES_AR, ...VERB_PREFIXES_AR].sort((a, b) => b.length - a.length);
const VARIANT_PREFIXES_PATTERN_AR = ALL_PREFIXES_AR.map(makeArabicVariantPattern).join("|");

// 2. Arabic Stop-Tokens (to prevent over-anonymization of clinical verbs/states)
// Note: "على" is excluded because it collides with the common name "علي" (Ali) in many scripts.
const STOP_TOKENS_AR = [
  "اتحجز", "اتحول", "اتكتب", "اخد", "خد", "مات", "توفى", "تحسن", "ساءت",
  "ضغط", "نبض", "حراره", "سكر", "عشان", "بس", "لما",
  "انه", "انها", "تم", "يتم", "كان", "كانت", "في", "من", "الى", "مع", "بنا", "بواسطه"
].filter(t => t !== "على").sort((a, b) => b.length - a.length);

const VARIANT_STOP_TOKENS_PATTERN_AR = STOP_TOKENS_AR.map(makeArabicVariantPattern).join("|");

const PROCLITICS_AR = "(?:[وفب]ال?|[وفب]|ال)";
const STOP_PATTERN_AR = `(?:${PROCLITICS_AR}?(?:${VARIANT_PREFIXES_PATTERN_AR}|${VARIANT_STOP_TOKENS_PATTERN_AR}))`;

// Compound Name Logic: Match 1-4 tokens, ensuring tokens aren't clinical stop-tokens.
const NAME_TOKEN_AR = `(?!(?:${STOP_PATTERN_AR})(?:$|[\\s\\p{P}]))\\p{Script=Arabic}{2,}`;
const COMPOUND_NAME_AR = `(?:${NAME_TOKEN_AR}(?:\\s+${NAME_TOKEN_AR}){0,3})`;

// Fixed: Corrected capture group indices and ensured non-greedy multi-word matching
const COMBINED_PATTERN_AR = new RegExp(
  `((?:^|[\\s\\p{P}])(?:${PROCLITICS_AR}?(?:${VARIANT_PREFIXES_PATTERN_AR}))(?=$|[\\s\\p{P}])\\s+)(${COMPOUND_NAME_AR})`,
  "gu"
);

// 3. English Anonymization Dictionaries
const NAME_PREFIXES_EN = ["Patient", "Mr.", "Mrs.", "Ms.", "Dr.", "A/O", "Madam", "Miss"];
const STOP_WORDS_EN = ["Hospital", "Clinic", "Ward", "Department", "Unit", "Center", "Medical", "General", "State", "University", "Went", "Was", "Here"];

const ESCAPED_PREFIXES_EN = NAME_PREFIXES_EN.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const STOP_PATTERN_EN = `(?:${STOP_WORDS_EN.join("|")})`;

// Capture 1-4 words, ensuring they aren't clinical stop-words. Case-insensitive support.
// Fixed: Using \s instead of whitespace class and improved token boundary check.
const NAME_TOKEN_EN = `(?!(?:${STOP_PATTERN_EN})\\b)[a-zA-Z]{2,}`;
const COMPOUND_NAME_EN = `(?:${NAME_TOKEN_EN}(?:(?:[-']|\\s)${NAME_TOKEN_EN}){0,3})`;

const PREFIX_PATTERN_EN = new RegExp(
  `((?:^|[\\s\\p{P}])(?:${ESCAPED_PREFIXES_EN.join("|")})\\s+)(${COMPOUND_NAME_EN})(?=$|[\\s\\p{P}])`,
  "gui"
);

// 4. Explicit Mention Pattern
// Fixed: Explicit mention for Arabic now uses variant pattern for the trigger words.
const MENTION_PREFIXES_AR = ["اسم المريض", "اسمه", "اسمها"].map(makeArabicVariantPattern).join("|");
const MENTION_PATTERN = new RegExp(
  `((?:^|[\\s\\p{P}])(?:Patient\\s+name\\s+is|His\\s+name\\s+is|Her\\s+name\\s+is|${MENTION_PREFIXES_AR})\\s+)(${COMPOUND_NAME_AR}|${COMPOUND_NAME_EN})(?=$|[\\s\\p{P}])`,
  "gui"
);

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

  // 1. Scrub 14-digit Egyptian National ID patterns (Precise match for 2nd/3rd/4th century births)
  // Pre-convert Eastern Arabic digits to Latin digits for these specific numeric scrubbers.
  let sanitized = latinizeNumerals(text);
  sanitized = sanitized.replace(/\b[234]\d{13}\b/g, "[NATIONAL_ID]");

  // 2. Scrub phone numbers (international, Egyptian mobile blocks, 10-11 digits)
  // Target: +20..., 010..., 011..., 012..., 015..., 00201...
  sanitized = sanitized.replace(/\b(?:\+?20|0)?1[0125]\d{8}\b/g, "[PHONE_NUMBER]");
  sanitized = sanitized.replace(/\b00201[0125]\d{8}\b/g, "[PHONE_NUMBER]");

  // 3. Scrub common name prefixes and multi-word names (Arabic & English)
  sanitized = sanitized.replace(COMBINED_PATTERN_AR, (match, p1) => `${p1}[PATIENT_NAME]`);
  sanitized = sanitized.replace(PREFIX_PATTERN_EN, (match, p1) => `${p1}[PATIENT_NAME]`);

  // 4. Scrub explicit name mentions like "Patient name is [X]" or "اسمه [X]"
  sanitized = sanitized.replace(MENTION_PATTERN, (match, p1) => `${p1}[PATIENT_NAME]`);

  return sanitized;
}
