"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { labTests, labOrders, labOrderItems } from "@db/schema/laboratory";
import { staff, hospitals } from "@db/schema/core";
import { admissions } from "@db/schema/clinical";
import { eq, and, sql, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

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

      // 2. Check for active admission
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

      // 2. Update each item
      for (const item of data.items) {
        await tx
          .update(labOrderItems)
          .set({
            resultValue: item.resultValue,
            isCritical: item.isCritical,
            status: "completed",
            resultRecordedBy: recorder.id,
            resultRecordedAt: new Date(),
            notes: item.notes || null,
          })
          .where(and(eq(labOrderItems.id, item.itemId), eq(labOrderItems.hospitalId, hospitalId)));

        // 3. Trigger Critical Alert if item is critical
        if (item.isCritical) {
          const [orderInfo] = await tx
            .select({ patientId: labOrders.patientId, doctorId: labOrders.doctorId })
            .from(labOrders)
            .innerJoin(labOrderItems, eq(labOrders.id, labOrderItems.labOrderId))
            .where(eq(labOrderItems.id, item.itemId))
            .limit(1);

          if (orderInfo) {
            await tx.insert(criticalValueAlerts).values({
              hospitalId,
              labOrderItemId: item.itemId,
              patientId: orderInfo.patientId,
              notifiedDoctorId: orderInfo.doctorId,
              method: "in_app",
              notes: `Critical value recorded: ${item.resultValue}`,
            });
          }
        }
      }

      // 4. Check if all items are completed to mark order as completed
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
        .where(and(eq(criticalValueAlerts.id, alertId), eq(criticalValueAlerts.hospitalId, hospitalId)));

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
