export interface ETADocument {
  issuer: {
    address: {
      branchID: string;
      country: string;
      governate: string;
      regionCity: string;
      street: string;
      buildingNumber: string;
      postalCode?: string;
      floor?: string;
      room?: string;
      landmark?: string;
      additionalInformation?: string;
    };
    type: string;
    id: string;
    name: string;
  };
  receiver: {
    address?: {
      country: string;
      governate?: string;
      regionCity?: string;
      street?: string;
      buildingNumber?: string;
      postalCode?: string;
      floor?: string;
      room?: string;
      landmark?: string;
      additionalInformation?: string;
    };
    type: string;
    id: string;
    name: string;
  };
  documentType: string;
  documentTypeVersion: string;
  dateTimeIssued: string;
  taxpayerActivityCode: string;
  internalID: string;
  purchaseOrderReference?: string;
  purchaseOrderDescription?: string;
  salesOrderReference?: string;
  salesOrderDescription?: string;
  proformaInvoiceNumber?: string;
  payment: {
    bankName?: string;
    bankAddress?: string;
    bankAccountNo?: string;
    bankAccountIBAN?: string;
    swiftCode?: string;
    terms?: string;
  };
  delivery?: {
    approach?: string;
    packaging?: string;
    dateValidity?: string;
    exportPort?: string;
    countryOfOrigin?: string;
    grossWeight?: number;
    netWeight?: number;
    terms?: string;
  };
  invoiceLines: ETAInvoiceLine[];
  totalDiscountAmount: number;
  totalSalesAmount: number;
  totalNetAmount: number;
  unitValueAmount: number;
  totalAmount: number;
  extraDiscountAmount: number;
  totalItemsDiscountAmount: number;
  taxTotals: ETATaxTotal[];
  signatures?: ETASignature[];
}

export interface ETAInvoiceLine {
  description: string;
  itemType: string; // GS1 or EGS
  itemCode: string;
  unitType: string;
  quantity: number;
  internalCode?: string;
  salesTotal: number;
  total: number;
  valueDifference: number;
  totalTaxableFees: number;
  netTotal: number;
  itemsDiscount: number;
  unitValue: {
    currencySold: string;
    amountEGP: number;
    amountSold?: number;
    currencyExchangeRate?: number;
  };
  discount: {
    rate: number;
    amount: number;
  };
  taxableItems: ETATaxableItem[];
}

export interface ETATaxableItem {
  taxType: string;
  amount: number;
  subType: string;
  rate: number;
}

export interface ETATaxTotal {
  taxType: string;
  amount: number;
}

export interface ETASignature {
  signatureType: string;
  value: string;
}

export interface ETASubmissionResponse {
  submissionId: string;
  acceptedDocuments: Array<{
    uuid: string;
    longId: string;
    internalId: string;
  }>;
  rejectedDocuments: Array<{
    internalId: string;
    error: {
      code: string;
      message: string;
      details?: any;
    };
  }>;
}

export interface ETATokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}
