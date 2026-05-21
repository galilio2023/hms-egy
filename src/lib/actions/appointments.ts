"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { appointments, waitingList } from "@db/schema/clinical";
import { staff, departments } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { and, eq, ne, gte, lte, or, sql, desc } from "drizzle-orm";
import { appointmentSchema, type AppointmentSchema } from "@/lib/validations/appointment.schema";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { revalidatePath } from "next/cache";

// Helper: Formats a Date object's time to "HH:MM:SS"
function formatTimeStr(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

// Helper: Check if two time intervals overlap
function doTimesOverlap(start1: string, end1: string, start2: string, end2: string) {
  return start1 < end2 && start2 < end1;
}

/**
 * Creates a new clinical appointment scoped strictly inside the active hospital context.
 */
export async function createAppointment(data: AppointmentSchema) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const isAuthorized = hasPermission(session.user as any, "appointments:create", {
    hospitalId: session.user.hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to book appointments." };
  }

  const validated = appointmentSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: "بيانات الموعد غير صالحة. يرجى مراجعة المدخلات.",
      details: validated.error.format(),
    };
  }

  const validatedData = validated.data;
  const hospitalId = session.user.hospitalId;

  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context is missing." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const scheduledAt = new Date(validatedData.scheduledAt);
      
      // Normalize date to midnight (Y-M-D) to support clean index matching
      const scheduledDate = new Date(
        scheduledAt.getFullYear(),
        scheduledAt.getMonth(),
        scheduledAt.getDate(),
        0, 0, 0, 0
      );

      const startTime = formatTimeStr(scheduledAt);
      
      // Appointments default to a high-density 30-minute block duration
      const durationMs = 30 * 60 * 1000;
      const endAt = new Date(scheduledAt.getTime() + durationMs);
      const endTime = formatTimeStr(endAt);

      // 1. Verify doctor availability & check scheduling overlaps
      const doctorSchedules = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.hospitalId, hospitalId),
            eq(appointments.doctorId, validatedData.doctorId),
            eq(appointments.scheduledDate, scheduledDate),
            ne(appointments.status, "cancelled")
          )
        );

      for (const app of doctorSchedules) {
        if (doTimesOverlap(startTime, endTime, app.startTime, app.endTime)) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "عذراً، هذا الطبيب لديه موعد آخر مسجل في نفس هذا الوقت المتداخل."
          );
        }
      }

      // 2. Prevent patient double booking inside the same clinic/department on the same day
      const patientSchedules = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.hospitalId, hospitalId),
            eq(appointments.patientId, validatedData.patientId),
            eq(appointments.departmentId, validatedData.departmentId),
            eq(appointments.scheduledDate, scheduledDate),
            ne(appointments.status, "cancelled")
          )
        )
        .limit(1);

      if (patientSchedules.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "المريض لديه بالفعل حجز موعد مسجل في هذا القسم لنفس اليوم."
        );
      }

      // 3. Insert new appointment
      const [newApp] = await tx
        .insert(appointments)
        .values({
          hospitalId,
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          departmentId: validatedData.departmentId,
          scheduledDate,
          startTime,
          endTime,
          type: validatedData.type,
          status: "scheduled",
          notes: validatedData.notes || null,
        })
        .returning();

      if (!newApp) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "فشل حفظ بيانات الموعد الجديد.");
      }

      revalidatePath(`/[locale]/${hospitalId}/appointments`, "page");
      return { success: true, appointmentId: newApp.id };
    });
  } catch (error: any) {
    console.error("[APPOINTMENTS_ACTION] createAppointment failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "حدث خطأ غير متوقع أثناء حجز الموعد. يرجى المحاولة لاحقاً." };
  }
}

/**
 * Updates an appointment's clinical status (scheduled -> completed, cancelled, no_show).
 */
export async function updateAppointmentStatus(id: string, status: string, cancellationReason?: string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const isAuthorized = hasPermission(session.user as any, "appointments:edit", {
    hospitalId: session.user.hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to edit appointments." };
  }

  const hospitalId = session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context missing." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const [updated] = await tx
        .update(appointments)
        .set({
          status: status as any,
          cancellationReason: cancellationReason || null,
          updatedAt: new Date(),
        })
        .where(and(eq(appointments.id, id), eq(appointments.hospitalId, hospitalId)))
        .returning();

      if (!updated) {
        throw new AppError(ErrorCode.NOT_FOUND, "الموعد المطلوب غير موجود.");
      }

      revalidatePath(`/[locale]/${hospitalId}/appointments`, "page");
      return { success: true };
    });
  } catch (error: any) {
    console.error("[APPOINTMENTS_ACTION] updateAppointmentStatus failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "فشل تحديث حالة الموعد." };
  }
}

/**
 * Computes standard 30-minute interval slots for a given doctor and date, 
 * returning availability stats (e.g. 09:00 to 17:00).
 */
export async function getDoctorAvailability(doctorId: string, date: Date | string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const hospitalId = session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Hospital context missing" };
  }

  const targetDate = new Date(date);
  const normalizedDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0, 0, 0, 0
  );

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Fetch doctor standard working details
      const [doctor] = await tx
        .select({ id: staff.id, nameAr: staff.nameAr, nameEn: staff.nameEn })
        .from(staff)
        .where(and(eq(staff.id, doctorId), eq(staff.hospitalId, hospitalId)))
        .limit(1);

      if (!doctor) {
        return { success: false, error: "Doctor not found" };
      }

      // 2. Fetch existing appointments for the day
      const existing = await tx
        .select({ startTime: appointments.startTime, endTime: appointments.endTime })
        .from(appointments)
        .where(
          and(
            eq(appointments.hospitalId, hospitalId),
            eq(appointments.doctorId, doctorId),
            eq(appointments.scheduledDate, normalizedDate),
            ne(appointments.status, "cancelled")
          )
        );

      // Standard clinic operational hours: 09:00 to 17:00 (Egypt Standard Time)
      const slots: { time: string; available: boolean }[] = [];
      const startHour = 9;
      const endHour = 17;

      for (let hour = startHour; hour < endHour; hour++) {
        for (const minutes of ["00", "30"]) {
          const slotTime = `${String(hour).padStart(2, "0")}:${minutes}:00`;
          
          // Compute slot end time (30 mins block duration)
          let endH = hour;
          let endM = "30";
          if (minutes === "30") {
            endH = hour + 1;
            endM = "00";
          }
          const slotEndTime = `${String(endH).padStart(2, "0")}:${endM}:00`;

          // Check if this slot overlaps with any booked schedule
          const isOverlapping = existing.some((app) => 
            doTimesOverlap(slotTime, slotEndTime, app.startTime, app.endTime)
          );

          // Standard buffer: Can only book future slots if target date is today
          const now = new Date();
          let isFuture = true;
          if (targetDate.toDateString() === now.toDateString()) {
            const [sh, sm] = slotTime.split(":").map(Number);
            const slotDateTime = new Date(targetDate);
            slotDateTime.setHours(sh, sm, 0, 0);
            isFuture = slotDateTime.getTime() > now.getTime();
          }

          slots.push({
            time: `${String(hour).padStart(2, "0")}:${minutes}`,
            available: !isOverlapping && isFuture,
          });
        }
      }

      return { success: true, slots };
    });
  } catch (error) {
    console.error("[APPOINTMENTS_ACTION] getDoctorAvailability failed:", error);
    return { success: false, error: "فشل استرداد مواعيد عمل الطبيب المتاحة." };
  }
}

/**
 * Retrieves the hospital's active waiting list queue, scoped securely per clinic.
 */
export async function getWaitingList(departmentId?: string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const hospitalId = session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Hospital context missing" };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const queryFilters = [
        eq(waitingList.hospitalId, hospitalId),
        eq(waitingList.status, "active"),
      ];

      if (departmentId && departmentId !== "") {
        queryFilters.push(eq(waitingList.departmentId, departmentId));
      }

      const results = await tx
        .select({
          id: waitingList.id,
          priority: waitingList.priority,
          notes: waitingList.notes,
          createdAt: waitingList.createdAt,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          patientPhone: patients.contactPhone,
          departmentId: departments.id,
          departmentNameAr: departments.nameAr,
          departmentNameEn: departments.nameEn,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(waitingList)
        .innerJoin(patients, eq(waitingList.patientId, patients.id))
        .innerJoin(departments, eq(waitingList.departmentId, departments.id))
        .leftJoin(staff, eq(waitingList.preferredDoctorId, staff.id))
        .where(and(...queryFilters))
        .orderBy(desc(waitingList.createdAt));

      return { success: true, data: results };
    });
  } catch (error) {
    console.error("[APPOINTMENTS_ACTION] getWaitingList failed:", error);
    return { success: false, error: "فشل استرداد قوائم الانتظار." };
  }
}

/**
 * Pushes a patient registration into the waiting list queue.
 */
export async function addToWaitingList(data: {
  patientId: string;
  departmentId: string;
  preferredDoctorId?: string;
  priority?: "routine" | "urgent" | "emergency";
  notes?: string;
}) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const hospitalId = session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Hospital context missing" };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const [newEntry] = await tx
        .insert(waitingList)
        .values({
          hospitalId,
          patientId: data.patientId,
          departmentId: data.departmentId,
          preferredDoctorId: data.preferredDoctorId || null,
          priority: data.priority || "routine",
          status: "active",
          notes: data.notes || null,
        })
        .returning();

      if (!newEntry) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "فشل إضافة المريض لقائمة الانتظار.");
      }

      revalidatePath(`/[locale]/${hospitalId}/appointments`, "page");
      return { success: true, id: newEntry.id };
    });
  } catch (error: any) {
    console.error("[APPOINTMENTS_ACTION] addToWaitingList failed:", error);
    return { success: false, error: "حدث خطأ غير متوقع أثناء الإضافة لقائمة الانتظار." };
  }
}

/**
 * Converts a waiting list queue record into an official scheduled appointment, 
 * resolving and closing out the waiting entry within a transaction.
 */
export async function scheduleFromWaitingList(waitingListId: string, appointmentDetails: AppointmentSchema) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const hospitalId = session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Hospital context missing" };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Schedule appointment using createAppointment context logic
      const schedRes = await createAppointment(appointmentDetails);
      if (!schedRes.success || !("appointmentId" in schedRes)) {
        return schedRes; // return error directly (overlaps, etc.)
      }

      // 2. Mark the waiting list record as successfully scheduled
      await tx
        .update(waitingList)
        .set({ status: "scheduled" })
        .where(and(eq(waitingList.id, waitingListId), eq(waitingList.hospitalId, hospitalId)));

      revalidatePath(`/[locale]/${hospitalId}/appointments`, "page");
      return { success: true, appointmentId: schedRes.appointmentId };
    });
  } catch (error) {
    console.error("[APPOINTMENTS_ACTION] scheduleFromWaitingList failed:", error);
    return { success: false, error: "فشل جدولة الموعد من قائمة الانتظار." };
  }
}
