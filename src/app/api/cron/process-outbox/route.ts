import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backgroundJobs } from "@db/schema/system";
import { InferSelectModel, eq, and, lt, lte, or } from "drizzle-orm";
import { processETAJob } from "@/lib/actions/eta";
import { processEscalateLabAlert } from "@/lib/actions/laboratory";

/**
 * SECURE CRON ENDPOINT: Processes failed or pending background jobs.
 * Specifically handles ETA submission retries for transient failures.
 */
export async function GET(req: NextRequest) {
  // 1. Strict Security Check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch jobs that need retry or scheduled execution
    const jobsToProcess = await db.select()
      .from(backgroundJobs)
      .where(
        or(
          // Retry failed ETA jobs
          and(
            eq(backgroundJobs.status, "failed"),
            lt(backgroundJobs.attempts, backgroundJobs.maxAttempts),
            eq(backgroundJobs.jobType, "eta_invoice_submission")
          ),
          // Process scheduled escalation alerts
          and(
            eq(backgroundJobs.status, "pending"),
            eq(backgroundJobs.jobType, "escalate_critical_lab_alert"),
            lte(backgroundJobs.runAt, new Date())
          )
        )
      )
      .limit(20);

    const results = [];

    for (const job of jobsToProcess) {
      try {
        if (job.jobType === "eta_invoice_submission") {
          await processETAJob(job.id, job.hospitalId);
        } else if (job.jobType === "escalate_critical_lab_alert") {
          // Mark as processing first to avoid race conditions if cron runs frequently
          await db.update(backgroundJobs)
            .set({ status: "processing", attempts: job.attempts + 1, updatedAt: new Date() })
            .where(eq(backgroundJobs.id, job.id));

          await processEscalateLabAlert(job.id, job.hospitalId);

          await db.update(backgroundJobs)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(backgroundJobs.id, job.id));
        }
        results.push({ jobId: job.id, success: true });
      } catch (err) {
        console.error(`[CRON] Job ${job.id} failed:`, err);
        await db.update(backgroundJobs)
          .set({
            status: "failed",
            lastError: String(err),
            attempts: job.attempts + 1,
            updatedAt: new Date()
          })
          .where(eq(backgroundJobs.id, job.id));

        results.push({ jobId: job.id, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("[CRON OUTBOX ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
