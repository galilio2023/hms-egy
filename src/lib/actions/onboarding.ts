"use server";

import { db } from "@/lib/db";
import { hospitals, hospitalSettings } from "@db/schema";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";

/**
 * Server action to handle hospital onboarding.
 */
export async function setupHospital(data: HospitalOnboarding) {
  // 1. Validate data
  const validated = hospitalOnboardingSchema.safeParse(data);
  if (!validated.success) {
    return { error: "Invalid data submitted", details: validated.error.format() };
  }

  // Destructure immediately to isolate sensitive credentials
  const { modules, adminEmail, adminPassword, adminName, ...hospitalData } = validated.data;

  try {
    // Execute within a transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // 2. Create hospital
      const [hospital] = await tx.insert(hospitals).values({
        nameAr: hospitalData.nameAr,
        nameEn: hospitalData.nameEn,
        slug: hospitalData.slug,
        contactEmail: hospitalData.contactEmail,
        contactPhone: hospitalData.contactPhone,
        address: hospitalData.address,
        governorate: hospitalData.governorate,
        type: hospitalData.type,
      }).returning();

      // 3. Create settings
      await tx.insert(hospitalSettings).values({
        hospitalId: hospital.id,
        isSurgicalEnabled: modules.surgical,
        isTelemedicineEnabled: modules.telemedicine,
        isPatientPortalEnabled: modules.portal,
        isOnlinePaymentsEnabled: modules.payments,
      });

      return hospital;
    });

    if (!result) throw new Error("Hospital creation failed");

    // 4. Create admin user (Placeholder - Phase 6 will implement full Better Auth integration)
    // NOTE: In Phase 6, we will hash adminPassword and insert into the 'users' and 'staff' tables.
    // NEVER log plain passwords or sensitive identifiers in production logs.
    console.log(`[ONBOARDING] Admin user account placeholder established for ${adminEmail}`);
    
    return { success: true, hospitalId: result.id };
  } catch (error) {
    // Capture safely to internal telemetry (e.g. Sentry / CloudWatch)
    console.error(`[ONBOARDING_FAILURE] Slug: ${hospitalData.slug}`, {
      error: error instanceof Error ? error.message : "Unknown error",
      // NEVER log 'adminPassword' here
    });
    return { error: "An unexpected error occurred during setup." };
  }
}
