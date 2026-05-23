"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { medicationAdministration, prescriptionItems } from "@db/schema/pharmacy";
import { nursingAssessments, shifts, handoverNotes } from "@db/schema/nursing";
import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

export async function startShift(payload: {
  hospitalId: string;
  departmentId: string;
  hospitalSlug: string;
}) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to start a shift.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      // Check if there's already an active shift for this user
      const existingShift = await tx.query.shifts.findFirst({
        where: and(
          eq(shifts.staffId, session.user.id),
          eq(shifts.status, "active")
        ),
      });

      if (existingShift) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "You already have an active shift.");
      }

      const [record] = await tx
        .insert(shifts)
        .values({
          hospitalId: payload.hospitalId,
          staffId: session.user.id,
          departmentId: payload.departmentId,
          startTime: new Date(),
          status: "active",
        })
        .returning();

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/nursing`, "page");
      return { success: true, shiftId: record.id };
    });
  } catch (error: any) {
    console.error("Start Shift Error:", error);
    return {
      success: false,
      error: error.message || "Failed to start shift.",
    };
  }
}

export async function endShift(payload: {
  hospitalId: string;
  shiftId: string;
  hospitalSlug: string;
}) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to end a shift.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      const [record] = await tx
        .update(shifts)
        .set({
          endTime: new Date(),
          status: "completed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shifts.id, payload.shiftId),
            eq(shifts.staffId, session.user.id),
            eq(shifts.status, "active")
          )
        )
        .returning();

      if (!record) {
        throw new AppError(ErrorCode.NOT_FOUND, "Active shift not found or already ended.");
      }

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/nursing`, "page");
      return { success: true };
    });
  } catch (error: any) {
    console.error("End Shift Error:", error);
    return {
      success: false,
      error: error.message || "Failed to end shift.",
    };
  }
}

export async function createHandoverNote(payload: {
  hospitalId: string;
  patientId: string;
  admissionId: string;
  departmentId: string;
  toStaffId?: string;
  content: string;
  priority: "routine" | "urgent" | "emergency";
  hospitalSlug: string;
}) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to create a handover note.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      const [record] = await tx
        .insert(handoverNotes)
        .values({
          hospitalId: payload.hospitalId,
          patientId: payload.patientId,
          admissionId: payload.admissionId,
          fromStaffId: session.user.id,
          toStaffId: payload.toStaffId,
          departmentId: payload.departmentId,
          content: payload.content,
          priority: payload.priority,
        })
        .returning();

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/nursing`, "page");
      return { success: true, noteId: record.id };
    });
  } catch (error: any) {
    console.error("Handover Note Error:", error);
    return {
      success: false,
      error: error.message || "Failed to create handover note.",
    };
  }
}

export async function acknowledgeHandoverNote(payload: {
  hospitalId: string;
  noteId: string;
  hospitalSlug: string;
}) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to acknowledge a note.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      const [record] = await tx
        .update(handoverNotes)
        .set({
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        })
        .where(
          and(
            eq(handoverNotes.id, payload.noteId),
            eq(handoverNotes.isAcknowledged, false)
          )
        )
        .returning();

      if (!record) {
        throw new AppError(ErrorCode.NOT_FOUND, "Handover note not found or already acknowledged.");
      }

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/nursing`, "page");
      return { success: true };
    });
  } catch (error: any) {
    console.error("Acknowledge Note Error:", error);
    return {
      success: false,
      error: error.message || "Failed to acknowledge note.",
    };
  }
}

export async function createNursingAssessment(payload: {
  hospitalId: string;
  patientId: string;
  admissionId?: string;
  type: string;
  data: any;
  notes?: string;
  hospitalSlug: string;
}) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to record assessment.");
  }

  // RBAC Check
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions to record assessment.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      const [record] = await tx
        .insert(nursingAssessments)
        .values({
          hospitalId: payload.hospitalId,
          patientId: payload.patientId,
          admissionId: payload.admissionId,
          recordedBy: session.user.id,
          type: payload.type,
          data: payload.data,
          notes: payload.notes,
        })
        .returning();

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/patients/${payload.patientId}`, "layout");
      if (payload.admissionId) {
        revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/admissions/${payload.admissionId}`, "layout");
      }

      return { success: true, recordId: record.id };
    });
  } catch (error: any) {
    console.error("Assessment Record Error:", error);
    return {
      success: false,
      error: error.message || "Failed to record nursing assessment.",
    };
  }
}

interface RecordAdminPayload {
  hospitalId: string;
  patientId: string;
  prescriptionItemId: string;
  scheduledAt: Date;
  administeredAt?: Date;
  status: "given" | "missed" | "refused" | "held";
  doseGiven?: string;
  notes?: string;
  hospitalSlug: string;
}

export async function recordMedicationAdministration(payload: RecordAdminPayload) {
  const session = await auth();
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "You must be logged in to record administration.");
  }

  // RBAC Check
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions to record administration.");
  }

  try {
    return await withTenantContext(payload.hospitalId, async (tx) => {
      // 1. Insert administration record
      const [record] = await tx
        .insert(medicationAdministration)
        .values({
          hospitalId: payload.hospitalId,
          patientId: payload.patientId,
          prescriptionItemId: payload.prescriptionItemId,
          administeredBy: session.user.id,
          scheduledAt: payload.scheduledAt,
          administeredAt: payload.administeredAt || new Date(),
          status: payload.status,
          doseGiven: payload.doseGiven,
          notes: payload.notes,
        })
        .returning();

      // 2. If status is 'given', update prescription item dispensed count if needed
      // (Simplified logic: in a real system, we'd track inventory too)
      if (payload.status === "given") {
        // Optional: Update stockTransactions here
      }

      revalidatePath(`/[locale]/(dashboard)/${payload.hospitalSlug}/nursing/mar/[admissionId]`, "page");

      return { success: true, recordId: record.id };
    });
  } catch (error: any) {
    console.error("MAR Record Error:", error);
    return {
      success: false,
      error: error.message || "Failed to record medication administration.",
    };
  }
}
