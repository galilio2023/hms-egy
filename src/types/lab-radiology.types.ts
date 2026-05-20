/**
 * HMS Egypt - Lab & Radiology Type Definitions
 */

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  status: "requested" | "collected" | "in_progress" | "completed" | "cancelled";
  priority: "routine" | "urgent" | "stat";
  tests: LabTestItem[];
  createdAt: Date;
}

export interface LabTestItem {
  testId: string;
  loincCode?: string;
  result?: string;
  referenceRange?: string;
  unit?: string;
  isCritical: boolean;
  technicianId?: string;
  completedAt?: Date;
}

export interface RadiologyOrder {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  status: "requested" | "scheduled" | "completed" | "cancelled";
  modality: "xray" | "ct" | "mri" | "ultrasound" | "nuclear";
  procedureAr: string;
  procedureEn: string;
  pacsStudyId?: string;
  report?: string;
  radiologistId?: string;
  createdAt: Date;
}
