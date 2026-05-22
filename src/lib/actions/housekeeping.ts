"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { beds } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { eq, and, sql, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

/**
 * Creates a new housekeeping task, typically triggered automatically on discharge.
 */
export async function createHousekeepingTask(payload: {
  bedId: string;
  roomId: string;
  type: "post_discharge" | "routine" | "pre_admission" | "deep_clean";
  priority: "routine" | "urgent";
}) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) return { success: false, error: "Hospital context missing" };

  // Permission: Any admin or nurse can trigger cleaning, or automatic system
  const isAuthorized = hasPermission(session.user as unknown as User, "housekeeping:update", {
    hospitalId,
  });

  if (!isAuthorized) return { success: false, error: "Forbidden" };

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve staff record for requester
      const requester = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then(res => res[0]);

      // 2. Create the task
      const [task] = await tx
        .insert(housekeepingTasks)
        .values({
          hospitalId,
          bedId: payload.bedId,
          roomId: payload.roomId,
          type: payload.type,
          priority: payload.priority,
          status: "pending",
          requestedBy: requester?.id || null,
        })
        .returning();

      // 3. Ensure bed is in pending_cleaning
      await tx
        .update(beds)
        .set({ status: "pending_cleaning", updatedAt: new Date() })
        .where(eq(beds.id, payload.bedId));

      return { success: true, taskId: task.id };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
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

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      await tx
        .update(housekeepingTasks)
        .set({ assignedTo: staffId })
        .where(eq(housekeepingTasks.id, taskId));

      return { success: true };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Marks a task as started.
 */
export async function startHousekeepingTask(taskId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  
  try {
    return await withTenantContext(hospitalId, async (tx) => {
      await tx
        .update(housekeepingTasks)
        .set({ 
          status: "in_progress", 
          startedAt: new Date()
        })
        .where(eq(housekeepingTasks.id, taskId));

      return { success: true };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Completes a housekeeping task and releases the bed.
 */
export async function completeHousekeepingTask(taskId: string, photoUrl?: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const hospitalId = session.activeHospitalId || session.user.hospitalId;

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve task to get bedId
      const [task] = await tx
        .select()
        .from(housekeepingTasks)
        .where(eq(housekeepingTasks.id, taskId))
        .limit(1);

      if (!task) throw new Error("Task not found");

      // 2. Mark task as completed
      await tx
        .update(housekeepingTasks)
        .set({ 
          status: "completed", 
          completedAt: new Date(),
          completionPhotoUrl: photoUrl || null
        })
        .where(eq(housekeepingTasks.id, taskId));

      // 3. Release bed
      if (task.bedId) {
        await tx
          .update(beds)
          .set({ status: "available", updatedAt: new Date() })
          .where(eq(beds.id, task.bedId));
      }

      return { success: true };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
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
        .select()
        .from(housekeepingTasks)
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
