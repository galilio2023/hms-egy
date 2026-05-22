"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { internalReferrals } from "@db/schema/clinical";
import { departments, staff } from "@db/schema/core";
import { eq, and, desc, aliasedTable } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

export interface ReferralInput {
  patientId: string;
  targetDepartmentId: string;
  targetDoctorId?: string | null;
  reason: string;
  urgency: "routine" | "urgent" | "emergency";
  notes?: string | null;
}

/**
 * Creates an internal referral for a patient to another department or doctor.
 */
export async function createReferralAction(input: ReferralInput) {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول. يرجى تسجيل الدخول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط لإجراء الإحالة.");
  }

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // Resolve referring Doctor (Staff) ID
      const currentStaff = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!currentStaff) {
        throw new AppError(ErrorCode.NOT_FOUND, "Clinical Profile Error: Doctor profile not found.");
      }

      // Create the internal referral
      const [newReferral] = await tx
        .insert(internalReferrals)
        .values({
          hospitalId,
          patientId: input.patientId,
          referringDoctorId: currentStaff.id,
          targetDepartmentId: input.targetDepartmentId,
          targetDoctorId: input.targetDoctorId || null,
          reason: input.reason.trim(),
          urgency: input.urgency,
          status: "pending",
          notes: input.notes?.trim() || null,
        })
        .returning();

      return newReferral;
    });

    revalidatePath(`/[locale]/${hospitalId}/patients/${input.patientId}`, "page");
    return { success: true, data: result };
  } catch (error) {
    console.error("[CREATE_REFERRAL_ERROR]", error);
    return { success: false, error: "فشل إنشاء الإحالة الطبية. يرجى المحاولة لاحقاً." };
  }
}

/**
 * Retrieves all internal referrals for a given patient.
 */
export async function getPatientReferralsAction(patientId: string) {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط.");
  }

  try {
    const results = await withTenantContext(hospitalId, async (tx) => {
      const referringStaff = aliasedTable(staff, "referring_staff");
      const targetStaff = aliasedTable(staff, "target_staff");

      return await tx
        .select({
          id: internalReferrals.id,
          reason: internalReferrals.reason,
          urgency: internalReferrals.urgency,
          status: internalReferrals.status,
          notes: internalReferrals.notes,
          createdAt: internalReferrals.createdAt,
          targetDepartmentNameAr: departments.nameAr,
          targetDepartmentNameEn: departments.nameEn,
          referringDoctorNameAr: referringStaff.nameAr,
          referringDoctorNameEn: referringStaff.nameEn,
          targetDoctorNameAr: targetStaff.nameAr,
          targetDoctorNameEn: targetStaff.nameEn,
        })
        .from(internalReferrals)
        .leftJoin(departments, eq(internalReferrals.targetDepartmentId, departments.id))
        .leftJoin(referringStaff, eq(internalReferrals.referringDoctorId, referringStaff.id))
        .leftJoin(targetStaff, eq(internalReferrals.targetDoctorId, targetStaff.id))
        .where(eq(internalReferrals.patientId, patientId))
        .orderBy(desc(internalReferrals.createdAt));
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[GET_REFERRALS_ERROR]", error);
    return { success: false, error: "فشل استرداد الإحالات الطبية." };
  }
}

/**
 * Updates the status of an internal referral.
 */
export async function updateReferralStatusAction(referralId: string, status: "pending" | "accepted" | "completed" | "cancelled") {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط.");
  }

  try {
    await withTenantContext(hospitalId, async (tx) => {
      await tx
        .update(internalReferrals)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(internalReferrals.id, referralId));
    });

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_REFERRAL_STATUS_ERROR]", error);
    return { success: false, error: "فشل تحديث حالة الإحالة." };
  }
}
