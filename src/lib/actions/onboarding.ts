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
    const { modules, ...hospitalData } = validated.data;

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

    // 4. Create admin user (Stubbed until Better Auth is ready)
    console.log("Creating admin user for hospital:", hospital.id, hospitalData.adminEmail);
    
    // In production, we'd call better-auth's signUp or use drizzle to insert into auth tables
    
    return { success: true, hospitalId: hospital.id };
  } catch (error) {
    console.error("Onboarding failed:", error);
    return { error: "An unexpected error occurred during setup." };
  }
}
