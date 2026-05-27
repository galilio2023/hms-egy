"use server";

import { db } from "@/lib/db";
import { invoices } from "@db/schema/billing";
import { eq, and } from "drizzle-orm";
import { etaClient } from "@/lib/eta/client";
import { transformInvoiceToETADocument } from "@/lib/eta/transformer";
import { authInstance } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { decryptField } from "@/lib/utils/security";
import { revalidatePath } from "next/cache";

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
    try {
      etaDoc = transformInvoiceToETADocument(invoice as any);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
    
    const response = await etaClient.submitDocuments([etaDoc], creds);

    if (response.acceptedDocuments.length > 0) {
      const accepted = response.acceptedDocuments[0];
      await db.update(invoices)
        .set({
          etaUuid: accepted.uuid,
          etaLongId: accepted.longId,
          etaInternalId: accepted.internalId,
          etaStatus: "submitted",
          etaSubmissionId: response.submissionId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      revalidatePath("/billing");
      return { success: true, data: accepted };
    } else if (response.rejectedDocuments.length > 0) {
      const rejected = response.rejectedDocuments[0];
      await db.update(invoices)
        .set({
          etaStatus: "invalid",
          etaErrorMessage: rejected.error.message,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      return { success: false, error: `ETA Rejected: ${rejected.error.message}` };
    }

    return { success: false, error: "Unknown error from ETA" };
  } catch (error: any) {
    console.error("ETA Submission Error:", error);
    return { success: false, error: error.message || "Failed to submit to ETA" };
  }
}

export async function checkETAStatus(invoiceId: string) {
  const session = await authInstance.api.getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const hospitalId = (session.user as any).hospitalId as string | undefined;
  if (!hospitalId) {
    return { success: false, error: "Unauthorized: Missing active tenant context." };
  }

  if (!hasPermission(session.user as any, "billing:eta")) {
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

    const details = await etaClient.getDocument(invoice.etaUuid, creds);
    
    await db.update(invoices)
      .set({
        etaStatus: details.status.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    revalidatePath("/billing");
    return { success: true, data: details.status };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to check ETA status" };
  }
}
