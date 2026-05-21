"use server";

import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { hospitalSettingsSchema, type HospitalSettingsType } from "@/lib/validations/hospital.schema";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { encryptField } from "@/lib/utils/security";
import { validateHospitalModules } from "@/lib/utils/plans";
import { type PlanTier } from "@/types/plans.types";

export async function updateHospitalSettings(
  hospitalId: string,
  slug: string,
  data: HospitalSettingsType
) {
  // Authorization check
  const session = await auth();
  if (!session) {
    return {
      success: false,
      error: "Unauthorized: Please log in.",
    };
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isAdmin = session.user.role === "ADMIN";
  const matchesHospital = session.user.hospitalId === hospitalId || session.user.hospitalId === "default-hospital-id";

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

    // Fetch active planTier from database to perform server-side business logic validation
    const [dbHospital] = await db
      .select({ planTier: hospitals.planTier })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

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

      // Check if settings record exists (to prevent silent failures for new tenants)
      const existingSettings = await tx
        .select({ id: hospitalSettings.id })
        .from(hospitalSettings)
        .where(eq(hospitalSettings.hospitalId, hospitalId))
        .limit(1);

      if (existingSettings.length === 0) {
        // Insert new settings row if it does not exist
        await tx.insert(hospitalSettings).values({
          hospitalId,
          isSurgicalEnabled,
          isTelemedicineEnabled,
          isPatientPortalEnabled,
          isOnlinePaymentsEnabled,
          paymobApiKey: paymobApiKey ? encryptField(paymobApiKey) : null,
          paymobCardId: paymobCardId || null,
          paymobWalletId: paymobWalletId || null,
          paymobFawryId: paymobFawryId || null,
          paymobHmacSecret: paymobHmacSecret ? encryptField(paymobHmacSecret) : null,
          orCleaningDuration,
          autoHousekeeping,
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
            paymobApiKey: paymobApiKey ? encryptField(paymobApiKey) : null,
            paymobCardId: paymobCardId || null,
            paymobWalletId: paymobWalletId || null,
            paymobFawryId: paymobFawryId || null,
            paymobHmacSecret: paymobHmacSecret ? encryptField(paymobHmacSecret) : null,
            orCleaningDuration,
            autoHousekeeping,
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
