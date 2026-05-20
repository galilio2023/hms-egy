/**
 * HMS Egypt - Billing & Payment Type Definitions
 */

export interface Invoice {
  id: string;
  hospitalId: string;
  patientId: string;
  admissionId?: string;
  appointmentId?: string;
  status: "pending" | "paid" | "partial" | "cancelled";
  totalAmount: number;
  paidAmount: number;
  vatAmount: number;
  items: InvoiceItem[];
  dueDate: Date;
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  descriptionAr: string;
  descriptionEn: string;
  unitPrice: number;
  quantity: number;
  total: number;
  cptCode?: string;
}

export interface OnlinePayment {
  id: string;
  hospitalId: string;
  invoiceId: string;
  patientId: string;
  amount: number;
  method: "card" | "vodafone_cash" | "fawry" | "instapay";
  status: "initiated" | "pending" | "paid" | "failed" | "refunded";
  paymobOrderId?: string;
  paymobTransactionId?: string;
}
