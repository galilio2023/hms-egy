"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { beds, admissions, dischargeSummaries, vitalsFlowsheet, rooms } from "@db/schema/clinical";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { staff } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { backgroundJobs } from "@db/schema/system";
import { stockTransactions } from "@db/schema/pharmacy";
import { eq, and, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { validateVitals } from "./clinical";
import { normalizeDecimal } from "@/lib/utils/egypt";
import { calculateMEWS } from "@/lib/clinical/mews";
import { sendResilientClinicalAlert } from "@/lib/sms/client";

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: error instanceof AppError ? error.message : "Failed to admit patient: " + message,
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

      // 1.5 Safety Audit: Block discharge if there are unbilled pharmacy items
      const unbilledItems = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.hospitalId, hospitalId),
            // Strictly check for this admission's dispensed items
            eq(stockTransactions.admissionId, payload.admissionId),
            eq(stockTransactions.type, "dispense"),
            isNull(stockTransactions.invoiceItemId)
          )
        )
        .then(res => res[0].count);

      if (unbilledItems > 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Discharge Blocked: There are ${unbilledItems} unbilled pharmacy items for this patient. Please finalize the pharmacy invoice before discharging.`
        );
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: error instanceof AppError ? error.message : "Failed to discharge patient: " + message,
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
  const vitalsValidation = await validateVitals({
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
    const cleanTemperature = payload.temperature && String(payload.temperature).trim() !== ""
      ? normalizeDecimal(payload.temperature)?.toFixed(1) || null
      : null;

    const cleanWeight = payload.weightKg && String(payload.weightKg).trim() !== ""
      ? normalizeDecimal(payload.weightKg)?.toFixed(1) || null
      : null;

    const result = await withTenantContext(hospitalId, async (tx) => {
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

    if (result.success && result.vitalId) {
      // 1. Calculate MEWS dynamically
      const mews = calculateMEWS({
        systolicBp: payload.bloodPressureSystolic,
        heartRate: payload.heartRate,
        respiratoryRate: payload.respiratoryRate,
        temperature: cleanTemperature,
      });

      // 2. Proactively trigger out-of-band alerts asynchronously in the background using Next.js 15 after() API
      if (mews.score >= 5) {
        // A. Queue the job in the database first to ensure survivability
        const [job] = await db.insert(backgroundJobs).values({
          hospitalId,
          jobType: "critical_mews_alert",
          payload: {
            patientId: payload.patientId,
            vitalId: result.vitalId,
            mewsScore: mews.score,
          },
          status: "pending",
        }).returning();

        after(() => {
          withTenantContext(hospitalId, async (tx) => {
            try {
              await tx.update(backgroundJobs)
                .set({ status: "processing", attempts: sql`${backgroundJobs.attempts} + 1`, updatedAt: new Date() })
                .where(eq(backgroundJobs.id, job.id));

              await dispatchCriticalAlerts(hospitalId, payload.patientId, result.vitalId!, mews.score, tx);

              await tx.update(backgroundJobs)
                .set({ status: "completed", updatedAt: new Date() })
                .where(eq(backgroundJobs.id, job.id));
            } catch (err) {
              console.error("[CRITICAL ALERT GATEWAY] Asynchronous alert dispatch failed:", err);
              await tx.update(backgroundJobs)
                .set({
                  status: "failed",
                  lastError: err instanceof Error ? err.message : String(err),
                  updatedAt: new Date()
                })
                .where(eq(backgroundJobs.id, job.id));
            }
          }).catch((err) => console.error("[TENANT CONTEXT] Failed to establish background context for alerts:", err));
        });
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: "Failed to record inpatient vitals: " + message,
    };
  }
}

/**
 * Helper to dispatch critical patient alerts with serverless execution guarantee.
 */
async function dispatchCriticalAlerts(
  hospitalId: string,
  patientId: string,
  vitalId: string,
  mewsScore: number,
  tx: Parameters<Parameters<typeof withTenantContext>[1]>[0]
) {
  try {
    // A. Fetch Patient details using the provided transaction context
    const [patient] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.hospitalId, hospitalId)))
      .limit(1);

    if (!patient) return;

    // B. Fetch attending doctor details from active admissions using transaction context
    const [activeAdmission] = await tx
      .select({
        doctorNameAr: staff.nameAr,
        doctorNameEn: staff.nameEn,
        doctorPhone: staff.phone,
      })
      .from(admissions)
      .innerJoin(staff, eq(admissions.admittingDoctorId, staff.id))
      .where(
        and(
          eq(admissions.patientId, patientId),
          eq(admissions.status, "active"),
          eq(admissions.hospitalId, hospitalId)
        )
      )
      .limit(1);

    // C. Alert Attending Physician (Doctor) via WhatsApp / SMS
    if (activeAdmission && activeAdmission.doctorPhone) {
      await sendResilientClinicalAlert({
        hospitalId,
        patientId,
        phoneNumber: activeAdmission.doctorPhone,
        messageAr: `[تنبيه طارئ MEWS] المريض: ${patient.nameAr} في حالة حرجة. معدل MEWS: ${mewsScore}. يرجى الفحص الفوري للعلامات الحيوية.`,
        messageEn: `[CRITICAL MEWS ALERT] Patient: ${patient.nameEn} has triggered a critical score of ${mewsScore}. Immediate clinical review is required.`,
        reminderType: "critical_mews_alert",
        entityType: "clinical_alert",
        entityId: vitalId,
        whatsappTemplate: {
          name: "mews_critical_alert",
          languageCode: "ar",
          parameters: [patient.nameAr || patient.nameEn || "", String(mewsScore)],
        },
      });
    }

    // D. Alert Patient's Emergency Contact
    if (patient.emergencyContactPhone) {
      await sendResilientClinicalAlert({
        hospitalId,
        patientId,
        phoneNumber: patient.emergencyContactPhone,
        messageAr: `[تحديث طبي] تم تسجيل تغير في المؤشرات الحيوية للمريض ${patient.nameAr}. الفريق الطبي يتابع الحالة فوراً لضمان استقرارها.`,
        messageEn: `[Medical Update] A vital signs alert was logged for patient ${patient.nameEn}. The clinical team is attending to the patient immediately.`,
        reminderType: "critical_mews_alert",
        entityType: "clinical_alert",
        entityId: vitalId,
      });
    }
  } catch (alertErr) {
    console.error("[CRITICAL ALERT GATEWAY] Failed to dispatch out-of-band alerts:", alertErr);
  }
}
