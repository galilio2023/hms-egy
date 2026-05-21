/**
 * HMS Egypt - Subscription Plans Utility Functions
 */

import { PLAN_CONFIGS, type PlanTier, type PlanModule } from "@/types/plans.types";

/**
 * Checks if a given plan tier has access to a specific optional module.
 */
export function hasPlanModuleAccess(tier: PlanTier, module: PlanModule): boolean {
  const config = PLAN_CONFIGS[tier];
  if (!config) return false;
  
  // Enterprise plan has access to everything
  if (tier === "enterprise") return true;

  return config.allowedModules.includes(module);
}

/**
 * Validates if the current tenant settings match the allowed modules for their active plan tier.
 * Returns a list of modules that are turned on but not allowed by the plan.
 */
export function validateHospitalModules(
  tier: PlanTier,
  settings: {
    isSurgicalEnabled: boolean;
    isTelemedicineEnabled: boolean;
    isPatientPortalEnabled: boolean;
    isOnlinePaymentsEnabled: boolean;
  }
): PlanModule[] {
  const violations: PlanModule[] = [];

  if (settings.isSurgicalEnabled && !hasPlanModuleAccess(tier, "surgical")) {
    violations.push("surgical");
  }
  if (settings.isTelemedicineEnabled && !hasPlanModuleAccess(tier, "telemedicine")) {
    violations.push("telemedicine");
  }
  if (settings.isPatientPortalEnabled && !hasPlanModuleAccess(tier, "portal")) {
    violations.push("portal");
  }
  if (settings.isOnlinePaymentsEnabled && !hasPlanModuleAccess(tier, "payments")) {
    violations.push("payments");
  }

  return violations;
}

/**
 * Checks if a resource creation exceeds the plan quotas.
 * E.g., validating if the hospital can create more operating rooms under its current tier.
 */
export function isQuotaExceeded(
  tier: PlanTier,
  metric: "beds" | "operatingRooms" | "staff" | "users",
  currentCount: number
): boolean {
  const config = PLAN_CONFIGS[tier];
  if (!config) return true;

  const quota = config.quotas;
  switch (metric) {
    case "beds":
      return currentCount >= quota.maxBeds;
    case "operatingRooms":
      return currentCount >= quota.maxOperatingRooms;
    case "staff":
      return currentCount >= quota.maxStaff;
    case "users":
      return currentCount >= quota.maxUsers;
    default:
      return true;
  }
}
