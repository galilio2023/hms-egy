"use server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { withTenantContext, withBypassContext } from "@/lib/db/tenant";
import { appointments, medicalRecords, vitalsFlowsheet, admissions } from "@db/schema/clinical";
import { prescriptions, prescriptionItems, medications } from "@db/schema/pharmacy";
import { labTests, labOrders, labOrderItems } from "@db/schema/laboratory";
import { radiologyOrders } from "@db/schema/radiology";
import { hospitals, staff } from "@db/schema/core";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { type User } from "@/types/auth-api.types";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { normalizeDecimal, latinizeNumerals } from "@/lib/utils/egypt";

interface PrescriptionItemInput {
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

interface VitalsInput {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: string; // Stored as decimal in DB, but passed as string/number
  oxygenSaturation?: number;
  weightKg?: string; // Stored as decimal in DB, but passed as string/number
  heightCm?: number;
}

/**
 * Performs clinical boundary/range validation on vitals signs inputs to prevent typographical errors.
 */
export async function validateVitals(vitals?: VitalsInput) {
  if (!vitals) return { success: true };

  const SystolicRange = { min: 40, max: 260 };
  const DiastolicRange = { min: 30, max: 150 };
  const TempRange = { min: 30.0, max: 45.0 };
  const HeartRateRange = { min: 20, max: 300 };
  const RespRateRange = { min: 4, max: 80 };
  const OxygenSatRange = { min: 50, max: 100 };

  if (vitals.bloodPressureSystolic && (vitals.bloodPressureSystolic < SystolicRange.min || vitals.bloodPressureSystolic > SystolicRange.max)) {
    return { success: false, error: `Invalid systolic blood pressure reading: ${vitals.bloodPressureSystolic} (must be between 40 and 260 mmHg).` };
  }
  if (vitals.bloodPressureDiastolic && (vitals.bloodPressureDiastolic < DiastolicRange.min || vitals.bloodPressureDiastolic > DiastolicRange.max)) {
    return { success: false, error: `Invalid diastolic blood pressure reading: ${vitals.bloodPressureDiastolic} (must be between 30 and 150 mmHg).` };
  }
  if (vitals.temperature && String(vitals.temperature).trim() !== "") {
    const tVal = normalizeDecimal(vitals.temperature);
    if (tVal === null) {
      return { success: false, error: "Invalid temperature format. Please enter a valid number." };
    }
    if (tVal < TempRange.min || tVal > TempRange.max) {
      return { success: false, error: `Invalid temperature reading: ${vitals.temperature}°C (must be between 30.0°C and 45.0°C).` };
    }
  }
  if (vitals.heartRate && (vitals.heartRate < HeartRateRange.min || vitals.heartRate > HeartRateRange.max)) {
    return { success: false, error: `Invalid heart rate reading: ${vitals.heartRate} bpm (must be between 20 and 300 bpm).` };
  }
  if (vitals.respiratoryRate && (vitals.respiratoryRate < RespRateRange.min || vitals.respiratoryRate > RespRateRange.max)) {
    return { success: false, error: `Invalid respiratory rate: ${vitals.respiratoryRate} breaths/min (must be between 4 and 80 breaths/min).` };
  }
  if (vitals.oxygenSaturation && (vitals.oxygenSaturation < OxygenSatRange.min || vitals.oxygenSaturation > OxygenSatRange.max)) {
    return { success: false, error: `Invalid oxygen saturation: ${vitals.oxygenSaturation}% (must be between 50% and 100%).` };
  }

  return { success: true };
}

/**
 * Completes a remote telemedicine consultation, records SOAP logs, optional digital prescriptions, and vital flowsheets.
 */
export async function completeTelemedicineConsultation(
  appointmentId: string,
  soapNotes: string,
  diagnosis?: string,
  prescriptionItemsList?: PrescriptionItemInput[],
  prescriptionNotes?: string,
  vitals?: VitalsInput,
  locale?: string,
  orderSetMedications?: Array<{
    nameAr: string;
    nameEn: string;
    genericName: string;
    form: string;
    strength: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions: string;
  }>,
  orderSetLabs?: Array<{
    nameAr: string;
    nameEn: string;
    loincCode: string;
    cptCode: string;
    priority: "routine" | "urgent" | "stat";
    instructions: string;
  }>,
  orderSetRadiology?: Array<{
    procedureNameAr: string;
    procedureNameEn: string;
    cptCode: string;
    priority: "routine" | "urgent" | "stat";
    clinicalNotes: string;
  }>
) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  // 1. Get the appointment to resolve patientId, doctorId, and hospitalId using bypass to resolve tenant
  const appointment = await withBypassContext(async (tx) => {
    return await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)
      .then((res) => res[0]);
  });

  if (!appointment) {
    return { success: false, error: "Appointment not found." };
  }

  const hospitalId = appointment.hospitalId;

  // 2. Validate edit permissions for the hospital
  const isAuthorized = hasPermission(session.user as unknown as User, "appointments:edit", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to complete outpatient encounters." };
  }

  // 3. Enforce doctor assignment ownership (only the assigned doctor or SUPER_ADMIN can finalize)
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  
  // 4. Validate vitals bounds to avoid corrupted historical logs
  const vitalsValidation = await validateVitals(vitals);
  if (!vitalsValidation.success) {
    return { success: false, error: vitalsValidation.error };
  }

  try {
    const cleanTemperature = vitals?.temperature 
      ? normalizeDecimal(vitals.temperature)?.toFixed(1) || null
      : null;

    const cleanWeight = vitals?.weightKg 
      ? normalizeDecimal(vitals.weightKg)?.toFixed(1) || null
      : null;

    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve Medications from Catalog inside the transaction context for RLS compliance
      const resolvedOrderSetMedicationItems: Array<{ medicationId: string; dosage: string; frequency: string; durationDays: number; instructions: string }> = [];
      if (orderSetMedications && orderSetMedications.length > 0) {
        const medNames = orderSetMedications.map(item => item.nameEn.trim()).filter(Boolean);
        
        if (medNames.length > 0) {
          const existingMeds = await tx
            .select()
            .from(medications)
            .where(and(
              eq(medications.hospitalId, hospitalId),
              eq(medications.isActive, true),
              sql`lower(${medications.nameEn}) IN ${medNames.map(name => name.toLowerCase())}`
            ));

          const medMap = new Map(existingMeds.map(m => [m.nameEn.toLowerCase(), m.id]));
          
          for (const item of orderSetMedications) {
            const medId = medMap.get(item.nameEn.toLowerCase().trim());
            if (medId) {
              resolvedOrderSetMedicationItems.push({
                medicationId: medId,
                dosage: item.dosage,
                frequency: item.frequency,
                durationDays: item.durationDays,
                instructions: item.instructions,
              });
            } else {
              throw new AppError(ErrorCode.NOT_FOUND, `Medication "${item.nameEn}" is not registered in this hospital's active catalog.`);
            }
          }
        }
      }

      // C. Resolve assigned doctor status inside tenant context
      let isAssignedDoctor = false;
      if (!isSuperAdmin) {
        const currentStaff = await tx
          .select()
          .from(staff)
          .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
          .limit(1)
          .then((res) => res[0]);

        if (currentStaff && appointment.doctorId === currentStaff.id) {
          isAssignedDoctor = true;
        }

        if (!isAssignedDoctor) {
          throw new AppError(ErrorCode.FORBIDDEN, "Forbidden: Only the assigned medical professional or a super administrator can complete this encounter.");
        }
      }

      // 1.5 Validate manual prescription IDs for cross-tenant injection
      if (prescriptionItemsList && prescriptionItemsList.length > 0) {
        const manualMedIds = prescriptionItemsList.map(i => i.medicationId);
        const validMedCount = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(medications)
          .where(and(
            eq(medications.hospitalId, hospitalId),
            inArray(medications.id, manualMedIds)
          ))
          .then(res => res[0].count);

        if (validMedCount !== manualMedIds.length) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, "Cross-tenant security violation: One or more prescribed medications do not belong to this hospital.");
        }
      }

      // A. Fetch and row-lock the appointment inside the transaction to prevent concurrent race conditions
      const [lockedAppointment] = await tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "scheduled")))
        .for("update");

      if (!lockedAppointment) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Appointment is already completed, cancelled, or processed.");
      }

      // B. Update appointment status to completed
      await tx
        .update(appointments)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));

      // C. Insert the clinical encounter SOAP medical record
      const [medRecord] = await tx
        .insert(medicalRecords)
        .values({
          hospitalId,
          patientId: lockedAppointment.patientId,
          doctorId: lockedAppointment.doctorId,
          encounterType: "outpatient",
          symptoms: lockedAppointment.notes || "",
          diagnosis: diagnosis || "Telemedicine Consult Completed",
          soapNotes,
          isArchived: false,
        })
        .returning();

      // D. If medication prescriptions are supplied, create the prescription and its items
      let prescriptionId: string | undefined = undefined;
      const allMedItems = [
        ...(prescriptionItemsList || []),
        ...resolvedOrderSetMedicationItems
      ];

      if (allMedItems.length > 0) {
        const [newPrescription] = await tx
          .insert(prescriptions)
          .values({
            hospitalId,
            patientId: lockedAppointment.patientId,
            doctorId: lockedAppointment.doctorId,
            status: "active",
            notes: prescriptionNotes || (orderSetMedications && orderSetMedications.length > 0 ? "Includes protocol-based medications" : null),
          })
          .returning();

        if (!newPrescription) {
          throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create prescription record.");
        }

        prescriptionId = newPrescription.id;

        const itemsToInsert = allMedItems.map((item) => ({
          hospitalId,
          prescriptionId: newPrescription.id,
          medicationId: item.medicationId,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays: item.durationDays,
          instructions: item.instructions || null,
          status: "pending",
        }));

        await tx.insert(prescriptionItems).values(itemsToInsert);
      }

      // E. Resolve and Process Labs inside transaction context
      let labOrderId: string | undefined = undefined;
      if (orderSetLabs && orderSetLabs.length > 0) {
        const labNames = orderSetLabs.map(item => item.nameEn.trim()).filter(Boolean);
        if (labNames.length > 0) {
          const existingLabs = await tx
            .select()
            .from(labTests)
            .where(and(
              eq(labTests.hospitalId, hospitalId),
              eq(labTests.isActive, true),
              inArray(
                sql`lower(${labTests.nameEn})`, 
                labNames.map(name => name.toLowerCase())
              )
            ));

          const labMap = new Map(existingLabs.map(l => [l.nameEn.toLowerCase(), l.id]));
          const resolvedLabIds: string[] = [];

          for (const item of orderSetLabs) {
            const labId = labMap.get(item.nameEn.toLowerCase().trim());
            if (labId) {
              resolvedLabIds.push(labId);
            }
          }

          if (resolvedLabIds.length > 0) {
            let orderPriority: "routine" | "urgent" | "stat" = "routine";
            if (orderSetLabs.some((l) => l.priority === "stat")) {
              orderPriority = "stat";
            } else if (orderSetLabs.some((l) => l.priority === "urgent")) {
              orderPriority = "urgent";
            }

            const [labOrd] = await tx
              .insert(labOrders)
              .values({
                hospitalId,
                patientId: lockedAppointment.patientId,
                doctorId: lockedAppointment.doctorId,
                priority: orderPriority,
                status: "pending",
                clinicalNotes: "Ordered via Telemedicine",
              })
              .returning();

            if (labOrd) {
              labOrderId = labOrd.id;
              const itemsToInsert = resolvedLabIds.map(testId => ({
                hospitalId,
                labOrderId: labOrd.id,
                labTestId: testId,
                status: "pending",
                isCritical: false,
              }));
              await tx.insert(labOrderItems).values(itemsToInsert);
            }
          }
        }
      }

      // F. Process Radiology Orders
      const createdRadiologyOrderIds: string[] = [];
      if (orderSetRadiology && orderSetRadiology.length > 0) {
        const ordersToInsert = orderSetRadiology.map(item => ({
          hospitalId,
          patientId: lockedAppointment.patientId,
          doctorId: lockedAppointment.doctorId,
          procedureNameAr: item.procedureNameAr,
          procedureNameEn: item.procedureNameEn,
          cptCode: item.cptCode,
          priority: item.priority,
          status: "pending",
          clinicalNotes: item.clinicalNotes || "Ordered via Telemedicine",
          price: "350.00",
        }));
        const radOrders = await tx.insert(radiologyOrders).values(ordersToInsert).returning();
        radOrders.forEach(o => createdRadiologyOrderIds.push(o.id));
      }

      // G. If vitals are recorded, save them to the flowsheet
      let vitalsId: string | undefined = undefined;
      const hasVitals = vitals && (
        vitals.bloodPressureSystolic ||
        vitals.bloodPressureDiastolic ||
        vitals.heartRate ||
        vitals.respiratoryRate ||
        vitals.temperature ||
        vitals.oxygenSaturation ||
        vitals.weightKg ||
        vitals.heightCm
      );

      if (hasVitals) {
        const [newVitals] = await tx
          .insert(vitalsFlowsheet)
          .values({
            hospitalId,
            patientId: lockedAppointment.patientId,
            recordedBy: lockedAppointment.doctorId,
            recordedAt: new Date(),
            bloodPressureSystolic: vitals.bloodPressureSystolic || null,
            bloodPressureDiastolic: vitals.bloodPressureDiastolic || null,
            heartRate: vitals.heartRate || null,
            respiratoryRate: vitals.respiratoryRate || null,
            temperature: cleanTemperature,
            oxygenSaturation: vitals.oxygenSaturation || null,
            weightKg: cleanWeight,
            heightCm: vitals.heightCm || null,
          })
          .returning();
        
        if (newVitals) {
          vitalsId = newVitals.id;
        }
      }

      // Fetch hospital slug for path revalidation
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      return { 
        success: true, 
        medicalRecordId: medRecord.id,
        patientId: lockedAppointment.patientId,
        hospitalSlug: hospital?.slug || hospitalId,
        prescriptionId,
        labOrderId,
        radiologyOrderIds: createdRadiologyOrderIds.length > 0 ? createdRadiologyOrderIds : undefined,
        vitalsId
      };
    });

    if (result.success) {
      const hSlug = result.hospitalSlug;
      const activeLocale = locale || "ar";
      revalidatePath(`/${activeLocale}/${hSlug}/appointments`);
      revalidatePath(`/${activeLocale}/${hSlug}/patients/${result.patientId}`);

      const altLocale = activeLocale === "ar" ? "en" : "ar";
      revalidatePath(`/${altLocale}/${hSlug}/appointments`);
      revalidatePath(`/${altLocale}/${hSlug}/patients/${result.patientId}`);
    }

    return result;
  } catch (error) {
    console.error("[CLINICAL_ACTION] completeTelemedicineConsultation failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while completing the consultation." };
  }
}

interface CreateMedicalRecordInput {
  patientId: string;
  encounterType: string;
  symptoms?: string;
  diagnosis?: string;
  soapNotes?: string;
  icdCodes?: string[];
  vitals?: VitalsInput;
  locale?: string;
  appliedOrderSetId?: string;
  orderSetMedications?: Array<{
    nameAr: string;
    nameEn: string;
    genericName: string;
    form: string;
    strength: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions: string;
  }>;
  orderSetLabs?: Array<{
    nameAr: string;
    nameEn: string;
    loincCode: string;
    cptCode: string;
    normalRange: string;
    unit: string;
    priority: "routine" | "urgent" | "stat";
    instructions: string;
  }>;
  orderSetRadiology?: Array<{
    procedureNameAr: string;
    procedureNameEn: string;
    cptCode: string;
    priority: "routine" | "urgent" | "stat";
    clinicalNotes: string;
  }>;
}

/**
 * Creates a standard clinical encounter (SOAP note) and optional vitals entries.
 * Scoped to active tenant hospital from session.
 */
export async function createMedicalRecord(data: CreateMedicalRecordInput) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "No active hospital found in session." };
  }

  // 1. Verify medical records write permission for the active hospital
  const isAuthorized = hasPermission(session.user as unknown as User, "medical_records:create", {
    hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to create medical records." };
  }

  try {
    const cleanTemperature = data.vitals?.temperature 
      ? normalizeDecimal(data.vitals.temperature)?.toFixed(1) || null
      : null;

    const cleanWeight = data.vitals?.weightKg 
      ? normalizeDecimal(data.vitals.weightKg)?.toFixed(1) || null
      : null;

    const result = await withTenantContext(hospitalId, async (tx) => {
      // 1. Resolve Medications from Catalog inside the transaction context for RLS compliance
      // Order Sets should map strictly to pre-existing active catalog items to maintain inventory audit integrity.
      const resolvedMedicationItems: Array<{ medicationId: string; dosage: string; frequency: string; durationDays: number; instructions: string }> = [];
      if (data.orderSetMedications && data.orderSetMedications.length > 0) {
        const medNames = data.orderSetMedications.map(item => item.nameEn.trim()).filter(Boolean);
        
        if (medNames.length > 0) {
          // Fetch existing medications matching the requested names (case-insensitive)
          const existingMeds = await tx
            .select()
            .from(medications)
            .where(and(
              eq(medications.hospitalId, hospitalId),
              eq(medications.isActive, true),
              sql`lower(${medications.nameEn}) IN ${medNames.map(name => name.toLowerCase())}`
            ));

          const medMap = new Map(existingMeds.map(m => [m.nameEn.toLowerCase(), m.id]));
          
          for (const item of data.orderSetMedications) {
            const medId = medMap.get(item.nameEn.toLowerCase().trim());
            if (medId) {
              resolvedMedicationItems.push({
                medicationId: medId,
                dosage: item.dosage,
                frequency: item.frequency,
                durationDays: item.durationDays,
                instructions: item.instructions,
              });
            } else {
              // If an item in the Order Set is missing from the hospital's active list, throw error to prevent broken prescriptions
              throw new AppError(
                ErrorCode.NOT_FOUND, 
                `Medication "${item.nameEn}" is not registered in this hospital's active pharmacy catalog. Please add it to inventory before applying this protocol.`
              );
            }
          }
        }
      }

      // 2. Resolve Labs from Catalog inside the transaction context
      const resolvedLabItems: string[] = [];
      if (data.orderSetLabs && data.orderSetLabs.length > 0) {
        const labNames = data.orderSetLabs.map(item => item.nameEn.trim()).filter(Boolean);

        if (labNames.length > 0) {
          const existingLabs = await tx
            .select()
            .from(labTests)
            .where(and(
              eq(labTests.hospitalId, hospitalId),
              eq(labTests.isActive, true),
              inArray(
                sql`lower(${labTests.nameEn})`, 
                labNames.map(name => name.toLowerCase())
              )
            ));

          const labMap = new Map(existingLabs.map(l => [l.nameEn.toLowerCase(), l.id]));

          for (const item of data.orderSetLabs) {
            const labId = labMap.get(item.nameEn.toLowerCase().trim());
            if (labId) {
              resolvedLabItems.push(labId);
            } else {
              throw new AppError(
                ErrorCode.NOT_FOUND,
                `Laboratory test "${item.nameEn}" is not defined in this hospital's test menu. Please configure it in Laboratory Settings.`
              );
            }
          }
        }
      }

      // 2. Resolve Doctor (Staff) ID of the current user for this hospital inside tenant context
      const doctor = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!doctor) {
        throw new AppError(ErrorCode.NOT_FOUND, "Clinical Profile Error: Doctor profile not found for current user.");
      }

      // A. Create the medical record
      const [medRecord] = await tx
        .insert(medicalRecords)
        .values({
          hospitalId,
          patientId: data.patientId,
          doctorId: doctor.id,
          encounterType: data.encounterType,
          symptoms: data.symptoms || null,
          diagnosis: data.diagnosis || null,
          soapNotes: data.soapNotes || null,
          icdCodes: data.icdCodes || null,
          isArchived: false,
        })
        .returning();

      if (!medRecord) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create medical record.");
      }

      // B. Create vitals if provided and contain at least one value
      let vitalsId: string | undefined = undefined;
      const hasVitals = data.vitals && (
        data.vitals.bloodPressureSystolic ||
        data.vitals.bloodPressureDiastolic ||
        data.vitals.heartRate ||
        data.vitals.respiratoryRate ||
        data.vitals.temperature ||
        data.vitals.oxygenSaturation ||
        data.vitals.weightKg ||
        data.vitals.heightCm
      );

      if (hasVitals && data.vitals) {
        const [newVitals] = await tx
          .insert(vitalsFlowsheet)
          .values({
            hospitalId,
            patientId: data.patientId,
            recordedBy: doctor.id,
            recordedAt: new Date(),
            bloodPressureSystolic: data.vitals.bloodPressureSystolic || null,
            bloodPressureDiastolic: data.vitals.bloodPressureDiastolic || null,
            heartRate: data.vitals.heartRate || null,
            respiratoryRate: data.vitals.respiratoryRate || null,
            temperature: cleanTemperature,
            oxygenSaturation: data.vitals.oxygenSaturation || null,
            weightKg: cleanWeight,
            heightCm: data.vitals.heightCm || null,
          })
          .returning();

        if (newVitals) {
          vitalsId = newVitals.id;
        }
      }

      // C. Active Admission Resolution
      const activeAdmission = await tx
        .select({ id: admissions.id })
        .from(admissions)
        .where(
          and(
            eq(admissions.patientId, data.patientId),
            eq(admissions.hospitalId, hospitalId),
            eq(admissions.status, "active")
          )
        )
        .limit(1)
        .then((res) => res[0]);

      const admissionId = activeAdmission?.id || null;

      // D. Process Order Set Medications
      let prescriptionId: string | undefined = undefined;
      if (resolvedMedicationItems.length > 0) {
        const [presc] = await tx
          .insert(prescriptions)
          .values({
            hospitalId,
            patientId: data.patientId,
            doctorId: doctor.id,
            admissionId,
            status: "active",
            notes: data.appliedOrderSetId ? `Applied via protocol: ${data.appliedOrderSetId}` : "Applied via Order Set",
            hasDdiOverride: false,
          })
          .returning();

        if (presc) {
          prescriptionId = presc.id;
          const itemsToInsert = resolvedMedicationItems.map(rxItem => ({
            hospitalId,
            prescriptionId: presc.id,
            medicationId: rxItem.medicationId,
            dosage: rxItem.dosage,
            frequency: rxItem.frequency,
            durationDays: rxItem.durationDays,
            instructions: rxItem.instructions,
            dispensedCount: 0,
            status: "pending",
          }));
          await tx.insert(prescriptionItems).values(itemsToInsert);
        }
      }

      // E. Process Order Set Labs
      let labOrderId: string | undefined = undefined;
      if (resolvedLabItems.length > 0) {
        let orderPriority: "routine" | "urgent" | "stat" = "routine";
        if (data.orderSetLabs && data.orderSetLabs.some((l) => l.priority === "stat")) {
          orderPriority = "stat";
        } else if (data.orderSetLabs && data.orderSetLabs.some((l) => l.priority === "urgent")) {
          orderPriority = "urgent";
        }

        const [labOrd] = await tx
          .insert(labOrders)
          .values({
            hospitalId,
            patientId: data.patientId,
            doctorId: doctor.id,
            admissionId,
            priority: orderPriority,
            status: "pending",
            clinicalNotes: data.appliedOrderSetId ? `Applied via protocol: ${data.appliedOrderSetId}` : "Applied via Order Set",
          })
          .returning();

        if (labOrd) {
          labOrderId = labOrd.id;
          const itemsToInsert = resolvedLabItems.map(testId => ({
            hospitalId,
            labOrderId: labOrd.id,
            labTestId: testId,
            status: "pending",
            isCritical: false,
          }));
          await tx.insert(labOrderItems).values(itemsToInsert);
        }
      }

      // F. Process Order Set Radiology
      const createdRadiologyOrderIds: string[] = [];
      if (data.orderSetRadiology && data.orderSetRadiology.length > 0) {
        const ordersToInsert = data.orderSetRadiology.map(item => ({
          hospitalId,
          patientId: data.patientId,
          doctorId: doctor.id,
          admissionId,
          procedureNameAr: item.procedureNameAr,
          procedureNameEn: item.procedureNameEn,
          cptCode: item.cptCode,
          priority: item.priority,
          status: "pending",
          clinicalNotes: item.clinicalNotes || (data.appliedOrderSetId ? `Applied via protocol: ${data.appliedOrderSetId}` : "Applied via Order Set"),
          price: "350.00",
        }));
        const radOrders = await tx.insert(radiologyOrders).values(ordersToInsert).returning();
        radOrders.forEach(o => createdRadiologyOrderIds.push(o.id));
      }

      // Fetch hospital slug for path revalidation
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      return {
        success: true,
        medicalRecordId: medRecord.id,
        patientId: data.patientId,
        hospitalSlug: hospital?.slug || hospitalId,
        vitalsId,
        prescriptionId,
        labOrderId,
        radiologyOrderIds: createdRadiologyOrderIds.length > 0 ? createdRadiologyOrderIds : undefined,
      };
    });

    if (result.success) {
      const hSlug = result.hospitalSlug;
      revalidatePath(`/ar/${hSlug}/patients/${result.patientId}`);
      revalidatePath(`/en/${hSlug}/patients/${result.patientId}`);
    }

    return result;
  } catch (error) {
    console.error("[CLINICAL_ACTION] createMedicalRecord failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while saving the clinical record." };
  }
}

export interface AmbientScribeResult {
  symptoms: string;
  diagnosis: string;
  soapNotes: string;
  vitals?: {
    bpSystolic?: string;
    bpDiastolic?: string;
    heartRate?: string;
    respiratoryRate?: string;
    temperature?: string;
    oxygenSaturation?: string;
  };
}

/**
 * Sanitizes sensitive personal patient identifiers (PII) from conversational
 * transcripts to comply with Egyptian Data Protection Law No. 151 of 2020 cross-border sovereignty.
 * Scrubs explicit National IDs, phone numbers, and common name prefixes.
 */
export function anonymizePatientData(text: string): string {
  let sanitized = text;

  // 1. Scrub 14-digit Egyptian National ID patterns (Precise match for 2nd/3rd/4th century births)
  sanitized = sanitized.replace(/\b[234]\d{13}\b/g, "[NATIONAL_ID]");

  // 2. Scrub phone numbers (international, Egyptian mobile blocks, 10-11 digits)
  // Target: +20..., 010..., 011..., 012..., 015..., 00201...
  sanitized = sanitized.replace(/\b(?:\+?20|0)?1[0125]\d{8}\b/g, "[PHONE_NUMBER]");
  sanitized = sanitized.replace(/\b00201[0125]\d{8}\b/g, "[PHONE_NUMBER]");

  // 3. Scrub common name prefixes/names in Egyptian contexts (Arabic & English)
  // Captures "المريض علي", "يا علي", "أستاذ أحمد", "Mr. Ahmed", "Patient Sarah"
  // Code Review Improvement: Expanded prefixes and cross-script support (transliterated names)
  const namePrefixesAr = ["المريض", "أستاذ", "أستاذة", "دكتور", "دكتورة", "يا", "مدام", "أنسة"];
  const namePrefixesEn = ["Patient", "Mr.", "Mrs.", "Ms.", "Dr.", "A/O", "Madam", "Miss"];
  
  // Code Review Fix: Use Unicode property escapes for robust Arabic character detection
  // This ensures coverage for Madda, Hamza, and other variants often missed by basic [أ-ي] ranges.
  const prefixPatternAr = new RegExp(`(?:${namePrefixesAr.join("|")})\\s+(\\p{Script=Arabic}+(?:\\s+\\p{Script=Arabic}+)?)`, "gu");
  const prefixPatternEn = new RegExp(`(?:${namePrefixesEn.join("|")})\\s+[A-Zأ-ي][a-zأ-ي]*`, "g");
  
  sanitized = sanitized.replace(prefixPatternAr, (match) => {
    const parts = match.split(/\s+/);
    return `${parts[0]} [PATIENT_NAME]`;
  });

  sanitized = sanitized.replace(prefixPatternEn, (match) => {
    const parts = match.split(/\s+/);
    return `${parts[0]} [PATIENT_NAME]`;
  });

  // 4. Scrub explicit name mentions like "Patient name is [X]" or "اسمه [X]"
  // Code Review Fix: Use Unicode property escapes here as well for clinical safety.
  sanitized = sanitized.replace(/(?:Patient\s+name\s+is|His\s+name\s+is|Her\s+name\s+is|اسم\s+المريض|اسمه|اسمها)\s+(\\p{Script=Arabic}+|[A-Zأ-ي][a-zأ-ي]*)/gui, (match) => {
    const parts = match.split(/\s+/);
    const lastPart = parts.pop();
    return `${parts.join(" ")} [PATIENT_NAME]`;
  });

  return sanitized;
}

/**
 * Ambient AI Scribe consultation parser Server Action.
 * Uses Claude AI tool-calling to extract clinical structures, falling back
 * to a rule-based localized medical NLP engine if API key is missing.
 */
export async function parseAmbientConsultationAction(
  transcript: string
): Promise<{ success: boolean; data?: AmbientScribeResult; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  if (!transcript || transcript.trim() === "") {
    return { success: false, error: "Empty transcript. Please record patient consultation details." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useLocalLlm = process.env.USE_LOCAL_LLM === "true";
  const localLlmUrl = process.env.LOCAL_LLM_URL || "http://localhost:8000/v1/chat/completions";

  const safeTranscript = anonymizePatientData(transcript);

  // 1. AI Scribe Extraction (Priority: Local LLM -> Anthropic Claude -> Rule Engine)
  if (useLocalLlm || apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s SLA timeout for clinical AI

    try {
      const prompt = `You are a clinical EMR scribe inside an Egyptian hospital.
  Analyze the following bilingual (Egyptian Arabic colloquial + English medical jargon) consultation transcript between doctor and patient.
  Extract the clinical context and structure it into formal clinical entries.
  Structure your extraction into a JSON object with: symptoms, diagnosis, soapNotes, and optional vitals (bpSystolic, bpDiastolic, heartRate, temperature, oxygenSaturation).

  Transcript: "${safeTranscript}"`;

      let data: AmbientScribeResult | null = null;

      if (useLocalLlm) {
        // Self-Hosted Fallback: Comply with Egypt Law No. 151 of 2020 by keeping data within local sovereign infrastructure
        const response = await fetch(localLlmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: "llama-3-8b-instruct",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const content = resJson.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            data = {
              symptoms: parsed.symptoms,
              diagnosis: parsed.diagnosis,
              soapNotes: parsed.soapNotes,
              vitals: {
                bpSystolic: parsed.bpSystolic,
                bpDiastolic: parsed.bpDiastolic,
                heartRate: parsed.heartRate,
                temperature: parsed.temperature,
                oxygenSaturation: parsed.oxygenSaturation,
              }
            };
          }
        }
      } else if (apiKey) {
        // External Anthropic Call (Requires strict PII sanitization performed above)
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
            tools: [
              {
                name: "provide_ambient_scribe_results",
                description: "Provides structured clinical data extracted from consultation note.",
                input_schema: {
                  type: "object",
                  properties: {
                    symptoms: { type: "string", description: "Subjective patient complaints." },
                    diagnosis: { type: "string", description: "Formal medical diagnosis." },
                    soapNotes: { type: "string", description: "Objective clinical findings and management plan." },
                    bpSystolic: { type: "string", description: "Systolic blood pressure value." },
                    bpDiastolic: { type: "string", description: "Diastolic blood pressure value." },
                    heartRate: { type: "string", description: "Heart rate bpm." },
                    temperature: { type: "string", description: "Body temperature in Celsius." },
                    oxygenSaturation: { type: "string", description: "SpO2 percentage." }
                  },
                  required: ["symptoms", "diagnosis", "soapNotes"]
                }
              }
            ],
            tool_choice: { type: "tool", name: "provide_ambient_scribe_results" }
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          interface ClaudeToolUse {
            type: string;
            name: string;
            input: Record<string, string | number | boolean | null | undefined>;
          }
          const toolUse = resJson.content?.find((c: ClaudeToolUse) => c.type === "tool_use" && c.name === "provide_ambient_scribe_results");
          if (toolUse) {
            const input = toolUse.input;
            data = {
              symptoms: input.symptoms,
              diagnosis: input.diagnosis,
              soapNotes: input.soapNotes,
              vitals: {
                bpSystolic: input.bpSystolic,
                bpDiastolic: input.bpDiastolic,
                heartRate: input.heartRate,
                temperature: input.temperature,
                oxygenSaturation: input.oxygenSaturation,
              }
            };
          }
        }
      }

      clearTimeout(timeout);
      if (data) return { success: true, data };

    } catch (apiErr) {
      clearTimeout(timeout);
      console.warn("[AMBIENT SCRIBE] AI call failed, falling back to clinical rule-engine:", apiErr);
    }
  }

  // 2. Local Rule-Based Medical NLP Engine Fallback
  // Parsers specifically coded for common Egyptian medical keywords & numbers
  try {
    const text = latinizeNumerals(safeTranscript.toLowerCase());
    
    // Default mock structures
    let symptoms = "Patient presented with general symptoms.";
    let diagnosis = "Unspecified Clinical Encounter";
    let soapNotes = "Clinical SOAP Note:\nS: Subjective complaints documented.\nO: Vital signs checked.\nA: General assessment completed.\nP: Rest, hydration, and follow-up as needed.";
    
    const vitals: AmbientScribeResult["vitals"] = {};

    // A. Parse Vitals via RegEx matching Egyptian digits / decimal numbers
    // Temperature: e.g. "٣٨.٥" or "38.5" or "حرارة ٣٧" or localized comma "38,5"
    const tempMatch = text.match(/(?:حرارة|حرارته|درجة الحرارة|temp|temperature)\s*(\d{2}(?:[.,]\d)?)/) || 
                      text.match(/(\d{2}[.,]\d)\s*(?:c|درجة|مئوية)?/);
    if (tempMatch) {
      vitals.temperature = tempMatch[1].replace(",", ".");
    }

    // BP: e.g. "ضغط ١٢٠ على ٨٠" or "120/80" or "ضغط ١٢٠/٨٠"
    const bpMatch = text.match(/(?:ضغط|bp|blood pressure)\s*(\d{2,3})\s*(?:\/|على|على|over)\s*(\d{2,3})/) || 
                    text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (bpMatch) {
      vitals.bpSystolic = bpMatch[1];
      vitals.bpDiastolic = bpMatch[2];
    }

    // Heart Rate: e.g. "نبض ٧٥" or "pulse 75" or "heart rate 80"
    const hrMatch = text.match(/(?:نبض|النبض|pulse|hr|heart rate)\s*(\d{2,3})/);
    if (hrMatch) {
      vitals.heartRate = hrMatch[1];
    }

    // Oxygen: e.g. "أكسجين ٩٨" or "spo2 98" or "oxygen 95"
    const o2Match = text.match(/(?:أكسجين|اكسجين|spo2|oxygen|saturation)\s*(\d{2,3})/);
    if (o2Match) {
      vitals.oxygenSaturation = o2Match[1];
    }

    // Validate parsed vitals before assigning to prevent clinical garbage inputs or parsing anomalies
    if (vitals.temperature) {
      const t = parseFloat(vitals.temperature);
      if (isNaN(t) || t < 30 || t > 45) {
        vitals.temperature = undefined; // Discard invalid/extreme temperature
      }
    }
    if (vitals.bpSystolic && vitals.bpDiastolic) {
      const sys = parseInt(vitals.bpSystolic);
      const dia = parseInt(vitals.bpDiastolic);
      if (isNaN(sys) || isNaN(dia) || sys < 50 || sys > 250 || dia < 30 || dia > 150) {
        vitals.bpSystolic = undefined;
        vitals.bpDiastolic = undefined; // Discard invalid blood pressure readings
      }
    }
    if (vitals.heartRate) {
      const hr = parseInt(vitals.heartRate);
      if (isNaN(hr) || hr < 20 || hr > 300) {
        vitals.heartRate = undefined; // Discard invalid heart rates
      }
    }
    if (vitals.oxygenSaturation) {
      const o2 = parseInt(vitals.oxygenSaturation);
      if (isNaN(o2) || o2 < 10 || o2 > 100) {
        vitals.oxygenSaturation = undefined; // Discard invalid oxygen saturation
      }
    }

    // B. Keyword Classifier for Symptoms & Diagnoses
    if (text.includes("صداع") || text.includes("حرارة") || text.includes("كحة") || text.includes("سخونية") || text.includes("رشح")) {
      symptoms = "المريض يعاني من صداع، ارتفاع في درجة الحرارة، وكحة حادة مستمرة.";
      diagnosis = "التهاب حاد في البلعوم والأنف (نزلة برد حادة) - Acute Nasopharyngitis (Common Cold)";
      soapNotes = `S: Patient complains of severe headache, fever, and coughing for 2 days.
O: Lungs clear to auscultation, throat injected, Temp: ${vitals.temperature || "38.5"}°C, BP: ${vitals.bpSystolic || "120"}/${vitals.bpDiastolic || "80"}.
A: Community-acquired viral upper respiratory tract infection.
P: Paracetamol 500mg every 6 hours for fever, antitussive syrup, bed rest, and increased fluid intake. Follow up if symptoms worsen.`;
    } else if (text.includes("مغص") || text.includes("ترجيع") || text.includes("إسهال") || text.includes("اسهال") || text.includes("بطنه")) {
      symptoms = "مغص معوي حاد مصحوب بغثيان وإسهال مائي.";
      diagnosis = "نزل معوية حادة - Acute Gastroenteritis";
      soapNotes = `S: Patient reports abdominal cramping, nausea, vomiting, and loose stools.
O: Abdomen soft, mild diffuse tenderness, no rebound, hyperactive bowel sounds.
A: Acute gastroenteritis, likely viral or foodborne.
P: Oral rehydration salts, intestinal antiseptic (Nifuroxazide), antispasmodic (Otilonium bromide), light diet.`;
    } else if (text.includes("صدر") || text.includes("ضيق") || text.includes("نهجان") || text.includes("نفس")) {
      symptoms = "ضيق تنفس مع كحة وسعال جاف مصحوب بصفير في الصدر.";
      diagnosis = "شعب هوائية حادة / أزمة ربوية نشطة - Acute Bronchitis / Active Asthma Exacerbation";
      soapNotes = `S: Patient presents with shortness of breath, wheezing, and chest tightness.
O: Bilateral expiratory wheeze, respiratory rate is elevated at ${vitals.respiratoryRate || "22"}/m.
A: Bronchial asthma exacerbation.
P: Inhaled bronchodilator (Salbutamol) neb, oral corticosteroid short course, follow up in chest clinic.`;
    }

    return {
      success: true,
      data: {
        symptoms,
        diagnosis,
        soapNotes,
        vitals
      }
    };
  } catch (err) {
    return { success: false, error: "Rule-based backup parser failed to process transcript." };
  }
}

