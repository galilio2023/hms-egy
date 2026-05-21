"use server";

import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";

/**
 * Server action to handle hospital onboarding.
 */
export async function setupHospital(data: HospitalOnboarding): Promise<{ 
  success?: boolean; 
  hospitalId?: string; 
  error?: string; 
  details?: Record<string, unknown> 
}> {
  // 1. Validate data
  const validated = hospitalOnboardingSchema.safeParse(data);
  if (!validated.success) {
    return { 
      error: "Invalid data submitted", 
      details: validated.error.format() as unknown as Record<string, unknown> 
    };
  }

  // TEMPORARY GUARD: Block onboarding until Phase 6 (Auth) is implemented to prevent UX Deadlock.
  // This ensures users don't create hospitals with no way to log in.
  console.log(`[ONBOARDING_GUARD] Request for ${validated.data.adminEmail} blocked (Phase 6 pending)`);
  
  return { 
    error: "Hospital onboarding is temporarily paused until authentication (Phase 6) is fully integrated. Please check the project roadmap." 
  };

  /* Logic preserved for Phase 4/6:
  // Requires: import { db } from "@/lib/db"; import { hospitals, hospitalSettings } from "@db/schema";
  try {
    const { modules, adminEmail, adminPassword, adminName, ...hospitalData } = validated.data;

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
  } catch (error: any) {
    if (error?.code === "23505" || error?.message?.includes("unique constraint") || error?.message?.includes("unique_violation")) {
      return { error: "The hospital URL slug is already taken. Please choose another name." };
    }
    console.error(`[ONBOARDING_FAILURE] Slug: ${validated.data.slug}`, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: "An unexpected error occurred during setup." };
  }
  */
}
