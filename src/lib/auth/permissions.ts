import { type User } from "@/types/auth-api.types";

/**
 * HMS Egypt - Fine-Grained Permissions Enum
 */
export type Permission =
  | "patients:view"
  | "patients:create"
  | "patients:edit"
  | "patients:delete"
  | "medical_records:view"
  | "medical_records:create"
  | "medical_records:edit"
  | "admissions:view"
  | "admissions:create"
  | "admissions:edit"
  | "appointments:view"
  | "appointments:create"
  | "appointments:edit"
  | "appointments:cancel"
  | "prescriptions:view"
  | "prescriptions:create"
  | "prescriptions:dispense"
  | "lab_orders:view"
  | "lab_orders:create"
  | "lab_orders:update_results"
  | "radiology:view"
  | "radiology:create"
  | "radiology:update_results"
  | "billing:view"
  | "billing:create"
  | "billing:payment"
  | "surgical:view"
  | "surgical:create"
  | "surgical:edit"
  | "surgical:checklist"
  | "surgical:anesthesia"
  | "housekeeping:view"
  | "housekeeping:update"
  | "settings:view"
  | "settings:edit"
  | "ai_features:use"
  | "super_admin:access";

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "NURSE"
  | "OR_NURSE"
  | "PHARMACIST"
  | "LAB_TECH"
  | "RECEPTIONIST"
  | "HOUSEKEEPING";

/**
 * Permission context used to validate resource ownership or assignment.
 */
export interface PermissionContext {
  hospitalId?: string;
  leadSurgeonId?: string;
  anesthesiologistId?: string;
  scrubNurseId?: string;
  circulatingNurseId?: string;
  assignedHousekeeperId?: string;
}

/**
 * Static Role to Permission Mapping
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "super_admin:access"
  ],
  
  ADMIN: [
    "patients:view", "patients:create", "patients:edit", "patients:delete",
    "medical_records:view", "medical_records:create", "medical_records:edit",
    "admissions:view", "admissions:create", "admissions:edit",
    "appointments:view", "appointments:create", "appointments:edit", "appointments:cancel",
    "prescriptions:view", "prescriptions:create", "prescriptions:dispense",
    "lab_orders:view", "lab_orders:create", "lab_orders:update_results",
    "radiology:view", "radiology:create", "radiology:update_results",
    "billing:view", "billing:create", "billing:payment",
    "surgical:view", "surgical:create", "surgical:edit", "surgical:checklist", "surgical:anesthesia",
    "housekeeping:view", "housekeeping:update",
    "settings:view", "settings:edit",
    "ai_features:use"
  ],
  
  DOCTOR: [
    "patients:view", "patients:create", "patients:edit",
    "medical_records:view", "medical_records:create", "medical_records:edit",
    "admissions:view", "admissions:create", "admissions:edit",
    "appointments:view", "appointments:create", "appointments:edit", "appointments:cancel",
    "prescriptions:view", "prescriptions:create",
    "lab_orders:view", "lab_orders:create",
    "radiology:view", "radiology:create",
    "ai_features:use"
  ],
  
  SURGEON: [
    "patients:view",
    "medical_records:view", "medical_records:create",
    "appointments:view",
    "surgical:view", "surgical:create", "surgical:edit", "surgical:checklist",
    "ai_features:use"
  ],
  
  ANESTHESIOLOGIST: [
    "patients:view",             // View patients in their hospital
    "medical_records:view",      // Read-only
    "admissions:view",           // Read-only
    "surgical:view",             // View scheduled or assigned surgeries in their hospital
    "surgical:anesthesia",       // Write-access for own anesthesia records (restricted in hasPermission)
    "ai_features:use"
  ],
  
  NURSE: [
    "patients:view",
    "medical_records:view", "medical_records:create", // Vitals, shift records, assessments
    "admissions:view",
    "appointments:view",
    "prescriptions:view",        // View medications to administer
    "housekeeping:view"
  ],
  
  OR_NURSE: [
    "patients:view",
    "medical_records:view",
    "surgical:view",             // View scheduled or assigned surgeries
    "surgical:checklist"         // Fill pre-op/intra-op/post-op safety checklists
  ],
  
  PHARMACIST: [
    "patients:view",
    "prescriptions:view", "prescriptions:dispense"
  ],
  
  LAB_TECH: [
    "patients:view",
    "lab_orders:view", "lab_orders:update_results"
  ],
  
  RECEPTIONIST: [
    "patients:view", "patients:create", "patients:edit",
    "appointments:view", "appointments:create", "appointments:edit", "appointments:cancel",
    "billing:view", "billing:create", "billing:payment"
  ],
  
  HOUSEKEEPING: [
    "housekeeping:view",         // View tasks for current hospital
    "housekeeping:update"        // Update own assignments
  ]
};

/**
 * Checks if a user has a specific permission, evaluating static definitions
 * and complex context-aware ownership rules.
 * 
 * @param user The logged-in user session object
 * @param permission The permission slug to verify
 * @param context Dynamic context values (e.g. leadSurgeonId, anesthesiologistId) for fine-grained validation
 */
export function hasPermission(
  user: User | null,
  permission: Permission,
  context?: PermissionContext
): boolean {
  if (!user) return false;

  const userRole = user.role as Role;
  
  // 1. SUPER_ADMIN bypasses all hospital-specific constraints
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  // 2. Validate tenant isolation first
  if (context?.hospitalId && context.hospitalId !== user.hospitalId) {
    return false; // Cross-hospital security boundary breached
  }

  // 3. Look up static permissions list for user role
  const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];
  if (!allowedPermissions.includes(permission)) {
    return false;
  }

  // 4. Evaluate fine-grained, context-sensitive clinical rules
  
  // Rule A: Surgeon Constraints
  if (userRole === "SURGEON") {
    // Surgeons can view the overall schedule, but edit/create or checklist details require context checks
    if (permission === "surgical:edit" || permission === "surgical:checklist") {
      if (!context?.leadSurgeonId || context.leadSurgeonId !== user.id) {
        return false; // Fail closed if context or leadSurgeonId is missing or mismatching
      }
    }
  }

  // Rule B: Anesthesiologist Constraints
  if (userRole === "ANESTHESIOLOGIST") {
    // Anesthesiologists can view patients and surgeries in their hospital, but can only edit anesthesia details if assigned to the case
    if (permission === "surgical:anesthesia") {
      if (!context?.anesthesiologistId || context.anesthesiologistId !== user.id) {
        return false; // Fail closed if context or anesthesiologistId is missing or mismatching
      }
    }
  }

  // Rule C: OR Nurse Constraints
  if (userRole === "OR_NURSE") {
    // OR Nurses can update surgical checklists ONLY if assigned as scrub/circulating nurse
    if (permission === "surgical:checklist") {
      if (!context || (context.scrubNurseId !== user.id && context.circulatingNurseId !== user.id)) {
        return false; // Fail closed if context is missing or nurse is not assigned to the case
      }
    }
  }

  // Rule D: Housekeeping Constraints
  if (userRole === "HOUSEKEEPING") {
    // Housekeepers can update task status ONLY if they are the assigned housekeeper
    if (permission === "housekeeping:update") {
      if (!context?.assignedHousekeeperId || context.assignedHousekeeperId !== user.id) {
        return false; // Fail closed if context or assignedHousekeeperId is missing or mismatching
      }
    }
  }

  return true;
}
