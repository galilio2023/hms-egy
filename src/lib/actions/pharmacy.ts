"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { medications, prescriptions, prescriptionItems } from "@db/schema/pharmacy";
import { patients } from "@db/schema/patients";
import { eq, and, or, ilike, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { checkDrugInteractions } from "@/lib/pharmacy/ddi";
import { revalidatePath } from "next/cache";

interface PrescriptionItemInput {
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

/**
 * Validates a set of medications for interactions and allergies.
 * Returns the DDI results for UI display and hard-stop validation.
 */
export async function runDdiCheck(patientId: string, itemInputs: PrescriptionItemInput[]) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Fetch medication details from catalog
      const medIds = itemInputs.map(i => i.medicationId);
      if (medIds.length === 0) return { success: true, data: null };

      const medDetails = await tx
        .select({
          id: medications.id,
          name: medications.nameEn,
          genericName: medications.genericName,
        })
        .from(medications)
        .where(and(
          eq(medications.hospitalId, hospitalId),
          inArray(medications.id, medIds)
        ));

      // 2. Fetch patient profile for allergies and chronic conditions
      const [patient] = await tx
        .select({
          allergies: patients.allergies,
          chronicConditions: patients.chronicConditions,
        })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient) throw new Error("Patient not found");

      // 3. Run the interaction check
      const results = await checkDrugInteractions(
        medDetails.map(m => ({ name: m.name, genericName: m.genericName })),
        patient.allergies || [],
        patient.chronicConditions || []
      );

      return { success: true, data: results };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new prescription and its items.
 */
export async function createPrescription(payload: {
  patientId: string;
  items: PrescriptionItemInput[];
  notes?: string;
  hasDdiOverride?: boolean;
  ddiOverrideReason?: string;
}) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Mandatory Server-Side DDI Validation
      const medIds = payload.items.map(i => i.medicationId);
      if (medIds.length === 0) throw new Error("At least one medication is required");

      const [medDetails, patient] = await Promise.all([
        tx
          .select({
            id: medications.id,
            name: medications.nameEn,
            genericName: medications.genericName,
          })
          .from(medications)
          .where(and(
            eq(medications.hospitalId, hospitalId),
            inArray(medications.id, medIds)
          )),
        tx
          .select({
            allergies: patients.allergies,
            chronicConditions: patients.chronicConditions,
          })
          .from(patients)
          .where(eq(patients.id, payload.patientId))
          .limit(1)
          .then(res => res[0])
      ]);

      if (!patient) throw new Error("Patient not found");

      const ddiCheck = await checkDrugInteractions(
        medDetails.map(m => ({ name: m.name, genericName: m.genericName })),
        patient.allergies || [],
        patient.chronicConditions || []
      );

      // Enforce hard-stops and justification requirements
      if (!ddiCheck.isApproved && !payload.hasDdiOverride) {
        throw new Error("Contraindicated drug interaction detected. Override justification required.");
      }

      if (ddiCheck.overallRiskLevel === "high" && (!payload.ddiOverrideReason || payload.ddiOverrideReason.trim().length < 10)) {
        throw new Error("High risk prescription requires a valid medical justification (min 10 characters).");
      }

      // 2. Create the master prescription record
      const [newRx] = await tx
        .insert(prescriptions)
        .values({
          hospitalId,
          patientId: payload.patientId,
          doctorId: session.user.id,
          notes: payload.notes,
          hasDdiOverride: payload.hasDdiOverride || false,
          ddiOverrideReason: payload.ddiOverrideReason,
          status: "active",
        })
        .returning();

      if (!newRx) throw new Error("Failed to create prescription");

      // 3. Create prescription items
      const itemsToInsert = payload.items.map(item => ({
        hospitalId,
        prescriptionId: newRx.id,
        medicationId: item.medicationId,
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: item.durationDays,
        instructions: item.instructions,
        status: "pending",
      }));

      await tx.insert(prescriptionItems).values(itemsToInsert);

      return { success: true, rxId: newRx.id };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Searches medications in the hospital catalog.
 */
export async function searchMedications(query: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const results = await tx
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.hospitalId, hospitalId),
            eq(medications.isActive, true),
            or(
              ilike(medications.nameEn, `%${query}%`),
              ilike(medications.nameAr, `%${query}%`),
              ilike(medications.genericName, `%${query}%`),
              ilike(medications.barcode || "", `%${query}%`)
            )
          )
        )
        .limit(20);

      return { success: true, data: results };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
