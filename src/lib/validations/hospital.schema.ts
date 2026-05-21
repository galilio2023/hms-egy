import { z } from "zod";

const EGYPT_PHONE_REGEX = /^(?:\+20|0020)?(?:0?1[0125]\d{8}|0?[2-9]\d{7,8}|0?1[5-9]\d{3})$/;

export const hospitalOnboardingSchema = z.object({
  nameAr: z.string().min(3, "Hospital name in Arabic is required"),
  nameEn: z.string().min(3, "Hospital name in English is required"),
  slug: z.string().min(3).max(100, "Slug cannot exceed 100 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email(),
  contactPhone: z.string().refine((val) => EGYPT_PHONE_REGEX.test(val.replace(/\s+/g, "")), {
    message: "Invalid Egyptian phone number (mobile, landline, or hotline)",
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

const nullableCoercedString = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? null : String(val)),
  z.string().nullable().optional()
);

export const hospitalSettingsSchema = z.object({
  // Hospital basic details
  nameAr: z.string().min(3, "Arabic name is required"),
  nameEn: z.string().min(3, "English name is required"),
  contactPhone: z.string().refine((val) => EGYPT_PHONE_REGEX.test(val.replace(/\s+/g, "")), {
    message: "Invalid Egyptian phone number (mobile, landline, or hotline)",
  }),
  address: z.string().min(10, "Address must be at least 10 characters"),
  governorate: z.string().min(2, "Governorate is required"),

  // Module configuration
  isSurgicalEnabled: z.boolean().default(false),
  isTelemedicineEnabled: z.boolean().default(false),
  isPatientPortalEnabled: z.boolean().default(false),
  isOnlinePaymentsEnabled: z.boolean().default(false),

  // Paymob configurations (optional)
  paymobApiKey: nullableCoercedString,
  paymobCardId: nullableCoercedString,
  paymobWalletId: nullableCoercedString,
  paymobFawryId: nullableCoercedString,
  paymobHmacSecret: nullableCoercedString,

  // Surgical & Housekeeping
  orCleaningDuration: z.number().int().min(5).max(180),
  autoHousekeeping: z.boolean().default(true),
});

export type HospitalSettingsType = z.infer<typeof hospitalSettingsSchema>;

