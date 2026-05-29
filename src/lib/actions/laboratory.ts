"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { labTests, labOrders, labOrderItems, criticalValueAlerts } from "@db/schema/laboratory";
import { staff, hospitals, hospitalSettings } from "@db/schema/core";
import { admissions, beds, rooms } from "@db/schema/clinical";
import { shifts } from "@db/schema/nursing";
import { patients } from "@db/schema/patients";
import { notifications, backgroundJobs } from "@db/schema/system";
import { eq, and, sql, ilike, or, ne, inArray, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendResilientClinicalAlert } from "@/lib/sms/client";
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
        .select({ 
          patientId: labOrders.patientId, 
          doctorId: labOrders.doctorId,
          doctorUserId: staff.userId
        })
        .from(labOrders)
        .innerJoin(staff, eq(labOrders.doctorId, staff.id))
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
      const criticalItemIds: string[] = [];

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
          criticalItemIds.push(item.itemId);

          await tx.insert(criticalValueAlerts).values({
            hospitalId,
            labOrderItemId: item.itemId,
            patientId: orderMeta.patientId,
            notifiedDoctorId: orderMeta.doctorId,
            method: "in_app",
            notes: `Critical value recorded: ${item.resultValue}`,
          });

          // Also trigger in-app notification for the ordering physician
          if (orderMeta.doctorUserId) {
            await tx.insert(notifications).values({
              hospitalId,
              userId: orderMeta.doctorUserId,
              titleAr: "🚨 قيمة حرجة لنتائج المختبر",
              titleEn: "🚨 Critical Lab Result Alert",
              messageAr: `تم تسجيل قيمة حرجة لنتائج مختبر المريض. القيمة: ${item.resultValue}`,
              messageEn: `A critical lab value has been recorded for your patient. Value: ${item.resultValue}`,
              type: "error",
              isRead: false,
            });
          }
        }
      });

      // Execute all updates in parallel to eliminate N+1 roundtrips
      await Promise.all(updatePromises);

      // Trigger grouped out-of-band alerts for all critical items in this submission
      if (criticalItemIds.length > 0) {
        // Resolve safety strings for "baked-in" job metadata as per clinical safety requirements
        const [patientData] = await tx
          .select({ nameAr: patients.nameAr, nameEn: patients.nameEn })
          .from(patients)
          .where(eq(patients.id, orderMeta.patientId));

        const [doctorData] = await tx
          .select({ nameAr: staff.nameAr, nameEn: staff.nameEn, phone: staff.phone })
          .from(staff)
          .where(eq(staff.id, orderMeta.doctorId));

        const bakedPayload = {
          orderId: data.orderId,
          criticalItemIds: criticalItemIds,
          patientNameAr: patientData?.nameAr,
          patientNameEn: patientData?.nameEn,
          doctorNameAr: doctorData?.nameAr,
          doctorNameEn: doctorData?.nameEn,
          doctorPhone: doctorData?.phone,
        };

        // A. Queue the job in the database first to ensure survivability
        const [job] = await tx.insert(backgroundJobs).values({
          hospitalId,
          jobType: "critical_lab_alert",
          payload: bakedPayload,
          status: "pending",
        }).returning();

        // B. Schedule an escalation job for 10 minutes from now (Safety Check)
        await tx.insert(backgroundJobs).values({
          hospitalId,
          jobType: "escalate_critical_lab_alert",
          payload: bakedPayload,
          status: "pending",
          runAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minute window for physician acknowledgment
        });

        after(() => {
          withTenantContext(hospitalId, async (tx) => {
            try {
              await tx.update(backgroundJobs)
                .set({ status: "processing", attempts: sql`${backgroundJobs.attempts} + 1`, updatedAt: new Date() })
                .where(eq(backgroundJobs.id, job.id));

              await dispatchCriticalLabAlerts(hospitalId, bakedPayload, tx);

              await tx.update(backgroundJobs)
                .set({ status: "completed", updatedAt: new Date() })
                .where(eq(backgroundJobs.id, job.id));
            } catch (err) {
              console.error("[CRITICAL LAB ALERT GATEWAY] Asynchronous alert dispatch failed:", err);
              await tx.update(backgroundJobs)
                .set({
                  status: "failed",
                  lastError: err instanceof Error ? err.message : String(err),
                  updatedAt: new Date()
                })
                .where(eq(backgroundJobs.id, job.id));
            }
          }).catch((err) => console.error("[TENANT CONTEXT] Failed to establish background context for lab alerts:", err));
        });
      }

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
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: "Failed to save results: " + message };
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

/**
 * Helper to dispatch critical laboratory alerts with serverless execution guarantee.
 * Aggregates all critical findings in a single submission for a specific order.
 */
async function dispatchCriticalLabAlerts(
  hospitalId: string,
  payload: {
    orderId: string;
    criticalItemIds: string[];
    patientNameAr?: string;
    patientNameEn?: string;
    doctorNameAr?: string;
    doctorNameEn?: string;
    doctorPhone?: string;
  },
  tx: Parameters<Parameters<typeof withTenantContext>[1]>[0]
) {
  const { orderId, criticalItemIds } = payload;
  try {
    // 0. Fetch hospital settings for WhatsApp template verification
    const settings = await tx
      .select({ approvedWhatsappTemplates: hospitalSettings.approvedWhatsappTemplates })
      .from(hospitalSettings)
      .where(eq(hospitalSettings.hospitalId, hospitalId))
      .limit(1)
      .then((res) => res[0]);

    const isWhatsAppApproved = settings?.approvedWhatsappTemplates?.includes("critical_lab_result_alert");

    // 1. Fetch Order Metadata (Patient & Admission link only, names are in payload)
    const orderData = await tx
      .select({
        patientId: labOrders.patientId,
        admissionId: labOrders.admissionId,
        departmentId: admissions.departmentId,
      })
      .from(labOrders)
      .leftJoin(admissions, eq(labOrders.admissionId, admissions.id))
      .where(and(
        eq(labOrders.id, orderId),
        eq(labOrders.hospitalId, hospitalId)
      ))
      .limit(1)
      .then((res) => res[0]);

    if (!orderData) return;

    // 2. Resolve Patient Location (Safety Fix for Ward Awareness)
    let locationEn = "Outpatient / General";
    let locationAr = "عيادة خارجية / عام";

    if (orderData.admissionId) {
      const locData = await tx
        .select({
          roomNumber: rooms.roomNumber,
          bedNumber: beds.bedNumber,
        })
        .from(admissions)
        .leftJoin(beds, eq(admissions.bedId, beds.id))
        .leftJoin(rooms, eq(beds.roomId, rooms.id))
        .where(eq(admissions.id, orderData.admissionId))
        .limit(1)
        .then((res) => res[0]);

      if (locData) {
        locationEn = `Room ${locData.roomNumber}, Bed ${locData.bedNumber}`;
        locationAr = `غرفة ${locData.roomNumber}، سرير ${locData.bedNumber}`;
      }
    }

    // 3. Fetch all critical item details for this batch
    const items = await tx
      .select({
        testNameAr: labTests.nameAr,
        testNameEn: labTests.nameEn,
        resultValue: labOrderItems.resultValue,
        normalRange: labTests.normalRange,
      })
      .from(labOrderItems)
      .innerJoin(labTests, eq(labOrderItems.labTestId, labTests.id))
      .where(inArray(labOrderItems.id, criticalItemIds));

    if (items.length === 0) return;

    // 4. Construct Aggregated Payload
    const findingsEn = items.map(i => `${i.testNameEn}: ${i.resultValue} (Ref: ${i.normalRange || "N/A"})`).join(", ");
    const findingsAr = items.map(i => `${i.testNameAr}: ${i.resultValue} (الطبيعي: ${i.normalRange || "غير محدد"})`).join("، ");

    const alertPayloadBase = {
      hospitalId,
      patientId: orderData.patientId,
      reminderType: "CRITICAL_LAB_ALERT",
      entityType: "clinical_alert" as const,
      entityId: orderId,
      approvedWhatsappTemplates: settings?.approvedWhatsappTemplates || [],
    };

    // A. Alert Ordering Physician
    if (payload.doctorPhone) {
      await sendResilientClinicalAlert({
        ...alertPayloadBase,
        phoneNumber: payload.doctorPhone,
        messageAr: `🚨 [تنبيه مخبري حرج] د. ${payload.doctorNameAr || ""}\nالمريض: ${payload.patientNameAr || ""}\nالنتائج: ${findingsAr}\nالموقع: ${locationAr}\nيرجى المراجعة فوراً.`,
        messageEn: `🚨 [CRITICAL LAB ALERT] Dr. ${payload.doctorNameEn || ""}\nPatient: ${payload.patientNameEn || ""}\nResults: ${findingsEn}\nLocation: ${locationEn}\nPlease review immediately.`,
        channelPriority: isWhatsAppApproved ? ["whatsapp", "sms"] : ["sms"],
        whatsappTemplate: isWhatsAppApproved ? {
          name: "critical_lab_result_alert",
          languageCode: "ar",
          parameters: [
            payload.doctorNameAr || "طبيب",
            payload.patientNameAr || "مريض",
            items.map(i => i.testNameAr).join(" - "),
            items.map(i => `${i.resultValue} [${i.normalRange || "N/A"}]`).join(" - "),
            locationAr
          ]
        } : undefined
      });
    }

    // B. Alert Active Ward Nurse Desk (Routing to nurses currently on shift in the patient's department)
    const activeNurses = await tx
      .select({ phone: staff.phone })
      .from(staff)
      .innerJoin(shifts, eq(staff.id, shifts.staffId))
      .where(and(
        eq(staff.hospitalId, hospitalId),
        inArray(staff.role, ["NURSE", "OR_NURSE"]),
        eq(staff.isActive, true),
        eq(shifts.status, "active"),
        isNull(shifts.endTime),
        // If admitted, target nurses in that department, otherwise all active nurses
        orderData.departmentId
          ? eq(shifts.departmentId, orderData.departmentId)
          : sql`true`
      ));

    for (const nurse of activeNurses) {
      if (nurse.phone) {
        await sendResilientClinicalAlert({
          ...alertPayloadBase,
          phoneNumber: nurse.phone,
          messageAr: `🚨 [تنبيه تمريض] نتائج مخبرية حرجة للمريض ${payload.patientNameAr || ""}\nالنتائج: ${findingsAr}\nالموقع: ${locationAr}\nتم إبلاغ الطبيب المعالج.`,
          messageEn: `🚨 [NURSING ALERT] Critical lab results for patient ${payload.patientNameEn || ""}\nResults: ${findingsEn}\nLocation: ${locationEn}\nAttending physician has been notified.`,
        });
      }
    }
  } catch (error) {
    console.error("[CRITICAL LAB ALERT GATEWAY] Failed to dispatch out-of-band alerts:", error);
  }
}

/**
 * Worker handler for lab alert escalation.
 * Checks if critical items are acknowledged; if not, alerts the Registrar or Consultant on duty.
 */
export async function processEscalateLabAlert(jobId: string, hospitalId: string) {
  return await withTenantContext(hospitalId, async (tx) => {
    const [job] = await tx
      .select()
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.hospitalId, hospitalId)))
      .limit(1);

    if (!job || job.jobType !== "escalate_critical_lab_alert") return;

    const payload = job.payload as {
      orderId: string;
      criticalItemIds: string[];
      patientNameAr?: string;
      patientNameEn?: string;
    };
    const { orderId, criticalItemIds } = payload;

    // 1. Check for unacknowledged alerts in this batch
    const unacknowledgedAlerts = await tx
      .select()
      .from(criticalValueAlerts)
      .where(and(
        inArray(criticalValueAlerts.labOrderItemId, criticalItemIds),
        eq(criticalValueAlerts.acknowledgedByDoctor, false),
        eq(criticalValueAlerts.hospitalId, hospitalId)
      ));

    if (unacknowledgedAlerts.length === 0) {
      // All alerts acknowledged, no escalation needed
      return;
    }

    // 2. Fetch escalation targets (On-Duty Doctors/Consultants in the same department)
    // We fetch Order Metadata to find the department
    const orderData = await tx
      .select({
        departmentId: admissions.departmentId,
      })
      .from(labOrders)
      .leftJoin(admissions, eq(labOrders.admissionId, admissions.id))
      .where(eq(labOrders.id, orderId))
      .limit(1)
      .then(res => res[0]);

    if (!orderData) return;

    const escalationTargets = await tx
      .select({ phone: staff.phone, nameEn: staff.nameEn })
      .from(staff)
      .innerJoin(shifts, eq(staff.id, shifts.staffId))
      .where(and(
        eq(staff.hospitalId, hospitalId),
        inArray(staff.role, ["DOCTOR", "SURGEON"]), // Escalating to senior clinical staff
        eq(staff.isActive, true),
        eq(shifts.status, "active"),
        isNull(shifts.endTime),
        orderData.departmentId
          ? eq(shifts.departmentId, orderData.departmentId)
          : sql`true`
      ));

    // 3. Dispatch Escalation Alerts
    for (const target of escalationTargets) {
      if (target.phone) {
        await sendResilientClinicalAlert({
          hospitalId,
          phoneNumber: target.phone,
          messageAr: `⚠️ [تصعيد طارئ] نتائج مخبرية حرجة للمريض ${payload.patientNameAr || "غير محدد"} لم يتم استلامها منذ 10 دقائق. يرجى التدخل الفوري.`,
          messageEn: `⚠️ [ESCALATION ALERT] Critical lab results for patient ${payload.patientNameEn || "Unknown"} remain unacknowledged for 10 mins. Immediate clinical review required.`,
          reminderType: "CRITICAL_LAB_ESCALATION",
          entityType: "clinical_alert",
          entityId: orderId,
        });
      }
    }
  });
}
