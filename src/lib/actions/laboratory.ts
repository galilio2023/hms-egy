"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { labTests, labOrders, labOrderItems, criticalValueAlerts } from "@db/schema/laboratory";
import { staff, hospitals } from "@db/schema/core";
import { admissions } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { eq, and, sql, ilike, or, ne, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { latinizeNumerals } from "@/lib/utils/egypt";

/**
 * Searches for lab tests in the hospital's catalog.
 */
export async function searchLabTests(query: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "No hospital context" };

  try {
    const results = await withTenantContext(hospitalId, async (tx) => {
      return await tx
        .select()
        .from(labTests)
        .where(
          and(
            eq(labTests.hospitalId, hospitalId),
            eq(labTests.isActive, true),
            or(
              ilike(labTests.nameEn, `%${query}%`),
              ilike(labTests.nameAr, `%${query}%`),
              ilike(labTests.loincCode, `%${query}%`)
            )
          )
        )
        .limit(20);
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[LAB_ACTION] searchLabTests error:", error);
    return { success: false, error: "Search failed" };
  }
}

interface CreateLabOrderInput {
  patientId: string;
  testIds: string[];
  priority: "routine" | "urgent" | "stat";
  clinicalNotes?: string;
}

/**
 * Creates a new lab order with multiple test items.
 */
export async function createLabOrder(data: CreateLabOrderInput) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "No hospital context" };

  if (data.testIds.length === 0) {
    return { success: false, error: "At least one test must be selected" };
  }

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve Doctor (Staff) ID
      const doctor = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!doctor) {
        throw new AppError(ErrorCode.NOT_FOUND, "Staff profile not found");
      }

      // 2. BOLA Protection: Verify patient belongs to this hospital tenant
      const [patientRecord] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, data.patientId), eq(patients.hospitalId, hospitalId)))
        .limit(1);

      if (!patientRecord) {
        throw new AppError(ErrorCode.NOT_FOUND, "Patient not found in this hospital context");
      }

      // 3. Check for active admission
      const activeAdmission = await tx
        .select({ id: admissions.id })
        .from(admissions)
        .where(
          and(
            eq(admissions.patientId, data.patientId),
            eq(admissions.hospitalId, hospitalId),
            eq(admissions.status, "active")
          )
        )
        .limit(1)
        .then((res) => res[0]);

      // 3. Create Lab Order
      const [newOrder] = await tx
        .insert(labOrders)
        .values({
          hospitalId,
          patientId: data.patientId,
          doctorId: doctor.id,
          admissionId: activeAdmission?.id || null,
          priority: data.priority,
          status: "pending",
          clinicalNotes: data.clinicalNotes || null,
        })
        .returning();

      if (!newOrder) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create lab order");
      }

      // 4. Create Lab Order Items
      const itemsToInsert = data.testIds.map((testId) => ({
        hospitalId,
        labOrderId: newOrder.id,
        labTestId: testId,
        status: "pending",
        isCritical: false,
      }));

      await tx.insert(labOrderItems).values(itemsToInsert);

      // Trigger out-of-band notification for STAT orders
      if (data.priority === "stat") {
        // TODO: Integrate with local SMS/WhatsApp provider (e.g. CEQUENS, VictoryLink)
        console.log(`[OUT-OF-BAND] Trigger STAT alert for patient ${data.patientId}`);
      }

      // Fetch hospital slug for revalidation
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      return {
        success: true,
        orderId: newOrder.id,
        patientId: data.patientId,
        hospitalSlug: hospital?.slug || hospitalId,
      };
    });

    if (result.success) {
      revalidatePath(`/[locale]/${result.hospitalSlug}/laboratory`, "page");
      revalidatePath(`/[locale]/${result.hospitalSlug}/patients/${result.patientId}`, "page");
    }

    return result;
  } catch (error) {
    console.error("[LAB_ACTION] createLabOrder error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Fetches full details of a lab order including items and patient info.
 */
export async function getLabOrderDetails(orderId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "No hospital context" };

  try {
    const data = await withTenantContext(hospitalId, async (tx) => {
      const order = await tx
        .select({
          id: labOrders.id,
          status: labOrders.status,
          priority: labOrders.priority,
          clinicalNotes: labOrders.clinicalNotes,
          createdAt: labOrders.createdAt,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          doctorId: staff.id,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(labOrders)
        .innerJoin(patients, eq(labOrders.patientId, patients.id))
        .innerJoin(staff, eq(labOrders.doctorId, staff.id))
        .where(and(eq(labOrders.id, orderId), eq(labOrders.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!order) return null;

      const items = await tx
        .select({
          id: labOrderItems.id,
          status: labOrderItems.status,
          resultValue: labOrderItems.resultValue,
          isCritical: labOrderItems.isCritical,
          notes: labOrderItems.notes,
          testId: labTests.id,
          testNameAr: labTests.nameAr,
          testNameEn: labTests.nameEn,
          loincCode: labTests.loincCode,
          unit: labTests.unit,
          normalRange: labTests.normalRange,
        })
        .from(labOrderItems)
        .innerJoin(labTests, eq(labOrderItems.labTestId, labTests.id))
        .where(eq(labOrderItems.labOrderId, orderId));

      return { order, items };
    });

    if (!data) return { success: false, error: "Order not found" };
    return { success: true, data };
  } catch (error) {
    console.error("[LAB_ACTION] getLabOrderDetails error:", error);
    return { success: false, error: "Failed to fetch order details" };
  }
}

interface SaveLabResultInput {
  orderId: string;
  items: {
    itemId: string;
    resultValue: string;
    isCritical: boolean;
    notes?: string;
  }[];
}

/**
 * Saves results for a lab order and triggers critical alerts if necessary.
 */
export async function saveLabResults(data: SaveLabResultInput) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "No hospital context" };

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve Staff ID
      const recorder = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!recorder) throw new Error("Recorder staff profile not found");

      // 2. Fetch order metadata once to avoid N+1 queries for critical alerts
      // Also strictly validates that the order belongs to the current hospital context (Multi-Tenancy Hardening)
      const orderMeta = await tx
        .select({ patientId: labOrders.patientId, doctorId: labOrders.doctorId })
        .from(labOrders)
        .where(and(
          eq(labOrders.id, data.orderId), 
          eq(labOrders.hospitalId, hospitalId)
        ))
        .limit(1)
        .then((res) => res[0]);

      if (!orderMeta) {
        throw new AppError(ErrorCode.NOT_FOUND, "Lab order not found or access denied.");
      }

      // 3. Pre-fetch lab test specifications for automatic criticality detection
      const allOriginalItems = await tx
        .select({
          itemId: labOrderItems.id,
          testId: labOrderItems.labTestId,
          criticalLow: labTests.criticalLow,
          criticalHigh: labTests.criticalHigh,
        })
        .from(labOrderItems)
        .innerJoin(labTests, eq(labOrderItems.labTestId, labTests.id))
        .where(eq(labOrderItems.labOrderId, data.orderId));

      // 4. Process all items and prepare database operations
      const updatePromises = data.items.map(async (item) => {
        const specs = allOriginalItems.find(oi => oi.itemId === item.itemId);
        let finalIsCritical = item.isCritical; // Manual override from UI

        // Automatic Server-Side Criticality Detection (Patient Safety Fix)
        if (specs && item.resultValue) {
          const cleanValue = (item.resultValue || "").trim();
          
          if (cleanValue) {
            // Pattern: Optional relational op (<, >, <=, >=) followed by numeric
            const relationalMatch = cleanValue.match(/^([<>=]+)?\s*(.+)$/);
            const operator = relationalMatch?.[1];
            const numericPart = relationalMatch?.[2] || "";
            
            // Normalize Eastern Arabic/Persian numerals
            const normalizedInput = latinizeNumerals(numericPart).replace(/[،,٫]/g, ".");

            const numericMatch = normalizedInput.trim().match(/^([+-]?\d+(?:\.\d+)?)/);
            const normalizedNumericPart = numericMatch ? numericMatch[1] : "";

            const isStrictlyNumeric = normalizedNumericPart !== "";
            const numericValue = isStrictlyNumeric ? parseFloat(normalizedNumericPart) : null;

            if (numericValue !== null) {
              const scaledVal = Math.round(numericValue * 1000);
              const lowVal = (specs.criticalLow !== null && specs.criticalLow !== undefined) 
                ? Math.round(parseFloat(specs.criticalLow) * 1000) 
                : null;
              const highVal = (specs.criticalHigh !== null && specs.criticalHigh !== undefined) 
                ? Math.round(parseFloat(specs.criticalHigh) * 1000) 
                : null;
              
              if (operator === ">" || operator === ">=") {
                 if (highVal !== null && scaledVal >= highVal) finalIsCritical = true;
              } else if (operator === "<" || operator === "<=") {
                 if (lowVal !== null && scaledVal <= lowVal) finalIsCritical = true;
              } else {
                 if ((lowVal !== null && scaledVal <= lowVal) || (highVal !== null && scaledVal >= highVal)) {
                   finalIsCritical = true;
                 }
              }
            } else {
              const qualitativeLower = cleanValue.toLowerCase();
              const negations = ["not", "non", "un", "no", "غير", "لا", "سلبي", "negative"];
              const hasNegation = negations.some(neg => qualitativeLower.includes(neg));
              const criticalKeywords = ["positive", "reactive", "detected", "إيجابي", "نشط", "ايجابي"];

              if (!hasNegation && criticalKeywords.some(keyword => qualitativeLower.includes(keyword))) {
                finalIsCritical = true;
              }
            }
          }
        }

        // Perform the update
        await tx
          .update(labOrderItems)
          .set({
            resultValue: item.resultValue,
            isCritical: finalIsCritical,
            status: "completed",
            resultRecordedBy: recorder.id,
            resultRecordedAt: new Date(),
            notes: item.notes || null,
          })
          .where(and(eq(labOrderItems.id, item.itemId), eq(labOrderItems.hospitalId, hospitalId)));

        // 5. Trigger Critical Alert if item is critical
        if (finalIsCritical) {
          await tx.insert(criticalValueAlerts).values({
            hospitalId,
            labOrderItemId: item.itemId,
            patientId: orderMeta.patientId,
            notifiedDoctorId: orderMeta.doctorId,
            method: "in_app",
            notes: `Critical value recorded: ${item.resultValue}`,
          });

          // TODO: Trigger emergency out-of-band alert (SMS/WhatsApp)
          console.log(`[OUT-OF-BAND] Emergency critical value alert for doctor ${orderMeta.doctorId}`);
        }
      });

      // Execute all updates in parallel to eliminate N+1 roundtrips
      await Promise.all(updatePromises);

      // 6. Check if all items are completed to mark order as completed
      const remainingItems = await tx
        .select()
        .from(labOrderItems)
        .where(
          and(
            eq(labOrderItems.labOrderId, data.orderId),
            ne(labOrderItems.status, "completed")
          )
        );

      if (remainingItems.length === 0) {
        await tx
          .update(labOrders)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(labOrders.id, data.orderId));
      } else {
        await tx
          .update(labOrders)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(labOrders.id, data.orderId));
      }

      // Fetch hospital slug for revalidation
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      return {
        success: true,
        hospitalSlug: hospital?.slug || hospitalId,
      };
    });

    if (result.success) {
      revalidatePath(`/[locale]/${result.hospitalSlug}/laboratory`, "page");
    }

    return result;
  } catch (error) {
    console.error("[LAB_ACTION] saveLabResults error:", error);
    return { success: false, error: "Failed to save results" };
  }
}

/**
 * Acknowledges a critical value alert by a physician.
 */
export async function acknowledgeCriticalAlert(alertId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "No hospital context" };

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve Staff ID
      const doctor = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!doctor) throw new Error("Doctor staff profile not found");

      await tx
        .update(criticalValueAlerts)
        .set({
          acknowledgedByDoctor: true,
          acknowledgedAt: new Date(),
        })
        .where(
          and(
            eq(criticalValueAlerts.id, alertId),
            eq(criticalValueAlerts.notifiedDoctorId, doctor.id), // Enforce ownership
            eq(criticalValueAlerts.hospitalId, hospitalId)
          )
        );

      // Fetch hospital slug for revalidation
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      return {
        success: true,
        hospitalSlug: hospital?.slug || hospitalId,
      };
    });

    if (result.success) {
      revalidatePath(`/[locale]/${result.hospitalSlug}/laboratory`, "page");
    }

    return result;
  } catch (error) {
    console.error("[LAB_ACTION] acknowledgeCriticalAlert error:", error);
    return { success: false, error: "Failed to acknowledge alert" };
  }
}
