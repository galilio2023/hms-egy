/**
 * HMS Egypt - Subscription Plan & Tier Definitions
 */

export type PlanTier = "starter" | "professional" | "enterprise";

export type PlanModule = "surgical" | "telemedicine" | "portal" | "payments";

export interface PlanQuota {
  maxBeds: number;
  maxOperatingRooms: number;
  maxStaff: number;
  maxUsers: number;
}

export interface PlanConfig {
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  allowedModules: PlanModule[];
  quotas: PlanQuota;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: "starter",
    nameEn: "Starter Plan",
    nameAr: "الباقة الأساسية",
    allowedModules: ["portal"], // Restricted, only patient portal available by default
    quotas: {
      maxBeds: 20,
      maxOperatingRooms: 0, // No operating rooms allowed
      maxStaff: 15,
      maxUsers: 25,
    },
  },
  professional: {
    tier: "professional",
    nameEn: "Professional Plan",
    nameAr: "الباقة الاحترافية",
    allowedModules: ["portal", "telemedicine", "payments"], // Includes payments and telemedicine
    quotas: {
      maxBeds: 100,
      maxOperatingRooms: 2,
      maxStaff: 75,
      maxUsers: 150,
    },
  },
  enterprise: {
    tier: "enterprise",
    nameEn: "Enterprise Plan",
    nameAr: "باقة المؤسسات الكبرى",
    allowedModules: ["portal", "telemedicine", "payments", "surgical"], // Full access including surgical modules
    quotas: {
      maxBeds: 9999, // Unlimited for practical purposes
      maxOperatingRooms: 20,
      maxStaff: 9999,
      maxUsers: 9999,
    },
  },
};

export const PLAN_PRICING: Record<PlanTier, number> = {
  starter: 2500,
  professional: 7500,
  enterprise: 25000,
};
