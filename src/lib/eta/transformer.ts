import { ETADocument, ETAInvoiceLine, ETATaxableItem, ETATaxTotal } from "./types";
import { invoices, invoiceItems } from "@/db/schema/billing";
import { hospitals, hospitalSettings } from "@/db/schema/core";
import { patients } from "@/db/schema/patients";

export type InvoiceWithRelations = typeof invoices.$inferSelect & {
  items: (typeof invoiceItems.$inferSelect)[];
  hospital: typeof hospitals.$inferSelect & {
    settings: typeof hospitalSettings.$inferSelect | null;
  };
  patient: typeof patients.$inferSelect;
};

/**
 * Transforms an internal invoice into the ETA E-invoicing format.
 * Addresses Code Review findings: #2 (50k rule), #3 (Precision), #5B (Structured address).
 */
export function transformInvoiceToETADocument(invoice: InvoiceWithRelations): ETADocument {
  const { hospital, patient, items } = invoice;
  const settings = hospital.settings;

  // 1. Legal Validation (Code Review #2)
  const totalAmountValue = parseFloat(invoice.totalAmount);
  if (totalAmountValue > 50000 && !patient.nationalId) {
    throw new Error("Egyptian regulation requires a valid 14-digit National ID for invoices exceeding 50,000 EGP.");
  }

  // 2. High-Precision Calculations (Code Review #3)
  // We round to 5 decimal places as required by ETA APIs to prevent validation failures.
  const round = (num: number) => Math.round((num + Number.EPSILON) * 100000) / 100000;

  const invoiceLines: ETAInvoiceLine[] = items.map((item) => {
    const unitPrice = parseFloat(item.unitPrice);
    const quantity = item.quantity;
    const salesTotal = round(unitPrice * quantity);
    const itemsDiscount = 0;
    const netTotal = round(salesTotal - itemsDiscount);

    // Dynamic Tax Configuration (Code Review #6)
    const taxType = item.taxType || "T1";
    const taxSubType = item.taxSubType || "V009";
    
    // Medical consultations are often exempt (V002 or V018)
    // Here we use the sub-type from the DB which should be correctly configured per item type
    let taxRate = 0.14; // Default standard VAT
    if (taxSubType === "V002" || taxSubType === "V018") taxRate = 0;
    
    const taxAmount = round(netTotal * taxRate);

    const taxableItems: ETATaxableItem[] = [
      {
        taxType,
        amount: taxAmount,
        subType: taxSubType,
        rate: taxRate * 100,
      }
    ];

    const lineTotal = round(netTotal + taxAmount);

    return {
      description: item.descriptionEn,
      itemType: item.etaItemCode?.startsWith("EG-") ? "EGS" : "GS1",
      itemCode: item.etaItemCode || `EG-${hospital.taxpayerId}-${item.type.toUpperCase()}`,
      unitType: "EA",
      quantity: quantity,
      internalCode: item.id,
      salesTotal,
      total: lineTotal,
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal,
      itemsDiscount,
      unitValue: {
        currencySold: "EGP",
        amountEGP: unitPrice,
      },
      discount: {
        rate: 0,
        amount: itemsDiscount,
      },
      taxableItems,
    };
  });

  const totalSalesAmount = round(invoiceLines.reduce((sum, line) => sum + line.salesTotal, 0));
  const totalItemsDiscountAmount = round(invoiceLines.reduce((sum, line) => sum + line.itemsDiscount, 0));
  const totalNetAmount = round(totalSalesAmount - totalItemsDiscountAmount);
  
  // Group taxes by type
  const taxTotalsMap = new Map<string, number>();
  invoiceLines.forEach(line => {
    line.taxableItems.forEach(tax => {
      const current = taxTotalsMap.get(tax.taxType) || 0;
      taxTotalsMap.set(tax.taxType, round(current + tax.amount));
    });
  });

  const taxTotals: ETATaxTotal[] = Array.from(taxTotalsMap.entries()).map(([taxType, amount]) => ({
    taxType,
    amount,
  }));

  const totalAmount = round(totalNetAmount + taxTotals.reduce((sum, tax) => sum + tax.amount, 0));

  return {
    issuer: {
      address: {
        branchID: "0",
        country: "EG",
        governate: hospital.governorate,
        regionCity: hospital.city || hospital.governorate,
        street: hospital.street || hospital.address.split(",")[0],
        buildingNumber: hospital.buildingNumber || "1",
        landmark: hospital.district,
      },
      type: "B",
      id: hospital.taxpayerId || "",
      name: hospital.nameEn,
    },
    receiver: {
      address: {
        country: "EG",
        governate: patient.governorate,
        regionCity: patient.governorate,
        street: patient.address.split(",")[0],
        buildingNumber: "1",
      },
      type: patient.nationalId ? "P" : (patient.passportNumber ? "F" : "P"),
      id: patient.nationalId || patient.passportNumber || "",
      name: patient.nameEn,
    },
    documentType: "I",
    documentTypeVersion: "1.0",
    dateTimeIssued: invoice.createdAt.toISOString(),
    taxpayerActivityCode: settings?.etaTaxpayerActivityCode || "8610",
    internalID: invoice.invoiceNumber,
    payment: {
      terms: "Immediate",
    },
    invoiceLines,
    totalDiscountAmount: 0,
    totalSalesAmount,
    totalNetAmount,
    unitValueAmount: 0,
    totalAmount,
    extraDiscountAmount: 0,
    totalItemsDiscountAmount,
    taxTotals,
  };
}
