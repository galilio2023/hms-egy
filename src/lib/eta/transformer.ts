import { ETADocument, ETAInvoiceLine, ETATaxableItem, ETATaxTotal } from "./types";
import { invoices, invoiceItems } from "@/db/schema/billing";
import { hospitals } from "@/db/schema/core";
import { patients } from "@/db/schema/patients";

export type InvoiceWithRelations = typeof invoices.$inferSelect & {
  items: (typeof invoiceItems.$inferSelect)[];
  hospital: typeof hospitals.$inferSelect;
  patient: typeof patients.$inferSelect;
};

export function transformInvoiceToETADocument(invoice: InvoiceWithRelations): ETADocument {
  const { hospital, patient, items } = invoice;

  const invoiceLines: ETAInvoiceLine[] = items.map((item) => {
    const unitPrice = parseFloat(item.unitPrice);
    const quantity = item.quantity;
    const salesTotal = unitPrice * quantity;
    
    // For simplicity, we assume no item-level discount for now
    // In a real scenario, this would come from the item record
    const itemsDiscount = 0;
    const netTotal = salesTotal - itemsDiscount;

    // Calculate taxes for the item
    // Assuming 14% VAT for all items for now, or 0% if exempt
    // Medical services are often exempt but some items/pharmacy might have VAT
    const vatRate = 0.14; 
    const vatAmount = netTotal * vatRate;

    const taxableItems: ETATaxableItem[] = [
      {
        taxType: "T1", // Value Added Tax
        amount: vatAmount,
        subType: "V009", // Standard rate
        rate: vatRate * 100,
      }
    ];

    const lineTotal = netTotal + vatAmount;

    return {
      description: item.descriptionEn,
      itemType: "EGS", // Using EGS by default
      itemCode: `EG-${hospital.taxpayerId}-${item.type.toUpperCase()}`, // Placeholder logic for EGS code
      unitType: "EA", // Each
      quantity: quantity,
      internalCode: item.id,
      salesTotal: salesTotal,
      total: lineTotal,
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal: netTotal,
      itemsDiscount: itemsDiscount,
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

  const totalSalesAmount = invoiceLines.reduce((sum, line) => sum + line.salesTotal, 0);
  const totalItemsDiscountAmount = invoiceLines.reduce((sum, line) => sum + line.itemsDiscount, 0);
  const totalNetAmount = totalSalesAmount - totalItemsDiscountAmount;
  
  // Calculate aggregate tax totals
  const taxTotals: ETATaxTotal[] = [
    {
      taxType: "T1",
      amount: invoiceLines.reduce((sum, line) => sum + line.taxableItems[0].amount, 0),
    }
  ];

  const totalAmount = totalNetAmount + taxTotals.reduce((sum, tax) => sum + tax.amount, 0);

  return {
    issuer: {
      address: {
        branchID: "0", // Default branch
        country: "EG",
        governate: hospital.governorate,
        regionCity: hospital.governorate, // Map city if available
        street: hospital.address.split(",")[0] || "Street",
        buildingNumber: "1", // Map if available
      },
      type: "B", // Business
      id: hospital.taxpayerId || "",
      name: hospital.nameEn,
    },
    receiver: {
      address: {
        country: "EG",
        governate: patient.governorate,
        regionCity: patient.governorate,
        street: patient.address.split(",")[0] || "Street",
        buildingNumber: "1",
      },
      type: patient.nationalId ? "P" : "F", // Person or Foreigner
      id: patient.nationalId || patient.passportNumber || "",
      name: patient.nameEn,
    },
    documentType: "I", // Invoice
    documentTypeVersion: "1.0",
    dateTimeIssued: invoice.createdAt.toISOString(),
    taxpayerActivityCode: "8610", // Human health activities
    internalID: invoice.invoiceNumber,
    payment: {
      terms: "Immediate",
    },
    invoiceLines,
    totalDiscountAmount: 0,
    totalSalesAmount,
    totalNetAmount,
    unitValueAmount: 0, // Not used in V1.0 summary
    totalAmount,
    extraDiscountAmount: 0,
    totalItemsDiscountAmount,
    taxTotals,
  };
}
