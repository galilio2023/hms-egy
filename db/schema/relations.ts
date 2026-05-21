import { relations } from "drizzle-orm";
import { hospitals, hospitalSettings, departments, staff, operatingRooms, orBlocks, orBlockOverrides } from "./core";
import { patients, patientConsents } from "./patients";
import { rooms, beds, appointments, waitingList, admissions, dischargeSummaries, medicalRecords, vitalsFlowsheet } from "./clinical";
import { housekeepingTasks } from "./housekeeping";
import { medications, prescriptions, prescriptionItems, stockTransactions } from "./pharmacy";
import { labTests, labOrders, labOrderItems, criticalValueAlerts } from "./laboratory";
import { radiologyOrders, radiologyReports } from "./radiology";
import { invoices, invoiceItems, payments, insuranceClaims, onlinePayments, paymentReminders } from "./billing";
import { surgicalCases, surgicalChecklistTemplates, surgicalChecklists, anesthesiaRecords } from "./surgical";
import { notifications, documents, auditLogs, aiAuditLogs, sentReminders } from "./system";

// hospitals Relations
export const hospitalsRelations = relations(hospitals, ({ one, many }) => ({
  settings: one(hospitalSettings, {
    fields: [hospitals.id],
    references: [hospitalSettings.hospitalId],
  }),
  departments: many(departments),
  staff: many(staff),
  operatingRooms: many(operatingRooms),
  patients: many(patients),
  appointments: many(appointments),
  admissions: many(admissions),
  invoices: many(invoices),
  onlinePayments: many(onlinePayments),
  surgicalCases: many(surgicalCases),
}));

// hospitalSettings Relations

export const hospitalSettingsRelations = relations(hospitalSettings, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [hospitalSettings.hospitalId],
    references: [hospitals.id],
  }),
}));

// staff Relations
export const staffRelations = relations(staff, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [staff.hospitalId],
    references: [hospitals.id],
  }),
  orBlocks: many(orBlocks),
  leadSurgCases: many(surgicalCases, { relationName: "leadSurgeon" }),
  anesCases: many(surgicalCases, { relationName: "anesthesiologist" }),
}));

// patients Relations
export const patientsRelations = relations(patients, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [patients.hospitalId],
    references: [hospitals.id],
  }),
  consents: many(patientConsents),
  appointments: many(appointments),
  admissions: many(admissions),
  medicalRecords: many(medicalRecords),
  vitals: many(vitalsFlowsheet),
  invoices: many(invoices),
  surgicalCases: many(surgicalCases),
}));

// rooms Relations
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [rooms.hospitalId],
    references: [hospitals.id],
  }),
  beds: many(beds),
}));

// beds Relations
export const bedsRelations = relations(beds, ({ one, many }) => ({
  room: one(rooms, {
    fields: [beds.roomId],
    references: [rooms.id],
  }),
  admissions: many(admissions),
  housekeepingTasks: many(housekeepingTasks),
}));

// admissions Relations
export const admissionsRelations = relations(admissions, ({ one }) => ({
  patient: one(patients, {
    fields: [admissions.patientId],
    references: [patients.id],
  }),
  bed: one(beds, {
    fields: [admissions.bedId],
    references: [beds.id],
  }),
  doctor: one(staff, {
    fields: [admissions.admittingDoctorId],
    references: [staff.id],
  }),
  dischargeSummary: one(dischargeSummaries, {
    fields: [admissions.id],
    references: [dischargeSummaries.admissionId],
  }),
}));

// dischargeSummaries Relations
export const dischargeSummariesRelations = relations(dischargeSummaries, ({ one }) => ({
  admission: one(admissions, {
    fields: [dischargeSummaries.admissionId],
    references: [admissions.id],
  }),
  doctor: one(staff, {
    fields: [dischargeSummaries.dischargingDoctorId],
    references: [staff.id],
  }),
}));

// appointments Relations
export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(staff, {
    fields: [appointments.doctorId],
    references: [staff.id],
  }),
  department: one(departments, {
    fields: [appointments.departmentId],
    references: [departments.id],
  }),
}));

// surgicalCases Relations
export const surgicalCasesRelations = relations(surgicalCases, ({ one, many }) => ({
  patient: one(patients, {
    fields: [surgicalCases.patientId],
    references: [patients.id],
  }),
  operatingRoom: one(operatingRooms, {
    fields: [surgicalCases.orRoomId],
    references: [operatingRooms.id],
  }),
  leadSurgeon: one(staff, {
    fields: [surgicalCases.leadSurgeonId],
    references: [staff.id],
    relationName: "leadSurgeon",
  }),
  anesthesiologist: one(staff, {
    fields: [surgicalCases.anesthesiologistId],
    references: [staff.id],
    relationName: "anesthesiologist",
  }),
  checklists: many(surgicalChecklists),
  anesthesiaRecord: one(anesthesiaRecords, {
    fields: [surgicalCases.id],
    references: [anesthesiaRecords.surgicalCaseId],
  }),
}));

// surgicalChecklists Relations
export const surgicalChecklistsRelations = relations(surgicalChecklists, ({ one }) => ({
  surgicalCase: one(surgicalCases, {
    fields: [surgicalChecklists.surgicalCaseId],
    references: [surgicalCases.id],
  }),
  template: one(surgicalChecklistTemplates, {
    fields: [surgicalChecklists.templateId],
    references: [surgicalChecklistTemplates.id],
  }),
}));

// anesthesiaRecords Relations
export const anesthesiaRecordsRelations = relations(anesthesiaRecords, ({ one }) => ({
  surgicalCase: one(surgicalCases, {
    fields: [anesthesiaRecords.surgicalCaseId],
    references: [surgicalCases.id],
  }),
  anesthesiologist: one(staff, {
    fields: [anesthesiaRecords.anesthesiologistId],
    references: [staff.id],
  }),
  patient: one(patients, {
    fields: [anesthesiaRecords.patientId],
    references: [patients.id],
  }),
}));

// housekeepingTasks Relations
export const housekeepingTasksRelations = relations(housekeepingTasks, ({ one }) => ({
  bed: one(beds, {
    fields: [housekeepingTasks.bedId],
    references: [beds.id],
  }),
  room: one(rooms, {
    fields: [housekeepingTasks.roomId],
    references: [rooms.id],
  }),
  assignedStaff: one(staff, {
    fields: [housekeepingTasks.assignedTo],
    references: [staff.id],
  }),
}));

// prescriptions Relations
export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
  doctor: one(staff, {
    fields: [prescriptions.doctorId],
    references: [staff.id],
  }),
  items: many(prescriptionItems),
}));

// prescriptionItems Relations
export const prescriptionItemsRelations = relations(prescriptionItems, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionItems.prescriptionId],
    references: [prescriptions.id],
  }),
  medication: one(medications, {
    fields: [prescriptionItems.medicationId],
    references: [medications.id],
  }),
}));

// labOrders Relations
export const labOrdersRelations = relations(labOrders, ({ one, many }) => ({
  patient: one(patients, {
    fields: [labOrders.patientId],
    references: [patients.id],
  }),
  doctor: one(staff, {
    fields: [labOrders.doctorId],
    references: [staff.id],
  }),
  items: many(labOrderItems),
}));

// labOrderItems Relations
export const labOrderItemsRelations = relations(labOrderItems, ({ one }) => ({
  order: one(labOrders, {
    fields: [labOrderItems.labOrderId],
    references: [labOrders.id],
  }),
  test: one(labTests, {
    fields: [labOrderItems.labTestId],
    references: [labTests.id],
  }),
}));

// radiologyOrders Relations
export const radiologyOrdersRelations = relations(radiologyOrders, ({ one }) => ({
  patient: one(patients, {
    fields: [radiologyOrders.patientId],
    references: [patients.id],
  }),
  doctor: one(staff, {
    fields: [radiologyOrders.doctorId],
    references: [staff.id],
  }),
  report: one(radiologyReports, {
    fields: [radiologyOrders.id],
    references: [radiologyReports.radiologyOrderId],
  }),
}));

// radiologyReports Relations
export const radiologyReportsRelations = relations(radiologyReports, ({ one }) => ({
  order: one(radiologyOrders, {
    fields: [radiologyReports.radiologyOrderId],
    references: [radiologyOrders.id],
  }),
  radiologist: one(staff, {
    fields: [radiologyReports.radiologistId],
    references: [staff.id],
  }),
}));

// invoices Relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
  onlinePayments: many(onlinePayments),
}));

// invoiceItems Relations
export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

// onlinePayments Relations
export const onlinePaymentsRelations = relations(onlinePayments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [onlinePayments.invoiceId],
    references: [invoices.id],
  }),
  patient: one(patients, {
    fields: [onlinePayments.patientId],
    references: [patients.id],
  }),
}));
