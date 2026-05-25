"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { beds, rooms } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { notifications, auditLogs } from "@db/schema/system";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

/**
 * Creates a new housekeeping task, typically triggered automatically on discharge or manually.
 */
export async function createHousekeepingTask(payload: {
  bedId: string;
  roomId?: string;
  type: "post_discharge" | "routine" | "pre_admission" | "deep_clean" | "isolation_terminal";
  priority: "routine" | "urgent";
  notes?: string;
}) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  // Permission: Admin, Nurse, and Doctor can trigger cleaning
  const userRole = session.user.role;
  const isAuthorized = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE", "DOCTOR", "SURGEON"].includes(userRole);
  if (!isAuthorized) return { success: false, error: "Forbidden: Insufficient permissions to request cleaning" };

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve room details and bed numbers
      let targetRoomId = payload.roomId;
      let bedNumber: string | null = null;
      let roomNumber: string | null = null;
      
      if (payload.bedId) {
        const [bedDetails] = await tx
          .select({
            roomId: beds.roomId,
            bedNumber: beds.bedNumber,
            roomNumber: rooms.roomNumber,
          })
          .from(beds)
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .where(and(
            eq(beds.id, payload.bedId),
            eq(beds.hospitalId, hospitalId)
          ))
          .limit(1);

        if (!bedDetails) throw new Error("Bed not found or unauthorized access");
        if (!targetRoomId) targetRoomId = bedDetails.roomId;
        bedNumber = bedDetails.bedNumber;
        roomNumber = bedDetails.roomNumber;
      } else if (targetRoomId) {
        const [roomDetails] = await tx
          .select({ roomNumber: rooms.roomNumber })
          .from(rooms)
          .where(and(eq(rooms.id, targetRoomId), eq(rooms.hospitalId, hospitalId)))
          .limit(1);
        roomNumber = roomDetails?.roomNumber || "Unknown";
      }

      if (!targetRoomId) throw new Error("Target Room ID is required for housekeeping tasks.");

      // 2. Resolve staff record for requester
      const requester = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then(res => res[0]);

      // 3. Create the task
      const [task] = await tx
        .insert(housekeepingTasks)
        .values({
          hospitalId,
          bedId: payload.bedId,
          roomId: targetRoomId,
          type: payload.type,
          priority: payload.priority,
          status: "pending",
          notes: payload.notes || null,
          requestedBy: requester?.id || null,
        })
        .returning();

      // 4. Ensure bed is in pending_cleaning (Only if bedId is provided)
      if (payload.bedId) {
        await tx
          .update(beds)
          .set({ 
            status: "pending_cleaning", 
            cleaningRequestedAt: new Date(), 
            updatedAt: new Date() 
          })
          .where(and(
            eq(beds.id, payload.bedId),
            eq(beds.hospitalId, hospitalId)
          ));
      }

      // 5. Notify all active housekeeping staff in this hospital
      const hkStaff = await tx
        .select({ userId: staff.userId })
        .from(staff)
        .where(and(
          eq(staff.hospitalId, hospitalId),
          eq(staff.role, "HOUSEKEEPING"),
          eq(staff.isActive, true)
        ));

      const notificationPayloads = hkStaff
        .filter(member => member.userId)
        .map(member => ({
          hospitalId,
          userId: member.userId!,
          titleAr: "🧹 طلب تنظيف جديد",
          titleEn: "🧹 New Cleaning Request",
          messageAr: bedNumber 
            ? `مطلوب تنظيف وتعقيم السرير رقم ${bedNumber} في الغرفة رقم ${roomNumber}. الأولوية: ${payload.priority === "urgent" ? "عاجل" : "عادي"}.`
            : `مطلوب تنظيف وتعقيم في الغرفة رقم ${roomNumber}. الأولوية: ${payload.priority === "urgent" ? "عاجل" : "عادي"}.`,
          messageEn: bedNumber
            ? `Cleaning requested for bed ${bedNumber} in room ${roomNumber}. Priority: ${payload.priority}.`
            : `Cleaning requested for room ${roomNumber}. Priority: ${payload.priority}.`,
          type: (payload.priority === "urgent" ? "warning" : "info") as any,
          isRead: false,
        }));

      if (notificationPayloads.length > 0) {
        await tx.insert(notifications).values(notificationPayloads);
      }

      return { success: true, taskId: task.id };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/housekeeping`, "layout");
    return { success: result.success, taskId: result.taskId };
  } catch (error: any) {
    console.error("[CREATE_HOUSEKEEPING_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to create task" };
  }
}

/**
 * Assigns a task to a housekeeping staff member.
 */
export async function assignHousekeepingTask(taskId: string, staffId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  const userRole = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userRole);
  const isNurse = ["NURSE", "OR_NURSE"].includes(userRole);
  const isHk = userRole === "HOUSEKEEPING";

  if (!isAdmin && !isHk && !isNurse) {
    return { success: false, error: "Forbidden: You do not have permission to assign housekeeping tasks." };
  }

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // Housekeeping staff can only assign to themselves
      if (isHk) {
        const housekeeper = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
          .limit(1)
          .then(res => res[0]);

        if (!housekeeper || housekeeper.id !== staffId) {
          return { success: false, error: "Forbidden: Housekeepers can only assign tasks to themselves." };
        }
      }

      // Update the assignment
      const [updatedTask] = await tx
        .update(housekeepingTasks)
        .set({ assignedTo: staffId })
        .where(and(
          eq(housekeepingTasks.id, taskId),
          eq(housekeepingTasks.hospitalId, hospitalId)
        ))
        .returning();

      if (!updatedTask) throw new Error("Task not found or unauthorized");

      // Notify the assigned staff member
      const [assignedStaff] = await tx
        .select({ userId: staff.userId })
        .from(staff)
        .where(and(
          eq(staff.id, staffId),
          eq(staff.hospitalId, hospitalId)
        ))
        .limit(1);

      if (assignedStaff && assignedStaff.userId) {
        await tx.insert(notifications).values({
          hospitalId,
          userId: assignedStaff.userId,
          titleAr: "📌 تم إسناد مهمة تنظيف لك",
          titleEn: "📌 Housekeeping Task Assigned",
          messageAr: `تم إسناد مهمة تنظيف جديدة لك. يرجى مراجعة لوحة المهام والبدء عند الاستعداد.`,
          messageEn: `A new cleaning task has been assigned to you. Please start when ready.`,
          type: "info" as any,
          isRead: false,
        });
      }

      return { success: true };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/housekeeping`, "layout");
    return { success: result.success };
  } catch (error: any) {
    console.error("[ASSIGN_HOUSEKEEPING_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to assign task" };
  }
}

/**
 * Marks a task as started.
 */
export async function startHousekeepingTask(taskId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  const userRole = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userRole);
  const isNurse = ["NURSE", "OR_NURSE"].includes(userRole);
  const isHk = userRole === "HOUSEKEEPING";

  if (!isAdmin && !isHk && !isNurse) {
    return { success: false, error: "Forbidden: You do not have permission to start housekeeping tasks." };
  }

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      const [task] = await tx
        .select()
        .from(housekeepingTasks)
        .where(and(
          eq(housekeepingTasks.id, taskId),
          eq(housekeepingTasks.hospitalId, hospitalId)
        ))
        .limit(1);

      if (!task) throw new Error("Task not found or unauthorized");

      // Housekeepers can only start tasks assigned to them
      if (isHk) {
        const housekeeper = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
          .limit(1)
          .then(res => res[0]);

        if (!housekeeper || task.assignedTo !== housekeeper.id) {
          return { success: false, error: "Forbidden: You can only start tasks assigned to you." };
        }
      }

      await tx
        .update(housekeepingTasks)
        .set({ 
          status: "in_progress", 
          startedAt: new Date()
        })
        .where(and(
          eq(housekeepingTasks.id, taskId),
          eq(housekeepingTasks.status, "pending"),
          eq(housekeepingTasks.hospitalId, hospitalId)
        ));

      return { success: true };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/housekeeping`, "layout");
    return result;
  } catch (error: any) {
    console.error("[START_HOUSEKEEPING_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to start task" };
  }
}

/**
 * Completes a housekeeping task and releases the bed.
 */
export async function completeHousekeepingTask(taskId: string, photoUrl?: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  const userRole = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userRole);
  const isNurse = ["NURSE", "OR_NURSE"].includes(userRole);
  const isHk = userRole === "HOUSEKEEPING";

  if (!isAdmin && !isHk && !isNurse) {
    return { success: false, error: "Forbidden: You do not have permission to complete housekeeping tasks." };
  }

  // Security: Block raw base64 data to prevent database bloat
  if (photoUrl && photoUrl.startsWith("data:image")) {
    return { success: false, error: "Security Error: Raw image data is not allowed. Please use the designated upload service to obtain an HTTPS URL." };
  }

  // Security: Sanitize photoUrl to prevent Stored XSS
  if (photoUrl) {
    try {
      const isRelative = photoUrl.startsWith("/api/housekeeping/image/");
      const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
      const isAllowedCDN = !!(cdnUrl && photoUrl.startsWith(cdnUrl));
      
      if (!isRelative && !isAllowedCDN) {
        return { success: false, error: "Security Error: Untrusted image source URL detected." };
      }
    } catch (err) {
      return { success: false, error: "Security Error: Invalid image URL format." };
    }
  }

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve task to get bedId
      const [task] = await tx
        .select()
        .from(housekeepingTasks)
        .where(and(
          eq(housekeepingTasks.id, taskId),
          inArray(housekeepingTasks.status, ["pending", "in_progress"]),
          eq(housekeepingTasks.hospitalId, hospitalId)
        ))
        .limit(1);

      if (!task) throw new Error("Task not found or unauthorized");

      // Housekeepers can only complete tasks assigned to them
      if (isHk) {
        const housekeeper = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
          .limit(1)
          .then(res => res[0]);

        if (!housekeeper || task.assignedTo !== housekeeper.id) {
          return { success: false, error: "Forbidden: You can only complete tasks assigned to you." };
        }
      }

      // 2. Mark task as completed
      await tx
        .update(housekeepingTasks)
        .set({ 
          status: "completed", 
          completedAt: new Date(),
          completionPhotoUrl: photoUrl || null
        })
        .where(and(
          eq(housekeepingTasks.id, taskId),
          inArray(housekeepingTasks.status, ["pending", "in_progress"]),
          eq(housekeepingTasks.hospitalId, hospitalId)
        ));

      let bedDetailsAr = "السرير";
      let bedDetailsEn = "A bed";

      // 3. Release bed
      if (task.bedId) {
        await tx
          .update(beds)
          .set({ status: "available", updatedAt: new Date() })
          .where(and(
            eq(beds.id, task.bedId),
            eq(beds.hospitalId, hospitalId)
          ));

        const [bedRoom] = await tx
          .select({
            bedNumber: beds.bedNumber,
            roomNumber: rooms.roomNumber,
          })
          .from(beds)
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .where(and(
            eq(beds.id, task.bedId),
            eq(beds.hospitalId, hospitalId)
          ))
          .limit(1);

        if (bedRoom) {
          bedDetailsAr = `السرير رقم ${bedRoom.bedNumber} في الغرفة رقم ${bedRoom.roomNumber}`;
          bedDetailsEn = `bed ${bedRoom.bedNumber} in room ${bedRoom.roomNumber}`;
        }
      }

      // 4. Notify all nursing station staff (NURSE / OR_NURSE) in this hospital
      const nurses = await tx
        .select({ userId: staff.userId })
        .from(staff)
        .where(and(
          eq(staff.hospitalId, hospitalId),
          inArray(staff.role, ["NURSE", "OR_NURSE"]),
          eq(staff.isActive, true)
        ));

      const nursingNotifications = nurses
        .filter(nurse => nurse.userId)
        .map(nurse => ({
          hospitalId,
          userId: nurse.userId!,
          titleAr: "✅ السرير جاهز للاستقبال",
          titleEn: "✅ Bed Ready for Admission",
          messageAr: `تم إكمال عملية تنظيف وتعقيم ${bedDetailsAr} وهو جاهز الآن لاستقبال المرضى.`,
          messageEn: `Housekeeping has finished cleaning ${bedDetailsEn}. It is now available for admission.`,
          type: "success" as any,
          isRead: false,
        }));

      if (nursingNotifications.length > 0) {
        await tx.insert(notifications).values(nursingNotifications);
      }

      // 5. Create audit log entry
      await tx.insert(auditLogs).values({
        hospitalId,
        userId: session.user.id,
        action: "complete_housekeeping_task",
        entityType: "housekeeping_task",
        entityId: taskId,
        payload: {
          taskId,
          bedId: task.bedId,
          completedAt: new Date().toISOString(),
          completionPhotoUrl: photoUrl?.startsWith("data:") ? "[BASE64_IMAGE]" : (photoUrl || null),
        },
      });

      return { success: true };
    });

    revalidatePath(`/[locale]/(dashboard)/[hospitalSlug]/housekeeping`, "layout");
    return { success: result.success };
  } catch (error: any) {
    console.error("[COMPLETE_HOUSEKEEPING_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to complete task" };
  }
}

/**
 * Fetches the housekeeping queue for the current hospital.
 */
export async function getHousekeepingQueue() {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const queue = await tx
        .select({
          id: housekeepingTasks.id,
          bedId: housekeepingTasks.bedId,
          roomId: housekeepingTasks.roomId,
          type: housekeepingTasks.type,
          status: housekeepingTasks.status,
          priority: housekeepingTasks.priority,
          requestedAt: housekeepingTasks.requestedAt,
          startedAt: housekeepingTasks.startedAt,
          completedAt: housekeepingTasks.completedAt,
          notes: housekeepingTasks.notes,
          assignedTo: housekeepingTasks.assignedTo,
          assignedStaffNameAr: staff.nameAr,
          assignedStaffNameEn: staff.nameEn,
          bedNumber: beds.bedNumber,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          wing: rooms.wing,
        })
        .from(housekeepingTasks)
        .leftJoin(beds, eq(housekeepingTasks.bedId, beds.id))
        .leftJoin(rooms, eq(housekeepingTasks.roomId, rooms.id))
        .leftJoin(staff, eq(housekeepingTasks.assignedTo, staff.id))
        .where(and(
          eq(housekeepingTasks.hospitalId, hospitalId),
          sql`${housekeepingTasks.status} != 'completed'`
        ))
        .orderBy(desc(housekeepingTasks.priority), desc(housekeepingTasks.requestedAt));

      return { success: true, data: queue };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
