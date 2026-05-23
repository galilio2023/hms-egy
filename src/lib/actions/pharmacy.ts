"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { medications, prescriptions, prescriptionItems } from "@db/schema/pharmacy";
import { patients } from "@db/schema/patients";
import { eq, and, or, ilike, sql, inArray, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { checkDrugInteractions } from "@/lib/pharmacy/ddi";
import { revalidatePath } from "next/cache";
import { stockTransactions, auditLogs } from "@db/schema/index";
import { staff } from "@db/schema/core";

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
        patient.chronicConditions || [],
        tx
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
        patient.chronicConditions || [],
        tx
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

/**
 * Adjusts stock level for a medication and records the transaction.
 */
export async function adjustStock(payload: {
  medicationId: string;
  type: "stock_in" | "adjustment" | "waste" | "return";
  quantity: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve medication and current stock
      const [med] = await tx
        .select()
        .from(medications)
        .where(and(eq(medications.id, payload.medicationId), eq(medications.hospitalId, hospitalId)))
        .limit(1);

      if (!med) throw new Error("Medication not found");

      // 2. Resolve staff record for the person performing the action
      const performer = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then(res => res[0]);

      // 3. Record transaction
      await tx.insert(stockTransactions).values({
        hospitalId,
        medicationId: payload.medicationId,
        type: payload.type,
        quantity: payload.quantity,
        notes: payload.notes,
        performedBy: performer?.id || null,
      });

      // 4. Update medication stock count
      await tx
        .update(medications)
        .set({ 
          stockCount: med.stockCount + payload.quantity,
          updatedAt: new Date()
        })
        .where(eq(medications.id, payload.medicationId));

      return { success: true };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/pharmacy/inventory`, "layout");
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches transaction history for a specific medication.
 */
export async function getMedicationHistory(medicationId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const history = await tx
        .select({
          id: stockTransactions.id,
          type: stockTransactions.type,
          quantity: stockTransactions.quantity,
          notes: stockTransactions.notes,
          createdAt: stockTransactions.createdAt,
          performerNameAr: staff.nameAr,
          performerNameEn: staff.nameEn,
        })
        .from(stockTransactions)
        .leftJoin(staff, eq(stockTransactions.performedBy, staff.id))
        .where(and(
          eq(stockTransactions.medicationId, medicationId),
          eq(stockTransactions.hospitalId, hospitalId)
        ))
        .orderBy(desc(stockTransactions.createdAt))
        .limit(50);

      return { success: true, data: history };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Searches active prescriptions for the hospital queue.
 */
export async function searchActivePrescriptions(query: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const results = await tx
        .select({
          id: prescriptions.id,
          createdAt: prescriptions.createdAt,
          status: prescriptions.status,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          itemCount: sql<number>`count(${prescriptionItems.id})`.mapWith(Number),
        })
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .innerJoin(staff, eq(prescriptions.doctorId, staff.id))
        .leftJoin(prescriptionItems, eq(prescriptions.id, prescriptionItems.prescriptionId))
        .where(
          and(
            eq(prescriptions.hospitalId, hospitalId),
            eq(prescriptions.status, "active"),
            or(
              ilike(patients.nameEn, `%${query}%`),
              ilike(patients.nameAr, `%${query}%`),
              ilike(patients.patientNumber, `%${query}%`),
              ilike(prescriptions.id, `%${query}%`)
            )
          )
        )
        .groupBy(
          prescriptions.id,
          prescriptions.createdAt,
          prescriptions.status,
          patients.id,
          patients.nameAr,
          patients.nameEn,
          patients.patientNumber,
          staff.id,
          staff.nameAr,
          staff.nameEn
        )
        .orderBy(desc(prescriptions.createdAt))
        .limit(30);

      return { success: true, data: results };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches prescription details and its items for dispensing.
 */
export async function getPrescriptionForDispensing(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const [rx] = await tx
        .select({
          id: prescriptions.id,
          createdAt: prescriptions.createdAt,
          status: prescriptions.status,
          notes: prescriptions.notes,
          hasDdiOverride: prescriptions.hasDdiOverride,
          ddiOverrideReason: prescriptions.ddiOverrideReason,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          nationalId: patients.nationalId,
          gender: patients.gender,
          birthDate: patients.dob,
          allergies: patients.allergies,
          chronicConditions: patients.chronicConditions,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          doctorRole: staff.role,
        })
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .innerJoin(staff, eq(prescriptions.doctorId, staff.id))
        .where(and(
          eq(prescriptions.id, id),
          eq(prescriptions.hospitalId, hospitalId)
        ))
        .limit(1);

      if (!rx) return { success: false, error: "Prescription not found" };

      const items = await tx
        .select({
          id: prescriptionItems.id,
          medicationId: prescriptionItems.medicationId,
          dosage: prescriptionItems.dosage,
          frequency: prescriptionItems.frequency,
          durationDays: prescriptionItems.durationDays,
          instructions: prescriptionItems.instructions,
          dispensedCount: prescriptionItems.dispensedCount,
          status: prescriptionItems.status,
          medicationNameAr: medications.nameAr,
          medicationNameEn: medications.nameEn,
          genericName: medications.genericName,
          form: medications.form,
          strength: medications.strength,
          barcode: medications.barcode,
          stockCount: medications.stockCount,
          price: medications.price,
        })
        .from(prescriptionItems)
        .innerJoin(medications, eq(prescriptionItems.medicationId, medications.id))
        .where(eq(prescriptionItems.prescriptionId, id));

      return { success: true, data: { ...rx, items } };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Dispenses medications for a prescription and updates stock levels.
 */
export async function dispensePrescription(
  prescriptionId: string,
  items: { prescriptionItemId: string; medicationId: string; quantity: number }[]
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "PHARMACIST"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return { success: false, error: "Unauthorized: Insufficient permissions" };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Fetch prescription and verify it belongs to this hospital and is active
      const [rx] = await tx
        .select()
        .from(prescriptions)
        .where(and(
          eq(prescriptions.id, prescriptionId),
          eq(prescriptions.hospitalId, hospitalId)
        ))
        .limit(1);

      if (!rx) throw new Error("Prescription not found");
      if (rx.status === "completed") throw new Error("Prescription already fully completed");
      if (rx.status === "cancelled") throw new Error("Prescription is cancelled");

      // 2. Fetch the staff ID of the person dispensing
      const performer = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then(res => res[0]);

      if (!performer) throw new Error("Performer staff profile not found");

      const itemIds = items.map(i => i.prescriptionItemId);
      const medIds = items.map(i => i.medicationId);

      // 3. Pre-fetch all needed data to avoid N+1 reads
      const [existingRxItems, existingMeds] = await Promise.all([
        tx.select().from(prescriptionItems).where(inArray(prescriptionItems.id, itemIds)),
        tx.select().from(medications).where(and(eq(medications.hospitalId, hospitalId), inArray(medications.id, medIds)))
      ]);

      // 4. Process each item in parallel (within tx)
      await Promise.all(items.map(async (item) => {
        if (item.quantity <= 0) return;

        const rxItem = existingRxItems.find(i => i.id === item.prescriptionItemId);
        if (!rxItem) throw new Error(`Prescription item not found: ${item.prescriptionItemId}`);

        const med = existingMeds.find(m => m.id === item.medicationId);
        if (!med) throw new Error(`Medication not found: ${item.medicationId}`);
        
        if (med.stockCount < item.quantity) {
          throw new Error(`Insufficient stock for ${med.nameEn} / ${med.nameAr}. Available: ${med.stockCount}, Requested: ${item.quantity}`);
        }

        // Update stock transactions
        await tx.insert(stockTransactions).values({
          hospitalId,
          medicationId: item.medicationId,
          type: "dispense",
          quantity: -item.quantity,
          notes: `Dispensed for prescription ${prescriptionId}`,
          performedBy: performer.id,
        });

        // Deduct from stock
        await tx
          .update(medications)
          .set({
            stockCount: med.stockCount - item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(medications.id, item.medicationId));

        // Update prescription item
        const newDispensedCount = rxItem.dispensedCount + item.quantity;
        await tx
          .update(prescriptionItems)
          .set({
            dispensedCount: newDispensedCount,
            status: "dispensed",
          })
          .where(eq(prescriptionItems.id, item.prescriptionItemId));
      }));

      // 5. Check if all items in prescription are completed/dispensed
      const allItems = await tx
        .select()
        .from(prescriptionItems)
        .where(eq(prescriptionItems.prescriptionId, prescriptionId));

      const allCompleted = allItems.every(i => i.status === "dispensed" || i.status === "cancelled");
      if (allCompleted) {
        await tx
          .update(prescriptions)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(prescriptions.id, prescriptionId));
      }

      return { success: true };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/pharmacy`, "layout");
    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/pharmacy/dispense`, "layout");
    return result;
  } catch (error: any) {
    console.error("[DISPENSE_PHARMACY_ERROR]", error);
    return { success: false, error: error.message || "Failed to dispense" };
  }
}

