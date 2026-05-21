"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { surgicalCases, surgicalChecklists } from "@db/schema/surgical";
import { tenantSequenceTracker } from "@db/schema/system";
import { operatingRooms, orBlocks, departments, staff, hospitals } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import { and, eq, ne, gte, lte, or, sql } from "drizzle-orm";
import { surgicalSchema, type SurgicalSchema } from "@/lib/validations/surgical.schema";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { revalidatePath } from "next/cache";
import { toCairoTime } from "@/lib/utils/egypt";
import { formatInTimeZone } from "date-fns-tz";

// Helper: Formats a Date object's time to "HH:MM:SS" strictly in Cairo time
function formatTimeStr(date: Date) {
  return formatInTimeZone(date, "Africa/Cairo", "HH:mm:00");
}

// Helper: Parse HH:MM:SS to minutes from midnight
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Helper: Check if two time intervals overlap
function doTimesOverlap(start1: string, end1: string, start2: string, end2: string) {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// Helper: Add minutes to time string "HH:MM:SS"
function addMinutesToTimeStr(timeStr: string, minutesToAdd: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}:00`;
}

/**
 * Retrieves operating rooms, scheduled blocks, and active surgical cases for a target date.
 */
export async function getOrSchedule(date: Date | string, targetHospitalId?: string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const effectiveHospitalId = targetHospitalId && session.user.role === "SUPER_ADMIN"
    ? targetHospitalId
    : session.user.hospitalId;

  const hospitalId = effectiveHospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context is missing." };
  }

  const targetDate = new Date(date);
  const normalizedDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0, 0, 0, 0
  );

  const dayOfWeek = targetDate.getDay(); // 0 (Sunday) to 6 (Saturday)

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Fetch active operating rooms
      const rooms = await tx
        .select()
        .from(operatingRooms)
        .where(and(eq(operatingRooms.hospitalId, hospitalId), eq(operatingRooms.isActive, true)));

      // 2. Fetch OR blocks active for this day of week
      const blocks = await tx
        .select({
          id: orBlocks.id,
          orRoomId: orBlocks.orRoomId,
          departmentId: orBlocks.departmentId,
          owningDoctorId: orBlocks.owningDoctorId,
          dayOfWeek: orBlocks.dayOfWeek,
          startTime: orBlocks.startTime,
          endTime: orBlocks.endTime,
          blockName: orBlocks.blockName,
          isRecurring: orBlocks.isRecurring,
          effectiveFrom: orBlocks.effectiveFrom,
          effectiveTo: orBlocks.effectiveTo,
          departmentNameAr: departments.nameAr,
          departmentNameEn: departments.nameEn,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(orBlocks)
        .innerJoin(departments, eq(orBlocks.departmentId, departments.id))
        .leftJoin(staff, eq(orBlocks.owningDoctorId, staff.id))
        .where(
          and(
            eq(orBlocks.hospitalId, hospitalId),
            eq(orBlocks.dayOfWeek, dayOfWeek)
          )
        );

      // 3. Fetch scheduled surgical cases on this date
      const cases = await tx
        .select({
          id: surgicalCases.id,
          caseNumber: surgicalCases.caseNumber,
          orRoomId: surgicalCases.orRoomId,
          procedureName: surgicalCases.procedureName,
          procedureNameAr: surgicalCases.procedureNameAr,
          scheduledStartTime: surgicalCases.scheduledStartTime,
          estimatedDurationMinutes: surgicalCases.estimatedDurationMinutes,
          status: surgicalCases.status,
          anesthesiaType: surgicalCases.anesthesiaType,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          surgeonNameAr: staff.nameAr,
          surgeonNameEn: staff.nameEn,
        })
        .from(surgicalCases)
        .innerJoin(patients, eq(surgicalCases.patientId, patients.id))
        .innerJoin(staff, eq(surgicalCases.leadSurgeonId, staff.id))
        .where(
          and(
            eq(surgicalCases.hospitalId, hospitalId),
            eq(surgicalCases.scheduledDate, normalizedDate),
            ne(surgicalCases.status, "cancelled")
          )
        );

      return {
        success: true,
        rooms,
        blocks,
        cases,
      };
    });
  } catch (error: any) {
    console.error("[SURGICAL_ACTION] getOrSchedule failed:", error);
    return { success: false, error: "فشل استرداد جدول غرف العمليات والكتل الزمنية." };
  }
}

/**
 * Creates and registers a new surgical case.
 * Ordinary bookings are blocked if there are OR Blocks or existing cases, 
 * but Emergency bookings bypass blocks and conflicts (with a requirement of justification).
 */
export async function createSurgicalCase(
  data: SurgicalSchema,
  bypassBlocks: boolean,
  justification?: string,
  targetHospitalId?: string
) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const effectiveHospitalId = targetHospitalId && session.user.role === "SUPER_ADMIN"
    ? targetHospitalId
    : session.user.hospitalId;

  const isAuthorized = hasPermission(session.user as any, "surgical:create", {
    hospitalId: effectiveHospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to book surgical cases." };
  }

  const validated = surgicalSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: "بيانات العملية غير صالحة. يرجى مراجعة المدخلات.",
      details: validated.error.format(),
    };
  }

  const validatedData = validated.data;
  const hospitalId = effectiveHospitalId;

  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital context is missing." };
  }

  if (bypassBlocks && (!justification || justification.trim().length < 5)) {
    return {
      success: false,
      error: "يرجى كتابة مبرر طبي/إداري كافٍ (5 أحرف على الأقل) لتجاوز تعارض الكتل الزمنية للعملية الطارئة.",
    };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 0. Acquire row-level lock on the specific operating room to serialize case generation for this room
      // Enforce a strict 2-second timeout to prevent lock contention
      await tx.execute(sql`SET LOCAL lock_timeout = '2000';`);
      await tx.execute(sql`SELECT id FROM operating_rooms WHERE id = ${validatedData.orRoomId} FOR UPDATE`);
      
      // 0.5. Acquire row-level locks on the staff (surgeons and anesthesiologists) to prevent double-booking
      // the same medical personnel across different rooms simultaneously
      const staffIdsToLock = [validatedData.leadSurgeonId];
      if (validatedData.anesthesiologistId) {
        staffIdsToLock.push(validatedData.anesthesiologistId);
      }
      if (validatedData.assistantSurgeonIds && validatedData.assistantSurgeonIds.length > 0) {
        staffIdsToLock.push(...validatedData.assistantSurgeonIds);
      }
      
      const uniqueStaffIds = Array.from(new Set(staffIdsToLock)).sort();
      
      const inClauseStaff = sql.join(
        uniqueStaffIds.map(id => sql`${id}`),
        sql`, `
      );
      
      await tx.execute(sql`SELECT id FROM staff WHERE id IN (${inClauseStaff}) FOR UPDATE`);

      const scheduledAt = toCairoTime(new Date(validatedData.scheduledAt));
      const scheduledDate = new Date(Date.UTC(
        scheduledAt.getFullYear(),
        scheduledAt.getMonth(),
        scheduledAt.getDate(),
        0, 0, 0, 0
      ));

      const startTime = formatTimeStr(scheduledAt);
      const duration = validatedData.estimatedDuration;
      const endTime = addMinutesToTimeStr(startTime, duration);

      // 1. Check overlaps with existing active cases in the same OR room
      const existingCases = await tx
        .select()
        .from(surgicalCases)
        .where(
          and(
            eq(surgicalCases.hospitalId, hospitalId),
            eq(surgicalCases.orRoomId, validatedData.orRoomId),
            eq(surgicalCases.scheduledDate, scheduledDate),
            ne(surgicalCases.status, "cancelled")
          )
        );

      for (const c of existingCases) {
        const caseStart = c.scheduledStartTime;
        const caseEnd = addMinutesToTimeStr(caseStart, c.estimatedDurationMinutes);
        if (doTimesOverlap(startTime, endTime, caseStart, caseEnd)) {
          if (!bypassBlocks) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "عذراً، هناك عملية جراحية أخرى مجدولة في نفس هذا الوقت المتداخل في هذه الغرفة."
            );
          }
        }
      }

      // 2. Check overlaps with standard OR Blocks (unless bypassed)
      if (!bypassBlocks) {
        const dayOfWeek = scheduledAt.getDay();
        const blocks = await tx
          .select()
          .from(orBlocks)
          .where(
            and(
              eq(orBlocks.hospitalId, hospitalId),
              eq(orBlocks.orRoomId, validatedData.orRoomId),
              eq(orBlocks.dayOfWeek, dayOfWeek)
            )
          );

        for (const block of blocks) {
          if (doTimesOverlap(startTime, endTime, block.startTime, block.endTime)) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `عذراً، هذا الوقت متداخل مع فترة حظر جراحية مجدولة للغرفة: ${block.blockName}.`
            );
          }
        }
      }

      // 2.5 Check overlaps for Surgeon/Anesthesiologist across all rooms
      const staffConditions = [eq(surgicalCases.leadSurgeonId, validatedData.leadSurgeonId)];
      if (validatedData.anesthesiologistId) {
        staffConditions.push(eq(surgicalCases.anesthesiologistId, validatedData.anesthesiologistId));
      }

      const staffOverlap = await tx
        .select()
        .from(surgicalCases)
        .where(
          and(
            eq(surgicalCases.hospitalId, hospitalId),
            or(...staffConditions),
            eq(surgicalCases.scheduledDate, scheduledDate),
            ne(surgicalCases.status, "cancelled")
          )
        );

      for (const sc of staffOverlap) {
        if (doTimesOverlap(startTime, endTime, sc.scheduledStartTime, addMinutesToTimeStr(sc.scheduledStartTime, sc.estimatedDurationMinutes))) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "عذراً، الجراح الرئيسي أو طبيب التخدير لديه عملية أخرى مجدولة في هذا الوقت في غرفة مختلفة."
          );
        }
      }

      // 3. Resolve General Surgery Department or fallback
      let [department] = await tx
        .select()
        .from(departments)
        .where(and(eq(departments.hospitalId, hospitalId), eq(departments.code, "SURG")))
        .limit(1);

      if (!department) {
        [department] = await tx
          .select()
          .from(departments)
          .where(eq(departments.hospitalId, hospitalId))
          .limit(1);
      }

      if (!department) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "عذراً، يجب تسجيل قسم جراحي أو طبي أولاً في نظام المستشفى لتسجيل العمليات."
        );
      }

      // 4. Generate custom surgical case number (SC-YYYY-NNNNNN) atomically using DB sequence
      const currentYear = new Date().getFullYear();
      
      const [seqResult] = await tx
        .insert(tenantSequenceTracker)
        .values({
          hospitalId,
          sequenceName: "surgical_cases",
          currentVal: 1,
        })
        .onConflictDoUpdate({
          target: [tenantSequenceTracker.hospitalId, tenantSequenceTracker.sequenceName],
          set: { currentVal: sql`${tenantSequenceTracker.currentVal} + 1` },
        })
        .returning({ currentVal: tenantSequenceTracker.currentVal });

      const sequence = seqResult.currentVal;
      const caseNumber = `SC-${currentYear}-${String(sequence).padStart(6, "0")}`;

      // 5. Insert surgical case record
      const [newCase] = await tx
        .insert(surgicalCases)
        .values({
          hospitalId,
          caseNumber,
          patientId: validatedData.patientId,
          orRoomId: validatedData.orRoomId,
          leadSurgeonId: validatedData.leadSurgeonId,
          assistantSurgeonIds: validatedData.assistantSurgeonIds || [],
          anesthesiologistId: validatedData.anesthesiologistId || null,
          departmentId: department.id,
          procedureName: validatedData.procedureNameEn,
          procedureNameAr: validatedData.procedureNameAr,
          cptCode: validatedData.cptCode || null,
          anesthesiaType: validatedData.anesthesiaType as any,
          asaClass: (validatedData.asaClass as any) || "ASA_I",
          scheduledDate,
          scheduledStartTime: startTime,
          estimatedDurationMinutes: duration,
          status: "scheduled",
          surgeonNotes: bypassBlocks ? `[حالة طارئة - مبرر التجاوز]: ${justification}` : null,
        })
        .returning();

      if (!newCase) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "فشل حفظ بيانات الحالة الجراحية الجديدة.");
      }

      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);
      const hospitalSlug = hospital?.slug || hospitalId;

      revalidatePath(`/[locale]/${hospitalSlug}/surgical/schedule`, "page");
      return { success: true, caseId: newCase.id, caseNumber };
    });
  } catch (error: any) {
    console.error("[SURGICAL_ACTION] createSurgicalCase failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "حدث خطأ غير متوقع أثناء جدولة الحالة الجراحية. يرجى المحاولة لاحقاً." };
  }
}
