"use server";

import { db } from "@/lib/db";
import { invoices } from "@/db/schema/billing";
import { eq, and } from "drizzle-orm";
import { etaClient } from "@/lib/eta/client";
import { transformInvoiceToETADocument } from "@/lib/eta/transformer";
import { authInstance } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function submitInvoiceToETA(invoiceId: string) {
  const session = await authInstance.api.getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Permission check could be added here using hasPermission

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.hospitalId, session.user.hospitalId)
      ),
      with: {
        hospital: true,
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

    if (!invoice.hospital.taxpayerId) {
      return { success: false, error: "Hospital taxpayer ID not configured" };
    }

    const etaDoc = transformInvoiceToETADocument(invoice as any);
    
    // In a real scenario, we would sign the document here
    // For sandbox/demo, we submit it as is or with a mock signature if needed
    
    const response = await etaClient.submitDocuments([etaDoc]);

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
    });

    if (!invoice || !invoice.etaUuid) {
      return { success: false, error: "Invoice not submitted to ETA" };
    }

    const details = await etaClient.getDocument(invoice.etaUuid);
    
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
