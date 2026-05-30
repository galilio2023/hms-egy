"use server";

import { db } from "@/lib/db";
import { invoices } from "@db/schema/billing";
import { backgroundJobs, auditLogs } from "@db/schema/system";
import { eq, and, sql } from "drizzle-orm";
import { etaClient } from "@/lib/eta/client";
import { transformInvoiceToETADocument } from "@/lib/eta/transformer";
import { authInstance } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { decryptField } from "@/lib/utils/security";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { withTenantContext } from "@/lib/db/tenant";

/**
 * Server action to submit an invoice to the Egyptian Tax Authority.
 * Addresses Code Review Phase 2 findings: #1 (RBAC), #1.2 (Encryption).
 */
export async function submitInvoiceToETA(invoiceId: string) {
  const session = await authInstance.api.getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const user = session.user as import("@/types/auth-api.types").User;
  const hospitalId = user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Unauthorized: Missing active tenant context." };
  }

  // 1. Enforce Role/Permission Authorization (Code Review Phase 2 #1)
  if (!hasPermission(user, "billing:eta", { hospitalId })) {
    return { success: false, error: "Forbidden: You do not have permission to submit to ETA." };
  }

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.hospitalId, hospitalId)
      ),
      with: {
        hospital: {
          with: {
            settings: true,
          }
        },
        patient: true,
        items: true,
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice.etaUuid) {
      return { success: false, error: "Invoice already submitted to ETA" };
    }

    const { hospital } = invoice;
    const settings = hospital.settings;

    if (!settings?.etaClientId || !settings?.etaClientSecret) {
      return { success: false, error: "ETA credentials not configured for this hospital." };
    }

    // 2. Decrypt Client Secret (Code Review Phase 2 #1.2)
    const decryptedSecret = decryptField(settings.etaClientSecret);
    if (!decryptedSecret) {
      return { success: false, error: "CRITICAL: Failed to decrypt ETA credentials. Please re-configure." };
    }

    const creds = {
      clientId: settings.etaClientId,
      clientSecret: decryptedSecret, 
    };

    let etaDoc;
    let auditLog;
    try {
      const result = transformInvoiceToETADocument(invoice as unknown as Parameters<typeof transformInvoiceToETADocument>[0]);
      etaDoc = result.document;
      auditLog = result.auditLogPayload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }

    if (auditLog) {
      await db.insert(auditLogs).values({
        ...auditLog,
        createdAt: new Date(),
      });
    }
    
    // 3. Queue Background Job for ETA Submission
    const [job] = await db.insert(backgroundJobs).values({
      hospitalId,
      jobType: "eta_invoice_submission",
      payload: { invoiceId },
      status: "pending",
    }).returning();

    // Trigger immediate background processing
    after(() => {
      processETAJob(job.id, hospitalId).catch(err =>
        console.error(`[ETA BACKGROUND] Failed to initiate job ${job.id}:`, err)
      );
    });

    return { success: true, message: "Invoice queued for ETA submission." };
  } catch (error) {
    console.error("ETA Submission Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message || "Failed to submit to ETA" };
  }
}

/**
 * Background processor for ETA jobs.
 */
export async function processETAJob(jobId: string, hospitalId: string) {
  return await withTenantContext(hospitalId, async (tx) => {
    const [job] = await tx.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1);
    if (!job || job.status === "completed") return;

    const { invoiceId } = job.payload as { invoiceId: string };

    try {
      await tx.update(backgroundJobs)
        .set({ status: "processing", attempts: sql`${backgroundJobs.attempts} + 1`, updatedAt: new Date() })
        .where(eq(backgroundJobs.id, jobId));

      const invoice = await tx.query.invoices.findFirst({
        where: and(eq(invoices.id, invoiceId), eq(invoices.hospitalId, hospitalId)),
        with: {
          hospital: { with: { settings: true } },
          patient: true,
          items: true,
        },
      });

      if (!invoice) throw new Error("Invoice not found during background process");

      const settings = invoice.hospital.settings;
      if (!settings?.etaClientId || !settings?.etaClientSecret) throw new Error("ETA credentials missing");

      const decryptedSecret = decryptField(settings.etaClientSecret);
      if (!decryptedSecret) throw new Error("Failed to decrypt ETA secret");

      const creds = { clientId: settings.etaClientId, clientSecret: decryptedSecret };
      const result = transformInvoiceToETADocument(invoice as unknown as Parameters<typeof transformInvoiceToETADocument>[0]);
      const etaDoc = result.document;
      const auditLog = result.auditLogPayload;

      if (auditLog) {
        await tx.insert(auditLogs).values({
          ...auditLog,
          createdAt: new Date(),
        });
      }

      const response = await etaClient.submitDocuments([etaDoc], creds);

      if (response.acceptedDocuments.length > 0) {
        const accepted = response.acceptedDocuments[0];
        await tx.update(invoices)
          .set({
            etaUuid: accepted.uuid,
            etaLongId: accepted.longId,
            etaInternalId: accepted.internalId,
            etaStatus: "submitted",
            etaSyncStatus: "synced",
            etaSubmissionId: response.submissionId,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        await tx.update(backgroundJobs)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(backgroundJobs.id, jobId));
      } else {
        const errorMsg = response.rejectedDocuments[0]?.error?.message || "Unknown ETA rejection";
        await tx.update(invoices)
          .set({ etaStatus: "invalid", etaSyncStatus: "rejected", etaErrorMessage: errorMsg, updatedAt: new Date() })
          .where(eq(invoices.id, invoiceId));

        await tx.update(backgroundJobs)
          .set({ status: "failed", lastError: errorMsg, updatedAt: new Date() })
          .where(eq(backgroundJobs.id, jobId));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await tx.update(backgroundJobs)
        .set({ status: "failed", lastError: message, updatedAt: new Date() })
        .where(eq(backgroundJobs.id, jobId));

      await tx.update(invoices)
        .set({ etaSyncStatus: "failed", etaErrorMessage: message, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));
    }
  });
}

export async function checkETAStatus(invoiceId: string) {
  const session = await authInstance.api.getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const user = session.user as import("@/types/auth-api.types").User;
  const hospitalId = user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "Unauthorized: Missing active tenant context." };
  }

  if (!hasPermission(user, "billing:eta", { hospitalId })) {
    return { success: false, error: "Forbidden" };
  }

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.hospitalId, hospitalId)
      ),
      with: {
        hospital: {
          with: {
            settings: true,
          }
        }
      }
    });

    if (!invoice || !invoice.etaUuid) {
      return { success: false, error: "Invoice not submitted to ETA" };
    }

    const settings = invoice.hospital.settings;
    if (!settings?.etaClientId || !settings?.etaClientSecret) {
      return { success: false, error: "ETA credentials missing." };
    }

    const decryptedSecret = decryptField(settings.etaClientSecret);
    if (!decryptedSecret) {
      return { success: false, error: "Failed to decrypt credentials." };
    }

    const creds = {
      clientId: settings.etaClientId,
      clientSecret: decryptedSecret,
    };

    const details = await etaClient.getDocument(invoice.etaUuid, creds) as { status: string };
    
    await db.update(invoices)
      .set({
        etaStatus: details.status.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    revalidatePath("/billing");
    return { success: true, data: details.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message || "Failed to check ETA status" };
  }
}
