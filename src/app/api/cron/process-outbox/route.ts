import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backgroundJobs } from "@db/schema/system";
import { InferSelectModel, eq, and, lt } from "drizzle-orm";
import { processETAJob } from "@/lib/actions/eta";

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
    // 2. Fetch jobs that need retry
    const jobsToRetry = await db.select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.status, "failed"),
          lt(backgroundJobs.attempts, backgroundJobs.maxAttempts),
          eq(backgroundJobs.jobType, "eta_invoice_submission")
        )
      )
      .limit(10);

    const results = [];

    for (const job of jobsToRetry) {
      try {
        await processETAJob(job.id, job.hospitalId);
        results.push({ jobId: job.id, success: true });
      } catch (err) {
        results.push({ jobId: job.id, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("[CRON OUTBOX ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
