import { latinizeNumerals } from "@/lib/utils/egypt";

/**
 * Removes Arabic vocalization marks (Tashkeel) to ensure consistent dictionary matching.
 * Comprehensive range includes standard harakat, shadda, sukun, and dagger alif.
 */
function stripTashkeel(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670]/g, "");
}

/**
 * Helper to create a regex-safe pattern that matches common Arabic orthographic variations
 * (Alif hamzas, Taa Marbuta/Haa, Yaa/Alef Maksura) without destructive normalization.
 * Uses single-pass mapping to avoid corruption from sequential replacements.
 */
function makeArabicVariantPattern(token: string): string {
  const replacements: Record<string, string> = {
    'أ': '[أإآا]', 'إ': '[أإآا]', 'آ': '[أإآا]', 'ا': '[أإآا]',
    'ة': '[ةه]', 'ه': '[ةه]',
    'ي': '[يى]', 'ى': '[يى]'
  };

  return token
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape first to avoid escaping generated brackets
    .replace(/[أإآاةهييى]/g, (match) => replacements[match] || match);
}

// Numeral Redaction Constants (Support Western, Eastern Arabic, and Persian digits)
const ANY_DIGIT = "[\\d\\u0660-\\u0669\\u06F0-\\u06F9]";
const DIGIT_0 = "[0\\u0660\\u06F0]";
const DIGIT_1 = "[1\\u0661\\u06F1]";
const DIGIT_2 = "[2\\u0662\\u06F2]";
const DIGIT_1025 = "[0125\\u0660\\u0661\\u0662\\u0665\\u06F0\\u06F1\\u06F2\\u06F5]";

const START_BOUNDARY = "(?:^|[\\s\\p{P}])";
const END_BOUNDARY = "(?=$|[\\s\\p{P}])";

const NID_PATTERN = new RegExp(`(${START_BOUNDARY})[234\\u0662-\\u0664\\u06F2-\\u06F4]${ANY_DIGIT}{13}${END_BOUNDARY}`, "gu");
const PHONE_PATTERN_1 = new RegExp(`(${START_BOUNDARY})(?:\\+?${DIGIT_2}${DIGIT_0}|${DIGIT_0})?${DIGIT_1}${DIGIT_1025}${ANY_DIGIT}{8}${END_BOUNDARY}`, "gu");
const PHONE_PATTERN_2 = new RegExp(`(${START_BOUNDARY})${DIGIT_0}{2}${DIGIT_2}${DIGIT_0}${DIGIT_1}${DIGIT_1025}${ANY_DIGIT}{8}${END_BOUNDARY}`, "gu");

// 1. Arabic Prefix Dictionaries (Move to module scope for performance)
// Note: Definite articles and prepositions (ال/لل) are handled via PROCLITICS_AR.
const NAME_PREFIXES_AR = ["مريض", "مريضه", "استاذ", "استاذه", "دكتور", "دكتوره", "يا", "مدام", "انسه", "حاج", "حاجه", "عم", "بشمهندس", "باشمهندس", "باشا", "بيه"];
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
// This is a known trade-off where clinical prepositions are occasionally anonymized.
// Includes anatomical terms, clinical procedures, and operational nouns to prevent destroying clinical history.
const PRONOUNS_AND_CONJUNCTIONS_AR = [
  "هو", "هي", "هم", "هن", "هما",
  "هذا", "هذه", "ذلك", "تلك", "هؤلاء",
  "عن", "مع", "في", "الي", "الى",
  "لكن", "ان", "أن", "لان", "لأن"
];

const STOP_TOKENS_AR = [
  "اتحجز", "اتحول", "اتكتب", "اخد", "خد", "مات", "توفى", "تحسن", "ساءت",
  "ضغط", "نبض", "حراره", "سكر",
  "عشان", "بس", "لما", "انه", "انها", "تم", "يتم", "كان", "كانت",
  "في", "من", "الى", "مع", "بنا", "بواسطه",
  "الصدر", "البطن", "الظهر", "العين", "الراس", "المخ", "القلب", "الرحم", "الجلد",
  "الاشعه", "الاشعة", "الاشعه", "اشعه", "اشعة", "التحليل", "التحاليل", "العلاج", "الدواء", "الروشته", "الجرعه", "العينه",
  "عملية", "عمليه", "سونار", "رنين", "مقطعية", "مقطعيه", "عيادة", "عياده", "طوارئ", "طواريء",
  "تذكرة", "تذكره", "تحويل", "استقبال", "رعاه", "رعاية", "عناية", "عنايه", "جبس", "مسحة", "مسحه",
  ...PRONOUNS_AND_CONJUNCTIONS_AR
].filter(t => t !== "على").sort((a, b) => b.length - a.length);

const VARIANT_STOP_TOKENS_PATTERN_AR = STOP_TOKENS_AR.map(makeArabicVariantPattern).join("|");

// Clinical Context Tokens for "على" Bypass logic
const CLINICAL_CONTEXT_TOKENS_AR = [
  // Anatomy
  "صدر", "بطن", "ظهر", "راس", "قلب", "قدم", "يد", "عين", "معده",
  // Departments & Facilities
  "استقبال", "رعايه", "طوارئ", "عياده", "معمل", "اشعه", "حسابات",
  // Financial/Administrative
  "حساب", "فاتوره", "مستحق", "مديونيه", "تأمين"
];
const CLINICAL_CONTEXT_PATTERN_AR = CLINICAL_CONTEXT_TOKENS_AR.map(makeArabicVariantPattern).join("|");

// Proclitics: و, ف, ب, ل, وال, فال, بال, ال, لل
const PROCLITICS_AR = "(?:[وفب]?(?:ال|لل)|[وفبل])";
const STOP_PATTERN_AR = `(?:${PROCLITICS_AR}?(?:${VARIANT_PREFIXES_PATTERN_AR}|${VARIANT_STOP_TOKENS_PATTERN_AR}|${CLINICAL_CONTEXT_PATTERN_AR}))`;

// Pre-compiled regex for "Ali" bypass logic performance optimization.
// Note: We prioritize preserving clinical instruction utility over 100% name redaction
// in high-ambiguity prepositional contexts (e.g., Ali vs. "On" for anatomy).
const CLINICAL_BYPASS_RE = new RegExp(`^${PROCLITICS_AR}?(${CLINICAL_CONTEXT_PATTERN_AR})$`, "ui");

// Compound Name Logic: Match 1-5 tokens (Egyptian 5-part names), ensuring tokens aren't clinical stop-tokens.
const NAME_TOKEN_AR = `(?!(?:${STOP_PATTERN_AR})(?:$|[\\s\\p{P}]))\\p{Script=Arabic}{2,}`;
const COMPOUND_NAME_AR = `(?:${NAME_TOKEN_AR}(?:\\s+${NAME_TOKEN_AR}){0,5})`;

// Note: These patterns use global flags but MUST ONLY be used with String.replace()
// to avoid shared state bugs with lastIndex that occur with .test() or .exec().
const COMBINED_PATTERN_AR = new RegExp(
  `((?:^|[\\s\\p{P}])${PROCLITICS_AR}?(?:${VARIANT_PREFIXES_PATTERN_AR})(?=$|[\\s\\p{P}])\\s+)(${COMPOUND_NAME_AR})(?=$|[\\s\\p{P}])`,
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
 * Helper to handle the "على" (Ali/On) bypass logic.
 * If the identified name starts with "على", it checks if the subsequent text
 * contains clinical context tokens that would indicate it's a preposition.
 */
function shouldBypassAliRedaction(nameMatch: string, remainingText: string): boolean {
  const strippedName = stripTashkeel(nameMatch).trim();
  const normalizedName = strippedName.replace(/ى/g, "ي");
  const startsWithAli = normalizedName === "علي" || normalizedName.startsWith("علي ");

  if (!startsWithAli) return false;

  const fullTextAfterName = (nameMatch + " " + remainingText).trim();
  const tokens = fullTextAfterName.split(/[\s\p{P}]+/u).slice(0, 7);

  return tokens.some(token => CLINICAL_BYPASS_RE.test(stripTashkeel(token)));
}

/**
 * Sanitizes sensitive personal patient identifiers (PII) from conversational
 * transcripts or structured clinical data to comply with Egyptian Data Protection
 * Law No. 151 of 2020 cross-border sovereignty.
 *
 * Logic:
 * 1. Recursively traverses objects and arrays.
 * 2. Strips Arabic Tashkeel for consistent dictionary matching.
 * 3. Scrubs explicit 14-digit National IDs and 11-digit phone numbers regardless of numeral system.
 * 4. Redacts common name prefixes and multi-word names while preserving clinical integrity via context-aware bypasses.
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

  let text = stripTashkeel(input);

  // 1. Scrub 14-digit Egyptian National ID patterns (Supports Western, Eastern, and Persian numerals)
  let sanitized = text.replace(NID_PATTERN, (match, p1) => `${p1}[NATIONAL_ID]`);

  // 2. Scrub phone numbers (international, Egyptian mobile blocks, 10-11 digits)
  sanitized = sanitized.replace(PHONE_PATTERN_1, (match, p1) => `${p1}[PHONE_NUMBER]`);
  sanitized = sanitized.replace(PHONE_PATTERN_2, (match, p1) => `${p1}[PHONE_NUMBER]`);

  // 3. Scrub common name prefixes and multi-word names (Arabic & English)
  sanitized = sanitized.replace(COMBINED_PATTERN_AR, (match, p1, p2, offset) => {
    if (typeof p2 !== "string") return match;
    const remainingText = sanitized.substring(offset + match.length);
    if (shouldBypassAliRedaction(p2, remainingText)) return match;
    return `${p1}[PATIENT_NAME]`;
  });

  sanitized = sanitized.replace(PREFIX_PATTERN_EN, (match, p1, p2, p3, offset) => {
    // English prefix pattern might have more groups, but we only care about p1 and p2 if they exist
    if (typeof p1 !== "string") return match;
    return `${p1}[PATIENT_NAME]`;
  });

  // 4. Scrub explicit name mentions like "Patient name is [X]" or "اسمه [X]"
  sanitized = sanitized.replace(MENTION_PATTERN, (match, p1, p2, offset) => {
    if (typeof p2 !== "string") return match;
    const remainingText = sanitized.substring(offset + match.length);
    if (shouldBypassAliRedaction(p2, remainingText)) return match;
    return `${p1}[PATIENT_NAME]`;
  });

  return sanitized;
}
