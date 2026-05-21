"use server";

import { db, withBypassContext } from "@/lib/db";
import { hospitals, hospitalSettings, staff } from "@db/schema/core";
import { authInstance } from "@/lib/auth";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";

/**
 * Server action to handle hospital onboarding and administrative registration.
 * Executes within a bypassed RLS context since a tenant session is not yet established.
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
      error: "بيانات الإدخال غير صالحة.", 
      details: validated.error.format() as unknown as Record<string, unknown> 
    };
  }

  const { modules, adminEmail, adminPassword, adminName, ...hospitalData } = validated.data;

  try {
    // Execute hospital creation and initial setup within a single transaction with RLS bypassed
    const result = await withBypassContext(async (tx) => {
      // 2. Create the hospital
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

      if (!hospital) {
        throw new Error("Failed to insert hospital row");
      }

      // 3. Create default hospital settings
      await tx.insert(hospitalSettings).values({
        hospitalId: hospital.id,
        isSurgicalEnabled: modules.surgical,
        isTelemedicineEnabled: modules.telemedicine,
        isPatientPortalEnabled: modules.portal,
        isOnlinePaymentsEnabled: modules.payments,
        orCleaningDuration: 30,
        autoHousekeeping: true,
      });

      return hospital;
    });

    if (!result) {
      throw new Error("Hospital onboarding transaction failed");
    }

    // 4. Create the administrative user via Better Auth Server API
    // This will hash the password and insert the record into the 'users' and 'accounts' tables
    const userResult = await authInstance.api.signUpEmail({
      body: {
        email: adminEmail.toLowerCase().trim(),
        password: adminPassword,
        name: adminName,
        role: "ADMIN",
        hospitalId: result.id,
      },
    });

    if (!userResult || !userResult.user) {
      throw new Error("Failed to register the administrator account in Better Auth");
    }

    // 5. Create the staff entry linked to the new authenticated user
    await withBypassContext(async (tx) => {
      await tx.insert(staff).values({
        hospitalId: result.id,
        userId: userResult.user.id, // Better Auth User ID
        nameAr: adminName,
        nameEn: adminName,
        role: "ADMIN",
        email: adminEmail.toLowerCase().trim(),
        phone: hospitalData.contactPhone,
        isActive: true,
      });
    });

    console.log(`[ONBOARDING] Successfully established hospital ${result.nameEn} and admin account ${adminEmail}`);
    return { success: true, hospitalId: result.id };

  } catch (error: any) {
    if (error?.code === "23505" || error?.message?.includes("unique constraint") || error?.message?.includes("unique_violation")) {
      return { error: "الرابط التعريفي للمستشفى محجوز بالفعل. يرجى اختيار اسم آخر." };
    }
    
    console.error(`[ONBOARDING_FAILURE] Slug: ${validated.data.slug}`, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    return { error: "حدث خطأ غير متوقع أثناء إعداد النظام. يرجى المحاولة مرة أخرى." };
  }
}
