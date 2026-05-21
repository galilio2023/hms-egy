/**
 * HMS Egypt - Automated Data Retention & Compliance Archiving Action
 * 
 * Implements Egyptian Ministry of Health (MOH) and Tax Authority (ETA) compliant 
 * data lifecycle retention policies. Marks historical records as archived and cleans up 
 * transient notification/reminder system logs.
 */

import { withTenantContext } from "../db/tenant";
import * as schema from "../../../db/schema";
import { and, lt, eq } from "drizzle-orm";

export interface ArchivingJobResult {
  success: boolean;
  clinicalArchived: number;
  financialArchived: number;
  transientLogsCleaned: number;
  messageAr: string;
  messageEn: string;
}

/**
 * Programmatically runs the data archiving and compliance job for a hospital.
 * Scopes database operations within withTenantContext to guarantee strict tenant isolation.
 * 
 * @param hospitalId UUID of the hospital performing the archiving job.
 * @param performedByStaffId UUID of the staff member who authorized/triggered the execution.
 */
export async function runDataArchivingJob(
  hospitalId: string,
  performedByStaffId: string
): Promise<ArchivingJobResult> {
  if (!hospitalId || !performedByStaffId) {
    throw new Error("runDataArchivingJob: hospitalId and performedByStaffId are required.");
  }

  return await withTenantContext(hospitalId, async (tx) => {
    console.log(`⏱️ Starting compliance data archiving for hospital: ${hospitalId}`);

    // 1. Fetch the data retention policy or initialize default (10y clinical / 5y financial)
    let policy = await tx.query.dataRetentionPolicies.findFirst({
      where: eq(schema.dataRetentionPolicies.hospitalId, hospitalId),
    });

    if (!policy) {
      console.log("ℹ️ No active policy found. Deploying default MOH/ETA data retention boundaries.");
      const [newPolicy] = await tx
        .insert(schema.dataRetentionPolicies)
        .values({
          hospitalId,
          clinicalRetentionYears: 10,  // 10 years clinical records (MOH standard)
          financialRetentionYears: 5,  // 5 years financial invoices (ETA standard)
        })
        .returning();
      policy = newPolicy;
    }

    const now = new Date();
    
    // Calculate cutoff dates based on configured years
    const clinicalCutoff = new Date(
      now.getFullYear() - policy.clinicalRetentionYears,
      now.getMonth(),
      now.getDate()
    );
    const financialCutoff = new Date(
      now.getFullYear() - policy.financialRetentionYears,
      now.getMonth(),
      now.getDate()
    );
    // Transient logs (SMS reminders, AI logs, audit trials) cleaned up if older than 1 year
    const logsCutoff = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate()
    );

    console.log(`- Clinical Cutoff (MOH): ${clinicalCutoff.toISOString()}`);
    console.log(`- Financial Cutoff (ETA): ${financialCutoff.toISOString()}`);
    console.log(`- Transient Logs Cutoff: ${logsCutoff.toISOString()}`);

    // 2. Archive medical records (MOH Audits)
    const clinicalUpdateResult = await tx
      .update(schema.medicalRecords)
      .set({ isArchived: true, updatedAt: now })
      .where(
        and(
          eq(schema.medicalRecords.hospitalId, hospitalId),
          eq(schema.medicalRecords.isArchived, false),
          lt(schema.medicalRecords.createdAt, clinicalCutoff)
        )
      )
      .returning();
    const clinicalCount = clinicalUpdateResult.length;
    console.log(`📦 Archived ${clinicalCount} clinical medical records.`);

    // 3. Archive financial invoices (ETA Compliance)
    const financialUpdateResult = await tx
      .update(schema.invoices)
      .set({ isArchived: true, updatedAt: now })
      .where(
        and(
          eq(schema.invoices.hospitalId, hospitalId),
          eq(schema.invoices.isArchived, false),
          lt(schema.invoices.createdAt, financialCutoff)
        )
      )
      .returning();
    const financialCount = financialUpdateResult.length;
    console.log(`📦 Archived ${financialCount} financial invoices.`);

    // 4. Prune transient logs (Reminders & Notifications older than 1 year) to save database space
    const reminderDeleteResult = await tx
      .delete(schema.sentReminders)
      .where(
        and(
          eq(schema.sentReminders.hospitalId, hospitalId),
          lt(schema.sentReminders.sentAt, logsCutoff)
        )
      )
      .returning();
      
    const notificationDeleteResult = await tx
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.hospitalId, hospitalId),
          lt(schema.notifications.createdAt, logsCutoff)
        )
      )
      .returning();
      
    const transientCount = reminderDeleteResult.length + notificationDeleteResult.length;
    console.log(`🗑️ Pruned ${transientCount} transient/reminder notifications logs.`);

    // 5. Write Compliance Audit Logs of archiving operations
    if (clinicalCount > 0) {
      await tx.insert(schema.dataRetentionLogs).values({
        hospitalId,
        entityType: "medical_records",
        archivedCount: clinicalCount,
        cutoffDate: clinicalCutoff,
        performedBy: performedByStaffId,
      });
    }

    if (financialCount > 0) {
      await tx.insert(schema.dataRetentionLogs).values({
        hospitalId,
        entityType: "invoices",
        archivedCount: financialCount,
        cutoffDate: financialCutoff,
        performedBy: performedByStaffId,
      });
    }

    const messageAr = `تمت أرشفة وتصفية البيانات بنجاح: ${clinicalCount} سجل طبي، ${financialCount} فاتورة مالية، وتنظيف ${transientCount} سجل مؤقت.`;
    const messageEn = `Data archiving and pruning executed successfully: ${clinicalCount} clinical charts, ${financialCount} invoices archived, and ${transientCount} transient logs pruned.`;

    console.log("🎉 Compliance data archiving job completed successfully!");

    return {
      success: true,
      clinicalArchived: clinicalCount,
      financialArchived: financialCount,
      transientLogsCleaned: transientCount,
      messageAr,
      messageEn,
    };
  });
}
