/**
 * HMS Egypt - Clinical Type Definitions
 */

import { Patient } from "./patient.types";

export type AppointmentStatus = "scheduled" | "confirmed" | "arrived" | "in_consultation" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  type: "consultation" | "follow_up" | "procedure" | "telemedicine";
  notes?: string;
  createdAt: Date;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  appointmentId?: string;
  admissionId?: string;
  complaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  icd10Codes: string[];
  plan: string;
  vitals: {
    temp?: number;
    bpSys?: number;
    bpDia?: number;
    hr?: number;
    rr?: number;
    spo2?: number;
    weight?: number;
    height?: number;
  };
  createdAt: Date;
}

export interface Admission {
  id: string;
  patientId: string;
  hospitalId: string;
  departmentId: string;
  roomId: string;
  bedId: string;
  admittedAt: Date;
  dischargedAt?: Date;
  status: "active" | "discharged" | "transferred";
  reason: string;
  attendingDoctorId: string;
}
