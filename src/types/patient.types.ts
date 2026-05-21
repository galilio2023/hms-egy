/**
 * HMS Egypt - Patient Type Definitions
 */

export interface Patient {
  id: string;
  hospitalId: string;
  nationalId: string;
  fileNumber: string; // HMS-{HOSPITAL_CODE}-{YYYY}-{NNNNNN}
  nameAr: string;
  nameEn: string;
  dob: Date;
  gender: "male" | "female";
  governorate: string;
  address?: string;
  phone: string;
  email?: string;
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  insuranceProviderId?: string;
  insuranceNumber?: string;
  guardianName?: string;
  guardianNid?: string;
  guardianPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientConsent {
  id: string;
  patientId: string;
  hospitalId: string;
  type: "general" | "surgery" | "anesthesia" | "data_share" | "telemedicine";
  version: string;
  isSigned: boolean;
  signedAt?: Date;
  witnessId?: string;
}
