"use server";

import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { hospitalSettingsSchema, type HospitalSettingsType } from "@/lib/validations/hospital.schema";
import { revalidatePath } from "next/cache";

export async function updateHospitalSettings(
  hospitalId: string,
  slug: string,
  data: HospitalSettingsType
) {
  // 1. Validate data
  const validated = hospitalSettingsSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: "Invalid data submitted",
      details: validated.error.format(),
    };
  }

  try {
    const {
      nameAr,
      nameEn,
      contactPhone,
      address,
      governorate,
      isSurgicalEnabled,
      isTelemedicineEnabled,
      isPatientPortalEnabled,
      isOnlinePaymentsEnabled,
      paymobApiKey,
      paymobCardId,
      paymobWalletId,
      paymobFawryId,
      paymobHmacSecret,
      orCleaningDuration,
      autoHousekeeping,
    } = validated.data;

    // 2. Execute transactional atomic update
    await db.transaction(async (tx) => {
      // Update basic hospital details
      await tx
        .update(hospitals)
        .set({
          nameAr,
          nameEn,
          contactPhone,
          address,
          governorate,
          updatedAt: new Date(),
        })
        .where(eq(hospitals.id, hospitalId));

      // Update associated settings (Paymob, modules, OR cleaning duration, auto housekeeping)
      await tx
        .update(hospitalSettings)
        .set({
          isSurgicalEnabled,
          isTelemedicineEnabled,
          isPatientPortalEnabled,
          isOnlinePaymentsEnabled,
          paymobApiKey: paymobApiKey || null,
          paymobCardId: paymobCardId || null,
          paymobWalletId: paymobWalletId || null,
          paymobFawryId: paymobFawryId || null,
          paymobHmacSecret: paymobHmacSecret || null,
          orCleaningDuration,
          autoHousekeeping,
          updatedAt: new Date(),
        })
        .where(eq(hospitalSettings.hospitalId, hospitalId));
    });

    revalidatePath(`/[locale]/${slug}/settings`, "page");
    return { success: true };
  } catch (error) {
    console.error(`[SETTINGS_ACTION] Failed to update settings for hospital ${hospitalId}:`, error);
    return { success: false, error: "An unexpected database error occurred while saving settings." };
  }
}
