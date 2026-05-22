"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { beds, admissions, dischargeSummaries, vitalsFlowsheet, rooms } from "@db/schema/clinical";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { staff } from "@db/schema/core";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { validateVitals } from "./clinical";

interface AdmitPatientPayload {
  patientId: string;
  bedId: string;
  admittingDoctorId: string;
  admissionReason: string;
}

interface DischargePatientPayload {
  admissionId: string;
  dischargeCondition: "stable" | "improved" | "referred" | "deceased";
  followUpInstructions?: string;
  summaryAr: string;
  summaryEn: string;
}

interface RecordVitalsPayload {
  patientId: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: string; // Stored as decimal in DB
  oxygenSaturation?: number; // percentage
  weightKg?: string; // Stored as decimal in DB
  heightCm?: number;
}

/**
 * Admits a patient to a bed inside the current hospital tenant scope.
 */
export async function admitPatient(payload: AdmitPatientPayload) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context missing." };
  }

  const isAuthorized = hasPermission(session.user as unknown as User, "admissions:create", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to admit patients." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Verify patient has no active admissions in this hospital
      const activeAdmission = await tx
        .select()
        .from(admissions)
        .where(
          and(
            eq(admissions.patientId, payload.patientId),
            eq(admissions.hospitalId, hospitalId),
            eq(admissions.status, "active")
          )
        )
        .limit(1)
        .then((res) => res[0]);

      if (activeAdmission) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "This patient already has an active admission in this hospital."
        );
      }

      // 2. Verify bed availability with row-level write lock to prevent double-booking race conditions
      const [bed] = await tx
        .select()
        .from(beds)
        .where(and(eq(beds.id, payload.bedId), eq(beds.hospitalId, hospitalId)))
        .for("update");

      if (!bed) {
        throw new AppError(ErrorCode.NOT_FOUND, "The selected bed was not found.");
      }

      if (bed.status !== "available") {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "The selected bed is not available (current status: " + bed.status + ")."
        );
      }

      // 3. Mark the bed as occupied
      await tx
        .update(beds)
        .set({ status: "occupied", updatedAt: new Date() })
        .where(eq(beds.id, payload.bedId));

      // 4. Create the admission record
      const [newAdmission] = await tx
        .insert(admissions)
        .values({
          hospitalId,
          patientId: payload.patientId,
          bedId: payload.bedId,
          admittingDoctorId: payload.admittingDoctorId,
          admissionDate: new Date(),
          reason: payload.admissionReason,
          status: "active",
        })
        .returning();

      return { success: true, admissionId: newAdmission.id };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error instanceof AppError ? error.message : "Failed to admit patient: " + (error.message || error),
    };
  }
}

/**
 * Discharges a patient from their active admission, updating bed status to pending cleaning
 * and triggering an urgent housekeeping cleaning task.
 */
export async function dischargePatient(payload: DischargePatientPayload) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context missing." };
  }

  const isAuthorized = hasPermission(session.user as unknown as User, "admissions:edit", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to discharge patients." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // Resolve discharging physician staff ID inside tenant context
      const currentStaff = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      // 1. Resolve admission record
      const admission = await tx
        .select()
        .from(admissions)
        .where(and(eq(admissions.id, payload.admissionId), eq(admissions.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!admission) {
        throw new AppError(ErrorCode.NOT_FOUND, "Admission record not found.");
      }

      if (admission.status !== "active") {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "This admission record is already closed.");
      }

      const dischargingDoctorId = currentStaff?.id || admission.admittingDoctorId;

      // 2. Insert Discharge Summary
      const [newSummary] = await tx
        .insert(dischargeSummaries)
        .values({
          hospitalId,
          admissionId: payload.admissionId,
          dischargingDoctorId,
          summaryAr: payload.summaryAr,
          summaryEn: payload.summaryEn,
          dischargeCondition: payload.dischargeCondition,
          followUpInstructions: payload.followUpInstructions || null,
        })
        .returning();

      // 3. Mark the admission as discharged
      const now = new Date();
      await tx
        .update(admissions)
        .set({
          status: "discharged",
          dischargeDate: now,
          updatedAt: now,
        })
        .where(eq(admissions.id, payload.admissionId));

      // 4. Update bed status to pending cleaning
      if (admission.bedId) {
        const [updatedBed] = await tx
          .update(beds)
          .set({
            status: "pending_cleaning",
            lastDischargedAt: now,
            cleaningRequestedAt: now,
            updatedAt: now,
          })
          .where(eq(beds.id, admission.bedId))
          .returning({ roomId: beds.roomId });

        if (updatedBed) {
          // Trigger automatic post-discharge housekeeping task
          await tx.insert(housekeepingTasks).values({
            hospitalId,
            bedId: admission.bedId,
            roomId: updatedBed.roomId,
            type: "post_discharge",
            status: "pending",
            priority: "urgent",
            requestedAt: now,
            requestedBy: dischargingDoctorId,
          });
        }
      }

      return { success: true };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error instanceof AppError ? error.message : "Failed to discharge patient: " + (error.message || error),
    };
  }
}

/**
 * Records dynamic inpatient vitals logged on the Flowshet.
 */
export async function recordInpatientVitals(payload: RecordVitalsPayload) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context missing." };
  }

  const isAuthorized = hasPermission(session.user as unknown as User, "medical_records:create", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to record vitals." };
  }

  // Enforce clinical biological safety boundaries to prevent data corruption
  const vitalsValidation = validateVitals({
    bloodPressureSystolic: payload.bloodPressureSystolic,
    bloodPressureDiastolic: payload.bloodPressureDiastolic,
    heartRate: payload.heartRate,
    respiratoryRate: payload.respiratoryRate,
    temperature: payload.temperature,
    oxygenSaturation: payload.oxygenSaturation,
  });

  if (!vitalsValidation.success) {
    return { success: false, error: vitalsValidation.error };
  }

  try {
    const cleanTemperature = payload.temperature && !isNaN(parseFloat(payload.temperature))
      ? parseFloat(payload.temperature).toFixed(1)
      : null;

    const cleanWeight = payload.weightKg && !isNaN(parseFloat(payload.weightKg))
      ? parseFloat(payload.weightKg).toFixed(1)
      : null;

    return await withTenantContext(hospitalId, async (tx) => {
      const currentStaff = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!currentStaff) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "You must be registered as hospital staff to record clinical vitals.");
      }

      const [record] = await tx
        .insert(vitalsFlowsheet)
        .values({
          hospitalId,
          patientId: payload.patientId,
          recordedBy: currentStaff.id,
          recordedAt: new Date(),
          bloodPressureSystolic: payload.bloodPressureSystolic || null,
          bloodPressureDiastolic: payload.bloodPressureDiastolic || null,
          heartRate: payload.heartRate || null,
          respiratoryRate: payload.respiratoryRate || null,
          temperature: cleanTemperature,
          oxygenSaturation: payload.oxygenSaturation || null,
          weightKg: cleanWeight,
          heightCm: payload.heightCm || null,
        })
        .returning();

      return { success: true, vitalId: record.id };
    });
  } catch (error: any) {
    return {
      success: false,
      error: "Failed to record inpatient vitals: " + (error.message || error),
    };
  }
}
