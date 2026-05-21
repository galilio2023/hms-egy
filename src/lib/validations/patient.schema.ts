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
  nationalId: z.string().optional().or(z.literal("")),
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
  bloodType: z.string().optional(),
  insuranceProviderId: z.string().optional(),
  insuranceNumber: z.string().optional(),
  guardianName: z.string().optional(),
  guardianNid: z.string().optional(),
  guardianPhone: egyptianPhoneSchema.optional().or(z.literal("")),
}).refine((data) => {
  if (data.insuranceProviderId === "uhis") {
    const govCode = getGovernorateCode(data.governorate);
    const provider = EGYPTIAN_INSURANCE_PROVIDERS.find(p => p.id === "uhis");
    return !!(govCode && provider?.rolloutGovernorates?.includes(govCode));
  }
  return true;
}, {
  message: "UHIS is not yet rolled out in the patient's current residence/registration governorate.",
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
