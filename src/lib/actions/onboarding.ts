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

  try {
    const { modules, adminEmail, adminPassword, adminName, ...hospitalData } = validated.data;

    // 2. Create hospital
    const [hospital] = await db.insert(hospitals).values({
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
    await db.insert(hospitalSettings).values({
      hospitalId: hospital.id,
      isSurgicalEnabled: modules.surgical,
      isTelemedicineEnabled: modules.telemedicine,
      isPatientPortalEnabled: modules.portal,
      isOnlinePaymentsEnabled: modules.payments,
    });

    // 4. Create admin user (Placeholder - Phase 6 will implement full Better Auth integration)
    // NOTE: In Phase 6, we will hash adminPassword and insert into the 'users' and 'staff' tables.
    console.log(`[ONBOARDING] Admin user creation queued for ${adminEmail} (${adminName})`);
    
    return { success: true, hospitalId: hospital.id };
  } catch (error) {
    console.error("Onboarding failed:", error);
    return { error: "An unexpected error occurred during setup." };
  }
}
