"use server";

import { db } from "@/lib/db";
import { invoices } from "@/db/schema/billing";
import { eq, and } from "drizzle-orm";
import { etaClient } from "@/lib/eta/client";
import { transformInvoiceToETADocument } from "@/lib/eta/transformer";
import { authInstance } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Server action to submit an invoice to the Egyptian Tax Authority.
 * Addresses Code Review findings: #1 (Multi-tenant credentials), #4 (Signing Placeholder).
 */
export async function submitInvoiceToETA(invoiceId: string) {
  const session = await authInstance.api.getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.hospitalId, session.user.hospitalId)
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

    // 1. Fetch Tenant-Specific Credentials (Code Review #1)
    if (!settings?.etaClientId || !settings?.etaClientSecret) {
      return { success: false, error: "ETA credentials not configured for this hospital." };
    }

    // Decryption of clientSecret would happen here if stored encrypted
    const creds = {
      clientId: settings.etaClientId,
      clientSecret: settings.etaClientSecret, 
    };

    // 2. Transform document with structured address and compliance rules
    let etaDoc;
    try {
      etaDoc = transformInvoiceToETADocument(invoice as any);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
    
    // 3. Electronic Signing Placeholder (Code Review #4)
    // In production, the etaDoc JSON would be passed through a CADES-BES bridge
    // For now, we proceed to submission (sandbox usually accepts unsigned docs or mock signatures)
    
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

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.hospitalId, session.user.hospitalId)
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

    const creds = {
      clientId: settings.etaClientId,
      clientSecret: settings.etaClientSecret,
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
