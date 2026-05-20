import { z } from "zod";

export const hospitalOnboardingSchema = z.object({
  nameAr: z.string().min(3, "Hospital name in Arabic is required"),
  nameEn: z.string().min(3, "Hospital name in English is required"),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email(),
  contactPhone: z.string().refine((val) => /^(?:\+20|0020)?0?1[0125]\d{8}$/.test(val), {
    message: "Invalid Egyptian mobile number",
  }),
  address: z.string().min(10),
  governorate: z.string().min(2),
  type: z.enum(["private", "government", "military", "ngo"]),
  
  // Modules configuration
  modules: z.object({
    surgical: z.boolean().default(false),
    telemedicine: z.boolean().default(false),
    portal: z.boolean().default(false),
    payments: z.boolean().default(false),
  }),

  // Admin Setup
  adminName: z.string().min(3),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export type HospitalOnboarding = z.infer<typeof hospitalOnboardingSchema>;
