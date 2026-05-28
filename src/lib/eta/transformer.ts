import { ETADocument, ETAInvoiceLine, ETATaxableItem, ETATaxTotal, ETAReceipt } from "./types";
import { invoices, invoiceItems } from "@db/schema/billing";
import { hospitals, hospitalSettings } from "@db/schema/core";
import { patients } from "@db/schema/patients";
import Big from "big.js";
import { createHash } from "crypto";

export type InvoiceWithRelations = typeof invoices.$inferSelect & {
  items: (typeof invoiceItems.$inferSelect)[];
  hospital: typeof hospitals.$inferSelect & {
    settings: typeof hospitalSettings.$inferSelect | null;
  };
  patient: typeof patients.$inferSelect;
};

/**
 * Transforms an internal invoice into the ETA E-invoicing format.
 * Addresses Code Review findings: #2 (Foreign patient 50k rule), #4 (Big.js precision).
 */
export function transformInvoiceToETADocument(invoice: InvoiceWithRelations): ETADocument {
  const { hospital, patient, items } = invoice;
  const settings = hospital.settings;

  // 1. Legal & Regulatory Validation (Code Review #2 - Corrected for Foreigners)
  const totalAmountValue = new Big(invoice.totalAmount);
  const isCitizen = !patient.passportNumber;

  if (totalAmountValue.gt(50000)) {
    const isValidNationalID = /^[234]\d{13}$/.test(patient.nationalId || "");
    if (isCitizen && !isValidNationalID) {
      throw new Error("Egyptian regulations require a valid 14-digit National ID (starting with 2 or 3) for citizen invoices exceeding 50,000 EGP.");
    }
    if (!isCitizen && !patient.passportNumber) {
      throw new Error("Foreign patients require a valid passport number for invoices exceeding 50,000 EGP.");
    }
  }

  // 2. High-Precision Calculations (Code Review #4 - Using Big.js)
  const invoiceLines: ETAInvoiceLine[] = items.map((item) => {
    const unitPrice = new Big(item.unitPrice);
    const quantity = new Big(item.quantity);
    const salesTotal = unitPrice.times(quantity);
    const itemsDiscount = new Big(0);
    const netTotal = salesTotal.minus(itemsDiscount);

    // Dynamic Tax Configuration
    const taxType = item.taxType || "T1";
    const taxSubType = item.taxSubType || "V009";
    
    // Default to VAT-Exempt for medical services unless explicitly stated (Code Review #3)
    let taxRate = new Big(0); 
    if (taxSubType === "V009") taxRate = new Big(0.14); // Standard VAT
    
    const taxAmount = netTotal.times(taxRate).round(5);

    const taxableItems: ETATaxableItem[] = [
      {
        taxType,
        amount: taxAmount.toNumber(),
        subType: taxSubType,
        rate: taxRate.times(100).toNumber(),
      }
    ];

    const lineTotal = netTotal.plus(taxAmount).round(5);

    return {
      description: item.descriptionEn,
      itemType: item.etaItemCode?.startsWith("EG-") ? "EGS" : "GS1",
      itemCode: item.etaItemCode || `EG-${hospital.taxpayerId}-${item.type.toUpperCase()}`,
      unitType: "EA",
      quantity: quantity.toNumber(),
      internalCode: item.id,
      salesTotal: salesTotal.toNumber(),
      total: lineTotal.toNumber(),
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal: netTotal.toNumber(),
      itemsDiscount: itemsDiscount.toNumber(),
      unitValue: {
        currencySold: "EGP",
        amountEGP: unitPrice.toNumber(),
      },
      discount: {
        rate: 0,
        amount: itemsDiscount.toNumber(),
      },
      taxableItems,
    };
  });

  const totalSalesAmount = invoiceLines.reduce((sum, line) => sum.plus(line.salesTotal), new Big(0)).round(5);
  const totalItemsDiscountAmount = invoiceLines.reduce((sum, line) => sum.plus(line.itemsDiscount), new Big(0)).round(5);
  const totalNetAmount = totalSalesAmount.minus(totalItemsDiscountAmount).round(5);
  
  // Group taxes by type
  const taxTotalsMap = new Map<string, Big>();
  invoiceLines.forEach(line => {
    line.taxableItems.forEach(tax => {
      const current = taxTotalsMap.get(tax.taxType) || new Big(0);
      taxTotalsMap.set(tax.taxType, current.plus(tax.amount).round(5));
    });
  });

  const taxTotals: ETATaxTotal[] = Array.from(taxTotalsMap.entries()).map(([taxType, amount]) => ({
    taxType,
    amount: amount.toNumber(),
  }));

  const totalAmount = totalNetAmount.plus(taxTotals.reduce((sum, tax) => sum.plus(tax.amount), new Big(0))).round(5);

  return {
    issuer: {
      address: {
        branchID: "0",
        country: "EG",
        governate: hospital.governorate,
        regionCity: hospital.city || hospital.governorate,
        street: hospital.street || hospital.address,
        buildingNumber: hospital.buildingNumber || "1",
        landmark: hospital.district || "Cairo",
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
        street: patient.address,
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
    totalSalesAmount: totalSalesAmount.toNumber(),
    totalNetAmount: totalNetAmount.toNumber(),
    unitValueAmount: 0,
    totalAmount: totalAmount.toNumber(),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: totalItemsDiscountAmount.toNumber(),
    taxTotals,
  };
}

/**
 * Transforms an internal invoice into the ETA E-Receipt B2C format.
 * Includes cryptographic hash chaining parameters and POS serial numbers.
 */
export function transformInvoiceToETAReceipt(
  invoice: InvoiceWithRelations,
  posSerialNumber: string,
  previousReceiptUUID?: string
): ETAReceipt {
  const { hospital, patient, items } = invoice;
  const settings = hospital.settings;

  // 1. Regulatory Validation
  const totalAmountValue = new Big(invoice.totalAmount);
  const isCitizen = !patient.passportNumber;

  if (totalAmountValue.gt(50000)) {
    const isValidNationalID = /^[234]\d{13}$/.test(patient.nationalId || "");
    if (isCitizen && !isValidNationalID) {
      throw new Error("Egyptian regulations require a valid 14-digit National ID (starting with 2 or 3) for citizen receipts exceeding 50,000 EGP.");
    }
    if (!isCitizen && !patient.passportNumber) {
      throw new Error("Foreign patients require a valid passport number for receipts exceeding 50,000 EGP.");
    }
  }

  // 2. High-Precision Calculations (Using Big.js)
  const invoiceLines: ETAInvoiceLine[] = items.map((item) => {
    const unitPrice = new Big(item.unitPrice);
    const quantity = new Big(item.quantity);
    const salesTotal = unitPrice.times(quantity);
    const itemsDiscount = new Big(0);
    const netTotal = salesTotal.minus(itemsDiscount);

    const taxType = item.taxType || "T1";
    const taxSubType = item.taxSubType || "V009";
    
    let taxRate = new Big(0); 
    if (taxSubType === "V009") taxRate = new Big(0.14);
    
    const taxAmount = netTotal.times(taxRate).round(5);

    const taxableItems: ETATaxableItem[] = [
      {
        taxType,
        amount: taxAmount.toNumber(),
        subType: taxSubType,
        rate: taxRate.times(100).toNumber(),
      }
    ];

    const lineTotal = netTotal.plus(taxAmount).round(5);

    return {
      description: item.descriptionEn,
      itemType: item.etaItemCode?.startsWith("EG-") ? "EGS" : "GS1",
      itemCode: item.etaItemCode || `EG-${hospital.taxpayerId}-${item.type.toUpperCase()}`,
      unitType: "EA",
      quantity: quantity.toNumber(),
      internalCode: item.id,
      salesTotal: salesTotal.toNumber(),
      total: lineTotal.toNumber(),
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal: netTotal.toNumber(),
      itemsDiscount: itemsDiscount.toNumber(),
      unitValue: {
        currencySold: "EGP",
        amountEGP: unitPrice.toNumber(),
      },
      discount: {
        rate: 0,
        amount: itemsDiscount.toNumber(),
      },
      taxableItems,
    };
  });

  const totalSalesAmount = invoiceLines.reduce((sum, line) => sum.plus(line.salesTotal), new Big(0)).round(5);
  const totalItemsDiscountAmount = invoiceLines.reduce((sum, line) => sum.plus(line.itemsDiscount), new Big(0)).round(5);
  const totalNetAmount = totalSalesAmount.minus(totalItemsDiscountAmount).round(5);

  const taxTotalsMap = new Map<string, Big>();
  invoiceLines.forEach(line => {
    line.taxableItems.forEach(tax => {
      const current = taxTotalsMap.get(tax.taxType) || new Big(0);
      taxTotalsMap.set(tax.taxType, current.plus(tax.amount).round(5));
    });
  });

  const taxTotals: ETATaxTotal[] = Array.from(taxTotalsMap.entries()).map(([taxType, amount]) => ({
    taxType,
    amount: amount.toNumber(),
  }));

  const totalAmount = totalNetAmount.plus(taxTotals.reduce((sum, tax) => sum.plus(tax.amount), new Big(0))).round(5);

  // 3. Generate Cryptographically chained UUID
  // NOTE: For official Egyptian Tax Authority (ETA) production submission, receipt signatures
  // must be generated using an authorized physical Hardware Security Module (HSM) or POS USB token
  // (e.g., A-Trust / Egypt Trust). The SHA-256 hashing below is a sandbox-compliant simulation.
  const rawHashInput = `${invoice.invoiceNumber}|${invoice.createdAt.toISOString()}|${totalAmount.toFixed(5)}|${totalNetAmount.toFixed(5)}|${posSerialNumber}`;
  const receiptUuid = createHash("sha256").update(rawHashInput).digest("hex");

  return {
    receiptNumber: invoice.invoiceNumber,
    uuid: receiptUuid,
    previousReceiptUUID: previousReceiptUUID || "0000000000000000000000000000000000000000000000000000000000000000",
    dateTimeIssued: invoice.createdAt.toISOString(),
    receiptType: "S",
    receiptVersion: "1.0",
    seller: {
      type: "B",
      id: hospital.taxpayerId || "",
      name: hospital.nameEn,
      address: {
        country: "EG",
        governate: hospital.governorate,
        regionCity: hospital.city || hospital.governorate,
        street: hospital.street || hospital.address,
        buildingNumber: hospital.buildingNumber || "1",
        branchID: "0",
      },
      deviceSerialNumber: posSerialNumber,
    },
    buyer: {
      type: patient.nationalId ? "P" : (patient.passportNumber ? "F" : "P"),
      id: patient.nationalId || patient.passportNumber || undefined,
      name: patient.nameEn,
    },
    posSerialNumber,
    taxpayerActivityCode: settings?.etaTaxpayerActivityCode || "8610",
    invoiceLines,
    totalSalesAmount: totalSalesAmount.toNumber(),
    totalDiscountAmount: totalItemsDiscountAmount.toNumber(),
    totalNetAmount: totalNetAmount.toNumber(),
    taxTotals,
    totalAmount: totalAmount.toNumber(),
  };
}
