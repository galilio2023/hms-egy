import { z } from "zod";
import { validateNationalId } from "../utils/egypt";

export const patientSchema = z.object({
  nationalId: z.string().refine(validateNationalId, {
    message: "Invalid Egyptian National ID",
  }),
  nameAr: z.string().min(3, "Name in Arabic must be at least 3 characters"),
  nameEn: z.string().min(3, "Name in English must be at least 3 characters"),
  dob: z.date(),
  gender: z.enum(["male", "female"]),
  governorate: z.string().min(2, "Governorate is required"),
  phone: z
    .string()
    .transform((val) => val.replace(/\s+/g, "")) // sanitize whitespace
    .refine((val) => /^(?:\+20|0020)?1[0125]\d{8}$/.test(val), {
      message: "Invalid Egyptian mobile number",
    }),
  email: z.string().email().optional().or(z.literal("")),
  bloodType: z.string().optional(),
  insuranceProviderId: z.string().optional(),
  insuranceNumber: z.string().optional(),
  guardianName: z.string().optional(),
  guardianNid: z.string().optional(),
  guardianPhone: z.string().optional(),
});

export type PatientSchema = z.infer<typeof patientSchema>;
