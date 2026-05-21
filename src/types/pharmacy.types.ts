/**
 * HMS Egypt - Pharmacy Type Definitions
 */

export interface Medication {
  id: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  category: string;
  dosageForm: string; // tablet, syrup, injection
  strength: string;
  unit: string;
  stockQuantity: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  medicalRecordId?: string;
  status: "pending" | "dispensed" | "cancelled";
  items: PrescriptionItem[];
  createdAt: Date;
}

export interface PrescriptionItem {
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructionsAr?: string;
  instructionsEn?: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "mild" | "moderate" | "severe" | "contraindicated";
  mechanismAr: string;
  clinicalEffectAr: string;
  managementAr: string;
}
