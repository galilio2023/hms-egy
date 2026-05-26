"use server";

import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { hospitalSettingsSchema, type HospitalSettingsType } from "@/lib/validations/hospital.schema";
import { revalidatePath } from "next/cache";
import { authInstance } from "@/lib/auth";
import { encryptField } from "@/lib/utils/security";
import { validateHospitalModules } from "@/lib/utils/plans";
import { type PlanTier } from "@/types/plans.types";

export async function updateHospitalSettings(
  hospitalId: string,
  slug: string,
  data: HospitalSettingsType
) {
  // Authorization check
  const session = await authInstance.api.getSession();
  if (!session) {
    return {
      success: false,
      error: "Unauthorized: Please log in.",
    };
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isAdmin = session.user.role === "ADMIN";
  const matchesHospital = session.user.hospitalId === hospitalId;

  if (!isSuperAdmin && (!isAdmin || !matchesHospital)) {
    return {
      success: false,
      error: "Forbidden: You do not have permission to modify settings for this hospital.",
    };
  }

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
      buildingNumber,
      street,
      district,
      city,
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
      etaClientId,
      etaClientSecret,
      etaTaxpayerActivityCode,
    } = validated.data;

    // Fetch active planTier and existing settings from database
    const dbHospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, hospitalId),
      with: {
        settings: true,
      }
    });

    if (!dbHospital) {
      return {
        success: false,
        error: "Hospital not found",
      };
    }

    const tier = dbHospital.planTier as PlanTier;
    const violations = validateHospitalModules(tier, {
      isSurgicalEnabled: isSurgicalEnabled ?? false,
      isTelemedicineEnabled: isTelemedicineEnabled ?? false,
      isPatientPortalEnabled: isPatientPortalEnabled ?? false,
      isOnlinePaymentsEnabled: isOnlinePaymentsEnabled ?? false,
    });

    if (violations.length > 0) {
      return {
        success: false,
        error: `Forbidden: Current subscription plan (${tier}) does not support the following premium modules: ${violations.join(", ")}`,
      };
    }

    // Encryption & Masking Logic for sensitive secrets (Code Review #1.2)
    const handleSecret = (newVal: string | null | undefined, existingVal: string | null) => {
      if (newVal === "••••••••") return existingVal; // Keep existing
      if (!newVal) return null; // Clear field
      return encryptField(newVal); // Encrypt new value
    };

    const finalPaymobApiKey = handleSecret(paymobApiKey, dbHospital.settings?.paymobApiKey);
    const finalPaymobHmacSecret = handleSecret(paymobHmacSecret, dbHospital.settings?.paymobHmacSecret);
    const finalEtaClientSecret = handleSecret(etaClientSecret, dbHospital.settings?.etaClientSecret);

    // 2. Execute transactional atomic update
    await db.transaction(async (tx) => {
      // Update basic hospital details (including structured address)
      await tx
        .update(hospitals)
        .set({
          nameAr,
          nameEn,
          contactPhone,
          address,
          buildingNumber: buildingNumber || null,
          street: street || null,
          district: district || null,
          city: city || null,
          governorate,
          updatedAt: new Date(),
        })
        .where(eq(hospitals.id, hospitalId));

      if (!dbHospital.settings) {
        // Insert new settings row if it does not exist
        await tx.insert(hospitalSettings).values({
          hospitalId,
          isSurgicalEnabled,
          isTelemedicineEnabled,
          isPatientPortalEnabled,
          isOnlinePaymentsEnabled,
          paymobApiKey: finalPaymobApiKey,
          paymobCardId: paymobCardId || null,
          paymobWalletId: paymobWalletId || null,
          paymobFawryId: paymobFawryId || null,
          paymobHmacSecret: finalPaymobHmacSecret,
          orCleaningDuration,
          autoHousekeeping,
          etaClientId: etaClientId || null,
          etaClientSecret: finalEtaClientSecret,
          etaTaxpayerActivityCode: etaTaxpayerActivityCode || "8610",
          updatedAt: new Date(),
        });
      } else {
        // Update existing settings row
        await tx
          .update(hospitalSettings)
          .set({
            isSurgicalEnabled,
            isTelemedicineEnabled,
            isPatientPortalEnabled,
            isOnlinePaymentsEnabled,
            paymobApiKey: finalPaymobApiKey,
            paymobCardId: paymobCardId || null,
            paymobWalletId: paymobWalletId || null,
            paymobFawryId: paymobFawryId || null,
            paymobHmacSecret: finalPaymobHmacSecret,
            orCleaningDuration,
            autoHousekeeping,
            etaClientId: etaClientId || null,
            etaClientSecret: finalEtaClientSecret,
            etaTaxpayerActivityCode: etaTaxpayerActivityCode || "8610",
            updatedAt: new Date(),
          })
          .where(eq(hospitalSettings.hospitalId, hospitalId));
      }
    });

    revalidatePath(`/[locale]/${slug}/settings`, "page");
    return { success: true };
  } catch (error) {
    console.error(`[SETTINGS_ACTION] Failed to update settings for hospital ${hospitalId}:`, error);
    return { success: false, error: "An unexpected database error occurred while saving settings." };
  }
}
