import { z } from "zod";
import { validateNationalId, EGYPTIAN_INSURANCE_PROVIDERS, parseNationalId, getGovernorateCode } from "../utils/egypt";
import { toZonedTime } from "date-fns-tz";

const egyptianPhoneSchema = z
  .string()
  .transform((val) => val.replace(/\s+/g, "")) // sanitize whitespace
  .refine((val) => /^(?:\+20|0020)?0?1[0125]\d{8}$/.test(val), {
    message: "Invalid Egyptian mobile number",
  });

export const patientSchema = z.object({
  nationalId: z.string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val || val === "") return true;
      return /^[23]\d{13}$/.test(val);
    }, {
      message: "Invalid Egyptian National ID: Must be 14 digits starting with 2 or 3.",
    }),
  passportNumber: z.string().optional().or(z.literal("")),
  nameAr: z.string().min(3, "Name in Arabic must be at least 3 characters"),
  nameEn: z.string().min(3, "Name in English must be at least 3 characters"),
  dob: z.coerce.date(),
  gender: z.enum(["male", "female"]),
  governorate: z.string().refine((val) => getGovernorateCode(val) !== null, {
    message: "Invalid Egyptian governorate",
  }),
  phone: egyptianPhoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5, "Address must be at least 5 characters"),
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  insuranceProviderId: z.string().optional(),
  insuranceNumber: z.string().optional(),
  guardianName: z.string().optional(),
  guardianNid: z.string().optional().refine((val) => {
    if (!val || val === "") return true;
    // If it looks like an Egyptian National ID (14 digits), validate strictly
    if (/^\d{14}$/.test(val)) {
      return validateNationalId(val);
    }
    // Otherwise, treat as a foreign passport (basic alphanumeric format check)
    return /^[A-Z0-9]{6,20}$/i.test(val);
  }, {
    message: "Invalid Guardian Identity format: Must be a 14-digit National ID or a valid Passport Number.",
  }),
  guardianPhone: egyptianPhoneSchema.optional().or(z.literal("")),
}).refine((data) => {
  if (data.insuranceProviderId === "uhis") {
    const govCode = getGovernorateCode(data.governorate);
    const provider = EGYPTIAN_INSURANCE_PROVIDERS.find(p => p.id === "uhis");
    const isEligibleGov = !!(govCode && provider?.rolloutGovernorates?.includes(govCode));
    if (!isEligibleGov) return false;

    // UHIS IDs must be exactly 12 numeric digits
    if (data.insuranceNumber && !/^\d{12}$/.test(data.insuranceNumber)) {
      return false;
    }
  }
  return true;
}, {
  message: "UHIS is not yet available in your governorate or the provided UHIS ID is invalid (must be 12 digits).",
  path: ["insuranceProviderId"]
}).superRefine((data, ctx) => {
  const hasNid = !!(data.nationalId && data.nationalId.trim() !== "");
  const hasPassport = !!(data.passportNumber && data.passportNumber.trim() !== "");

  if (!hasNid && !hasPassport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either National ID or Passport Number is required for patient registration.",
      path: ["nationalId"],
    });
    return;
  }

  if (hasNid) {
    const isValidNid = validateNationalId(data.nationalId!);
    if (!isValidNid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Egyptian National ID format or check digits.",
        path: ["nationalId"],
      });
      return;
    }

    const parsed = parseNationalId(data.nationalId!);
    if (parsed) {
      // Validate Gender Match
      if (parsed.gender !== data.gender) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gender does not match National ID",
          path: ["gender"],
        });
      }
      // Validate Date of Birth Match (strictly timezone-neutral comparison in Africa/Cairo)
      const formatToISODate = (date: Date) => {
        const zoned = toZonedTime(date, "Africa/Cairo");
        const year = zoned.getFullYear();
        const month = String(zoned.getMonth() + 1).padStart(2, "0");
        const day = String(zoned.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const parsedIso = formatToISODate(parsed.dob);
      const inputIso = formatToISODate(data.dob);

      if (parsedIso !== inputIso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Date of birth does not match National ID",
          path: ["dob"],
        });
      }
    }
  }
});

export type PatientSchema = z.infer<typeof patientSchema>;
