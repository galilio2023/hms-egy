/**
 * HMS Egypt - Surgical Type Definitions
 */

export type SurgicalCaseStatus = "scheduled" | "pre_op" | "in_progress" | "post_op" | "completed" | "cancelled" | "postponed";
export type AnesthesiaType = "general" | "regional" | "local" | "sedation" | "spinal" | "epidural";

export interface SurgicalCase {
  id: string;
  caseNumber: string; // SC-{YYYY}-{NNNNNN}
  hospitalId: string;
  patientId: string;
  orRoomId: string;
  leadSurgeonId: string;
  assistantSurgeonIds: string[];
  anesthesiologistId?: string;
  scrubNurseId?: string;
  procedureNameAr: string;
  procedureNameEn: string;
  cptCode?: string;
  scheduledAt: Date;
  estimatedDuration: number; // minutes
  status: SurgicalCaseStatus;
  anesthesiaType: AnesthesiaType;
  asaClass?: string;
  bloodLossML?: number;
  complications?: string;
  notes?: string;
}

export interface AnesthesiaRecord {
  id: string;
  surgicalCaseId: string;
  anesthesiologistId: string;
  inductionAgents: string[];
  maintenanceAgents: string[];
  intubationType?: string;
  vitalsTrend: {
    time: Date;
    bp: string;
    hr: number;
    spo2: number;
  }[];
}

export interface SurgicalChecklist {
  id: string;
  surgicalCaseId: string;
  phase: "pre_op" | "time_out" | "sign_out";
  items: {
    id: string;
    itemAr: string;
    status: "pending" | "completed" | "not_applicable";
    initialsBy?: string;
  }[];
}
