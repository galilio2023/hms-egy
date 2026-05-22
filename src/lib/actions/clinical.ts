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
  if (vitals.temperature) {
    const tVal = parseFloat(vitals.temperature);
    if (!isNaN(tVal) && (tVal < TempRange.min || tVal > TempRange.max)) {
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
    const cleanTemperature = vitals?.temperature && !isNaN(parseFloat(vitals.temperature))
      ? parseFloat(vitals.temperature).toFixed(1)
      : null;

    const cleanWeight = vitals?.weightKg && !isNaN(parseFloat(vitals.weightKg))
      ? parseFloat(vitals.weightKg).toFixed(1)
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
    const cleanTemperature = data.vitals?.temperature && !isNaN(parseFloat(data.vitals.temperature))
      ? parseFloat(data.vitals.temperature).toFixed(1)
      : null;

    const cleanWeight = data.vitals?.weightKg && !isNaN(parseFloat(data.vitals.weightKg))
      ? parseFloat(data.vitals.weightKg).toFixed(1)
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
      const activeLocale = data.locale || "ar";
      revalidatePath(`/${activeLocale}/${hSlug}/patients/${result.patientId}`);

      const altLocale = activeLocale === "ar" ? "en" : "ar";
      revalidatePath(`/${altLocale}/${hSlug}/patients/${result.patientId}`);
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

