"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { appointments, medicalRecords, vitalsFlowsheet } from "@db/schema/clinical";
import { prescriptions, prescriptionItems } from "@db/schema/pharmacy";
import { hospitals, staff } from "@db/schema/core";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

interface PrescriptionItemInput {
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

interface VitalsInput {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: string; // Stored as decimal in DB, but passed as string/number
  oxygenSaturation?: number;
  weightKg?: string; // Stored as decimal in DB, but passed as string/number
  heightCm?: number;
}

/**
 * Completes a remote telemedicine consultation, records SOAP logs, optional digital prescriptions, and vital flowsheets.
 */
export async function completeTelemedicineConsultation(
  appointmentId: string,
  soapNotes: string,
  diagnosis?: string,
  prescriptionItemsList?: PrescriptionItemInput[],
  prescriptionNotes?: string,
  vitals?: VitalsInput
) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  // 1. Get the appointment to resolve patientId, doctorId, and hospitalId
  const appointment = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1)
    .then((res) => res[0]);

  if (!appointment) {
    return { success: false, error: "Appointment not found." };
  }

  const hospitalId = appointment.hospitalId;

  // 2. Validate edit permissions for the hospital
  const isAuthorized = hasPermission(session.user as unknown as User, "appointments:edit", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to complete outpatient encounters." };
  }

  // 3. Enforce doctor assignment ownership (only the assigned doctor or SUPER_ADMIN can finalize)
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  let isAssignedDoctor = false;

  if (!isSuperAdmin) {
    const currentStaff = await db
      .select()
      .from(staff)
      .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
      .limit(1)
      .then((res) => res[0]);

    if (currentStaff && appointment.doctorId === currentStaff.id) {
      isAssignedDoctor = true;
    }
  }

  if (!isSuperAdmin && !isAssignedDoctor) {
    return { success: false, error: "Forbidden: Only the assigned medical professional or a super administrator can complete this encounter." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      return await tx.transaction(async (innerTx) => {
        // A. Update appointment status to completed
        await innerTx
          .update(appointments)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(appointments.id, appointmentId));

        // B. Insert the clinical encounter SOAP medical record
        const [medRecord] = await innerTx
          .insert(medicalRecords)
          .values({
            hospitalId,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            encounterType: "outpatient",
            symptoms: appointment.notes || "",
            diagnosis: diagnosis || "Telemedicine Consult Completed",
            soapNotes,
            isArchived: false,
          })
          .returning();

        // C. If medication prescriptions are supplied, create the prescription and its items
        let prescriptionId: string | undefined = undefined;
        if (prescriptionItemsList && prescriptionItemsList.length > 0) {
          const [newPrescription] = await innerTx
            .insert(prescriptions)
            .values({
              hospitalId,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              status: "active",
              notes: prescriptionNotes || null,
            })
            .returning();

          if (!newPrescription) {
            throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create prescription record.");
          }

          prescriptionId = newPrescription.id;

          const itemsToInsert = prescriptionItemsList.map((item) => ({
            hospitalId,
            prescriptionId: newPrescription.id,
            medicationId: item.medicationId,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            instructions: item.instructions || null,
            status: "pending",
          }));

          await innerTx.insert(prescriptionItems).values(itemsToInsert);
        }

        // D. If vitals are recorded, save them to the flowsheet
        let vitalsId: string | undefined = undefined;
        const hasVitals = vitals && (
          vitals.bloodPressureSystolic ||
          vitals.bloodPressureDiastolic ||
          vitals.heartRate ||
          vitals.respiratoryRate ||
          vitals.temperature ||
          vitals.oxygenSaturation ||
          vitals.weightKg ||
          vitals.heightCm
        );

        if (hasVitals) {
          const [newVitals] = await innerTx
            .insert(vitalsFlowsheet)
            .values({
              hospitalId,
              patientId: appointment.patientId,
              recordedBy: appointment.doctorId,
              recordedAt: new Date(),
              bloodPressureSystolic: vitals.bloodPressureSystolic || null,
              bloodPressureDiastolic: vitals.bloodPressureDiastolic || null,
              heartRate: vitals.heartRate || null,
              respiratoryRate: vitals.respiratoryRate || null,
              temperature: vitals.temperature || null,
              oxygenSaturation: vitals.oxygenSaturation || null,
              weightKg: vitals.weightKg || null,
              heightCm: vitals.heightCm || null,
            })
            .returning();
          
          if (newVitals) {
            vitalsId = newVitals.id;
          }
        }

        // Fetch hospital slug for path revalidation
        const [hospital] = await innerTx
          .select({ slug: hospitals.slug })
          .from(hospitals)
          .where(eq(hospitals.id, hospitalId))
          .limit(1);
        const hospitalSlug = hospital?.slug || hospitalId;

        revalidatePath(`/[locale]/${hospitalSlug}/appointments`, "page");
        revalidatePath(`/[locale]/${hospitalSlug}/patients/${appointment.patientId}`, "page");

        return { 
          success: true, 
          medicalRecordId: medRecord.id,
          prescriptionId,
          vitalsId
        };
      });
    });
  } catch (error) {
    console.error("[CLINICAL_ACTION] completeTelemedicineConsultation failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while completing the consultation." };
  }
}
