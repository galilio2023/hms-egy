"use server";

import { db, withBypassContext } from "@/lib/db";
import { hospitals, hospitalSettings, staff } from "@db/schema/core";
import { users } from "@db/schema/auth";
import { authInstance } from "@/lib/auth";
import { hospitalOnboardingSchema, type HospitalOnboarding } from "@/lib/validations/hospital.schema";
import { eq } from "drizzle-orm";

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

  let createdUserId: string | null = null;

  try {
    // 1. Create the administrative user via Better Auth Server API first with no hospitalId
    // This will hash the password and insert the record into the 'users' and 'accounts' tables
    try {
      const userResult = await authInstance.api.signUpEmail({
        body: {
          email: adminEmail.toLowerCase().trim(),
          password: adminPassword,
          name: adminName,
          role: "ADMIN",
          // Do not assign hospitalId yet because the hospital does not exist in the database yet
        },
      });

      if (!userResult || !userResult.user) {
        throw new Error("Failed to register the administrator account in Better Auth");
      }

      createdUserId = userResult.user.id;
    } catch (authError) {
      console.error("[ONBOARDING] Better Auth signUpEmail failed", authError);
      const message = authError instanceof Error ? authError.message : String(authError);
      const errCode = authError && typeof authError === "object" && "code" in authError ? (authError as { code?: string }).code : undefined;
      if (message.includes("unique_violation") || message.includes("already exists") || errCode === "23505") {
        return { error: "البريد الإلكتروني هذا مسجل بالفعل في النظام." };
      }
      throw authError;
    }

    // 2. Execute all database insertions and linkage inside a single transaction with RLS bypassed
    try {
      const result = await withBypassContext(async (tx) => {
        // Create the hospital
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

        // Create default hospital settings
        await tx.insert(hospitalSettings).values({
          hospitalId: hospital.id,
          isSurgicalEnabled: modules.surgical,
          isTelemedicineEnabled: modules.telemedicine,
          isPatientPortalEnabled: modules.portal,
          isOnlinePaymentsEnabled: modules.payments,
          orCleaningDuration: 30,
          autoHousekeeping: true,
        });

        // Create staff entry linked to the new hospital and user
        await tx.insert(staff).values({
          hospitalId: hospital.id,
          userId: createdUserId!, // Better Auth User ID
          nameAr: adminName,
          nameEn: adminName,
          role: "ADMIN",
          email: adminEmail.toLowerCase().trim(),
          phone: hospitalData.contactPhone,
          isActive: true,
        });

        // Update the admin user with the newly created hospitalId
        await tx.update(users)
          .set({ hospitalId: hospital.id, updatedAt: new Date() })
          .where(eq(users.id, createdUserId!));

        return hospital;
      });

      if (!result) {
        throw new Error("Hospital onboarding transaction failed");
      }

      console.log(`[ONBOARDING] Successfully established hospital ${result.nameEn} and admin account ${adminEmail}`);
      return { success: true, hospitalId: result.id };

    } catch (dbError) {
      console.error("[ONBOARDING_CLEANUP] Database transaction failed. Rolling back Better Auth user...", dbError);
      // Clean up the created Better Auth user
      if (createdUserId) {
        await withBypassContext(async (tx) => {
          await tx.delete(users).where(eq(users.id, createdUserId!));
        });
      }
      throw dbError;
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errCode = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    if (errCode === "23505" || message.includes("unique constraint") || message.includes("unique_violation")) {
      return { error: "الرابط التعريفي للمستشفى محجوز بالفعل. يرجى اختيار اسم آخر." };
    }
    
    console.error(`[ONBOARDING_FAILURE] Slug: ${validated.data.slug}`, {
      error: message || "Unknown error",
    });
    
    return { error: "حدث خطأ غير متوقع أثناء إعداد النظام. يرجى المحاولة مرة أخرى." };
  }
}
