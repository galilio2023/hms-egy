/**
 * HMS Egypt - Automated Data Retention & Compliance Archiving Action
 * 
 * Implements Egyptian Ministry of Health (MOH) and Tax Authority (ETA) compliant 
 * data lifecycle retention policies. Marks historical records as archived and cleans up 
 * transient notification/reminder system logs.
 */

import { withTenantContext } from "../db/tenant";
import * as schema from "../../../db/schema";
import { eq, sql } from "drizzle-orm";
import { subYears } from "date-fns";

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

  console.log(`⏱️ Starting compliance data archiving for hospital: ${hospitalId}`);

  // 1. Fetch the data retention policy or initialize default (10y clinical / 5y financial)
  const policy = await withTenantContext(hospitalId, async (tx) => {
    let p = await tx.query.dataRetentionPolicies.findFirst({
      where: eq(schema.dataRetentionPolicies.hospitalId, hospitalId),
    });

    if (!p) {
      console.log("ℹ️ No active policy found. Deploying default MOH/ETA data retention boundaries.");
      const [newPolicy] = await tx
        .insert(schema.dataRetentionPolicies)
        .values({
          hospitalId,
          clinicalRetentionYears: 10,  // 10 years clinical records (MOH standard)
          financialRetentionYears: 5,  // 5 years financial invoices (ETA standard)
        })
        .returning();
      p = newPolicy;
    }
    return p;
  });

  const now = new Date();
  
  // Calculate timezone-independent absolute compliance cutoff timestamps
  const clinicalCutoff = subYears(now, policy.clinicalRetentionYears);
  const financialCutoff = subYears(now, policy.financialRetentionYears);
  const logsCutoff = subYears(now, 1);

  console.log(`- Clinical Cutoff (MOH): ${clinicalCutoff.toISOString()}`);
  console.log(`- Financial Cutoff (ETA): ${financialCutoff.toISOString()}`);
  console.log(`- Transient Logs Cutoff: ${logsCutoff.toISOString()}`);

  // 2. Archive medical records (MOH Audits) - Independent Batched Loops
  let clinicalCount = 0;
  while (true) {
    const batchCount = await withTenantContext(hospitalId, async (tx) => {
      const result = await tx.execute(sql`
        WITH batch AS (
          SELECT id FROM medical_records
          WHERE hospital_id = ${hospitalId} AND is_archived = false AND created_at < ${clinicalCutoff}
          LIMIT 2000
          FOR UPDATE SKIP LOCKED
        ),
        updated AS (
          UPDATE medical_records 
          SET is_archived = true, updated_at = ${now}
          WHERE id IN (SELECT id FROM batch)
          RETURNING id
        )
        SELECT COALESCE(count(*), 0)::int AS count FROM updated;
      `);
      return (result.rows[0] as { count: number })?.count ?? 0;
    });
    clinicalCount += batchCount;
    if (batchCount < 2000) break;
  }
  console.log(`📦 Archived ${clinicalCount} clinical medical records.`);

  // 3. Archive financial invoices (ETA Compliance) - Independent Batched Loops
  let financialCount = 0;
  while (true) {
    const batchCount = await withTenantContext(hospitalId, async (tx) => {
      const result = await tx.execute(sql`
        WITH batch AS (
          SELECT id FROM invoices
          WHERE hospital_id = ${hospitalId} AND is_archived = false AND created_at < ${financialCutoff}
          LIMIT 2000
          FOR UPDATE SKIP LOCKED
        ),
        updated AS (
          UPDATE invoices 
          SET is_archived = true, updated_at = ${now}
          WHERE id IN (SELECT id FROM batch)
          RETURNING id
        )
        SELECT COALESCE(count(*), 0)::int AS count FROM updated;
      `);
      return (result.rows[0] as { count: number })?.count ?? 0;
    });
    financialCount += batchCount;
    if (batchCount < 2000) break;
  }
  console.log(`📦 Archived ${financialCount} financial invoices.`);

  // 4. Prune transient logs (Reminders & Notifications older than 1 year) - Independent Batched Loops
  let remindersCount = 0;
  while (true) {
    const batchCount = await withTenantContext(hospitalId, async (tx) => {
      const result = await tx.execute(sql`
        WITH batch AS (
          SELECT id FROM sent_reminders
          WHERE hospital_id = ${hospitalId} AND sent_at < ${logsCutoff}
          LIMIT 2000
          FOR UPDATE SKIP LOCKED
        ),
        deleted AS (
          DELETE FROM sent_reminders
          WHERE id IN (SELECT id FROM batch)
          RETURNING id
        )
        SELECT COALESCE(count(*), 0)::int AS count FROM deleted;
      `);
      return (result.rows[0] as { count: number })?.count ?? 0;
    });
    remindersCount += batchCount;
    if (batchCount < 2000) break;
  }
    
  let notificationsCount = 0;
  while (true) {
    const batchCount = await withTenantContext(hospitalId, async (tx) => {
      const result = await tx.execute(sql`
        WITH batch AS (
          SELECT id FROM notifications
          WHERE hospital_id = ${hospitalId} AND created_at < ${logsCutoff}
          LIMIT 2000
          FOR UPDATE SKIP LOCKED
        ),
        deleted AS (
          DELETE FROM notifications
          WHERE id IN (SELECT id FROM batch)
          RETURNING id
        )
        SELECT COALESCE(count(*), 0)::int AS count FROM deleted;
      `);
      return (result.rows[0] as { count: number })?.count ?? 0;
    });
    notificationsCount += batchCount;
    if (batchCount < 2000) break;
  }
    
  const transientCount = remindersCount + notificationsCount;
  console.log(`🗑️ Pruned ${transientCount} transient/reminder notifications logs.`);

  // 5. Write Compliance Audit Logs of archiving operations
  if (clinicalCount > 0 || financialCount > 0) {
    await withTenantContext(hospitalId, async (tx) => {
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
}
