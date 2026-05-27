"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { radiologyOrders, radiologyReports } from "@db/schema/radiology";
import { patients } from "@db/schema/patients";
import { staff } from "@db/schema/core";
import { notifications } from "@db/schema/system";
import { users } from "@db/schema/auth";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

/**
 * Retrieves the queue of radiology orders for the hospital.
 */
export async function getRadiologyQueueAction(statusFilter?: string) {
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
      const query = tx
        .select({
          id: radiologyOrders.id,
          procedureNameAr: radiologyOrders.procedureNameAr,
          procedureNameEn: radiologyOrders.procedureNameEn,
          cptCode: radiologyOrders.cptCode,
          priority: radiologyOrders.priority,
          status: radiologyOrders.status,
          clinicalNotes: radiologyOrders.clinicalNotes,
          createdAt: radiologyOrders.createdAt,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientDob: patients.dob,
          patientGender: patients.gender,
          patientNumber: patients.patientNumber,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          isCritical: radiologyReports.isCritical,
          findingsAr: radiologyReports.findingsAr,
          findingsEn: radiologyReports.findingsEn,
          impressionAr: radiologyReports.impressionAr,
          impressionEn: radiologyReports.impressionEn,
          imageUrl: radiologyReports.imageUrl,
        })
        .from(radiologyOrders)
        .leftJoin(patients, eq(radiologyOrders.patientId, patients.id))
        .leftJoin(staff, eq(radiologyOrders.doctorId, staff.id))
        .leftJoin(radiologyReports, eq(radiologyOrders.id, radiologyReports.radiologyOrderId));

      if (statusFilter && statusFilter !== "all") {
        return await query
          .where(and(eq(radiologyOrders.status, statusFilter)))
          .orderBy(desc(radiologyOrders.createdAt));
      }

      return await query.orderBy(desc(radiologyOrders.createdAt));
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[GET_RADIOLOGY_QUEUE_ERROR]", error);
    return { success: false, error: "فشل استرداد قائمة طلبات الأشعة." };
  }
}

interface ReportInput {
  orderId: string;
  findingsAr: string;
  findingsEn: string;
  impressionAr: string;
  impressionEn: string;
  imageUrl?: string;
  isCritical?: boolean;
}

/**
 * Submits the radiology report for an order, completing it.
 */
export async function submitRadiologyReportAction(input: ReportInput) {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط.");
  }

  const radiologistId = session.user.id;

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Fetch the order details
      const [order] = await tx
        .select({
          patientId: radiologyOrders.patientId,
          doctorId: radiologyOrders.doctorId,
          procedureNameAr: radiologyOrders.procedureNameAr,
          procedureNameEn: radiologyOrders.procedureNameEn,
        })
        .from(radiologyOrders)
        .where(eq(radiologyOrders.id, input.orderId));

      if (!order) {
        throw new Error("Order not found");
      }

      // 2. Create the radiology report
      const [newReport] = await tx
        .insert(radiologyReports)
        .values({
          hospitalId,
          radiologyOrderId: input.orderId,
          patientId: order.patientId,
          radiologistId,
          findingsAr: input.findingsAr.trim(),
          findingsEn: input.findingsEn.trim(),
          impressionAr: input.impressionAr.trim(),
          impressionEn: input.impressionEn.trim(),
          imageUrl: input.imageUrl?.trim() || null,
          isCritical: input.isCritical || false,
        })
        .returning();

      // 3. Update the order status to completed
      await tx
        .update(radiologyOrders)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(radiologyOrders.id, input.orderId));

      // 4. If critical value flag is true, trigger alerts
      if (input.isCritical) {
        // Fetch doctor's auth user ID (user_id) if linked
        const [doc] = await tx
          .select({
            userId: staff.userId,
            nameAr: staff.nameAr,
            nameEn: staff.nameEn,
          })
          .from(staff)
          .where(eq(staff.id, order.doctorId));

        if (doc && doc.userId) {
          // Insert alert notification for doctor
          await tx.insert(notifications).values({
            hospitalId,
            userId: doc.userId,
            titleAr: "🚨 نتيجة فحص حرجة / عاجلة",
            titleEn: "🚨 Critical Radiology Value Alert",
            messageAr: `تم تسجيل نتيجة حرجة لفحص الأشعة (${order.procedureNameAr}) للمريض. يرجى مراجعة التقرير فوراً.`,
            messageEn: `A critical radiology result was reported for (${order.procedureNameEn}). Please review the report immediately.`,
            type: "critical",
            isRead: false,
          });
        }
      }

      return newReport;
    });

    revalidatePath(`/[locale]/${hospitalId}/radiology`, "page");
    return { success: true, data: result };
  } catch (error) {
    console.error("[SUBMIT_RADIOLOGY_REPORT_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: "فشل تقديم تقرير الأشعة: " + message };
  }
}
