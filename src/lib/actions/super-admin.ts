"use server";

import { db } from "@/lib/db";
import { hospitals } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { type PlanTier } from "@/types/plans.types";

/**
 * Toggles a hospital's active/inactive status.
 */
export async function toggleHospitalActive(hospitalId: string, isActive: boolean) {
  try {
    await db
      .update(hospitals)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, hospitalId));

    revalidatePath("/[locale]/super-admin", "page");
    return { success: true };
  } catch (error) {
    console.error(`[SUPER_ADMIN_ACTION] Failed to toggle hospital status for ${hospitalId}:`, error);
    return { success: false, error: "Failed to update hospital status" };
  }
}

/**
 * Updates a hospital's subscription tier.
 */
export async function updateHospitalTier(hospitalId: string, planTier: PlanTier) {
  try {
    await db
      .update(hospitals)
      .set({
        planTier,
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, hospitalId));

    revalidatePath("/[locale]/super-admin", "page");
    return { success: true };
  } catch (error) {
    console.error(`[SUPER_ADMIN_ACTION] Failed to update plan tier for ${hospitalId}:`, error);
    return { success: false, error: "Failed to update plan tier" };
  }
}
