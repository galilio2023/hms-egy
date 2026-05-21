import { z } from "zod";
import { validateNationalId, EGYPTIAN_INSURANCE_PROVIDERS, parseNationalId } from "../utils/egypt";

const egyptianPhoneSchema = z
  .string()
  .transform((val) => val.replace(/\s+/g, "")) // sanitize whitespace
  .refine((val) => /^(?:\+20|0020)?0?1[0125]\d{8}$/.test(val), {
    message: "Invalid Egyptian mobile number",
  });

export const patientSchema = z.object({
  nationalId: z.string().refine(validateNationalId, {
    message: "Invalid Egyptian National ID",
  }),
  nameAr: z.string().min(3, "Name in Arabic must be at least 3 characters"),
  nameEn: z.string().min(3, "Name in English must be at least 3 characters"),
  dob: z.coerce.date(),
  gender: z.enum(["male", "female"]),
  governorate: z.string().min(2, "Governorate is required"),
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
    const provider = EGYPTIAN_INSURANCE_PROVIDERS.find(p => p.id === "uhis");
    return provider?.rolloutGovernorates?.includes(data.governorate);
  }
  return true;
}, {
  message: "UHIS is not yet rolled out in the selected governorate.",
  path: ["insuranceProviderId"]
}).superRefine((data, ctx) => {
  const parsed = parseNationalId(data.nationalId);
  if (parsed) {
    // Validate Gender Match
    if (parsed.gender !== data.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gender does not match National ID",
        path: ["gender"],
      });
    }
    // Validate Date of Birth Match (strictly timezone-resilient comparison)
    const formatToISODate = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
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
});

export type PatientSchema = z.infer<typeof patientSchema>;
