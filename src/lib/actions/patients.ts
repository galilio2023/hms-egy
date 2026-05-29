"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { patients, patientConsents } from "@db/schema/patients";
import { hospitals } from "@db/schema/core";
import { and, eq, gte, lte, or, ilike, sql } from "drizzle-orm";
import { patientSchema, type PatientSchema } from "@/lib/validations/patient.schema";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError, ErrorCode } from "@/lib/utils/errors";
import { formatPatientNumber, normalizeArabic, toCairoTime } from "@/lib/utils/egypt";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { type User } from "@/types/auth-api.types";

/**
 * Registers a new patient within the current tenant isolation context.
 * Automatically generates sequential patient numbers (file numbers) and registers
 * default general/surgical/telemedicine treatment consents.
 */
export async function registerPatient(data: PatientSchema) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const isAuthorized = hasPermission(session.user as unknown as User, "patients:create", {
    hospitalId: session.activeHospitalId || session.user.hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to register patients." };
  }

  // 1. Validate form schema
  const validated = patientSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: "بيانات التسجيل غير صالحة. يرجى مراجعة الحقول.",
      details: validated.error.format(),
    };
  }

  const validatedData = validated.data;
  const hospitalId = session.activeHospitalId || session.user.hospitalId;

  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital session context missing." };
  }

  // Normalize Arabic name for indexed storage consistency
  const normalizedNameAr = normalizeArabic(validatedData.nameAr);

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // 2. Prevent duplicate registrations within the same hospital
      if (validatedData.nationalId && validatedData.nationalId.trim() !== "") {
        const [existing] = await tx
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              eq(patients.nationalId, validatedData.nationalId.trim())
            )
          )
          .limit(1);

        if (existing) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "عذراً، هذا الرقم القومي مسجل بالفعل لدى المستشفى."
          );
        }
      }

      if (validatedData.passportNumber && validatedData.passportNumber.trim() !== "") {
        const [existing] = await tx
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              eq(patients.passportNumber, validatedData.passportNumber.trim())
            )
          )
          .limit(1);

        if (existing) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "عذراً، رقم جواز السفر هذا مسجل بالفعل لدى المستشفى."
          );
        }
      }

      // 3. Generate sequential file number
      const [hospital] = await tx
        .select({ slug: hospitals.slug })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);

      const hospitalCode = hospital?.slug
        ? hospital.slug.toUpperCase().slice(0, 4)
        : "EGYP";

      const nowCairo = toCairoTime(new Date());
      const currentYear = nowCairo.getFullYear();
      const startOfYear = fromZonedTime(`${currentYear}-01-01T00:00:00`, "Africa/Cairo");
      const endOfYear = fromZonedTime(`${currentYear}-12-31T23:59:59`, "Africa/Cairo");

      const [countResult] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(patients)
        .where(
          and(
            eq(patients.hospitalId, hospitalId),
            gte(patients.createdAt, startOfYear),
            lte(patients.createdAt, endOfYear)
          )
        );

      const sequence = (countResult?.value || 0) + 1;
      const patientNumber = formatPatientNumber(hospitalCode, currentYear, sequence);

      // 4. Insert patient
      const [newPatient] = await tx
        .insert(patients)
        .values({
          hospitalId,
          patientNumber,
          nameAr: validatedData.nameAr.trim(), // Legal name for compliance
          normalizedNameAr, // Normalized copy for fast indexed search
          nameEn: validatedData.nameEn.trim(),
          nationalId: validatedData.nationalId?.trim() || null,
          passportNumber: validatedData.passportNumber?.trim() || null,
          dob: validatedData.dob,
          gender: validatedData.gender,
          contactPhone: validatedData.phone.trim(),
          email: validatedData.email?.trim() || null,
          address: validatedData.address || "غير محدد",
          governorate: validatedData.governorate,
          emergencyContactName: validatedData.guardianName?.trim() || null,
          emergencyContactPhone: validatedData.guardianPhone?.trim() || null,
          uhisNumber: validatedData.insuranceNumber?.trim() || null,
          uhisGovernorate: validatedData.insuranceProviderId === "uhis" ? validatedData.governorate : null,
          isUhisActive: validatedData.insuranceProviderId === "uhis",
          bloodType: validatedData.bloodType || null,
          allergies: validatedData.allergies || [],
          chronicConditions: validatedData.chronicConditions || [],
        })
        .returning();

      if (!newPatient) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "فشل إنشاء سجل المريض في قاعدة البيانات.");
      }

      // 5. Insert initial consent record
      await tx.insert(patientConsents).values({
        hospitalId,
        patientId: newPatient.id,
        type: "general",
        version: "v1.0",
        isSigned: true,
        signedAt: new Date(),
        witnessName: session.user.name || "Receptionist",
      });

      return { success: true, patientId: newPatient.id, patientNumber };
    });
  } catch (error) {
    console.error("[PATIENTS_ACTION] registerPatient failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: "حدث خطأ غير متوقع أثناء تسجيل المريض. يرجى المحاولة لاحقاً: " + message };
  }
}

/**
 * Updates an existing patient record inside the safe tenant context.
 */
export async function updatePatient(patientId: string, data: Partial<PatientSchema>) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const isAuthorized = hasPermission(session.user as unknown as User, "patients:edit", {
    hospitalId: session.activeHospitalId || session.user.hospitalId,
  });

  if (!isAuthorized) {
    return { success: false, error: "Forbidden: You do not have permission to edit patient records." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital session context missing." };
  }

  // Normalize Arabic name if provided
  const normalizedNameAr = data.nameAr ? normalizeArabic(data.nameAr) : undefined;

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      // Check duplicate National ID
      if (data.nationalId && data.nationalId.trim() !== "") {
        const [existing] = await tx
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              eq(patients.nationalId, data.nationalId.trim()),
              sql`${patients.id} != ${patientId}::uuid`
            )
          )
          .limit(1);

        if (existing) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "عذراً، هذا الرقم القومي مسجل بالفعل لمريض آخر."
          );
        }
      }

      await tx
        .update(patients)
        .set({
          nameAr: data.nameAr?.trim(), // Legal name for compliance
          normalizedNameAr: normalizedNameAr, // Updated indexed copy
          nameEn: data.nameEn?.trim(),
          nationalId: data.nationalId?.trim() || null,
          passportNumber: data.passportNumber?.trim() || null,
          dob: data.dob,
          gender: data.gender,
          contactPhone: data.phone?.trim(),
          email: data.email?.trim() || null,
          address: data.address,
          governorate: data.governorate,
          emergencyContactName: data.guardianName?.trim() || null,
          emergencyContactPhone: data.guardianPhone?.trim() || null,
          uhisNumber: data.insuranceNumber?.trim() || null,
          uhisGovernorate: data.insuranceProviderId === "uhis" ? data.governorate : null,
          isUhisActive: data.insuranceProviderId === "uhis",
          bloodType: data.bloodType || undefined,
          allergies: data.allergies || undefined,
          chronicConditions: data.chronicConditions || undefined,
          version: sql`${patients.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, patientId));

      revalidatePath(`/[locale]/${hospitalId}/patients/${patientId}`, "page");
      revalidatePath(`/[locale]/${hospitalId}/patients`, "page");

      return { success: true };
    });
  } catch (error) {
    console.error("[PATIENTS_ACTION] updatePatient failed:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: "حدث خطأ أثناء تحديث بيانات المريض. يرجى المحاولة لاحقاً: " + message };
  }
}

/**
 * Retrieves a single patient by ID, scoped cleanly under the active hospital.
 */
export async function getPatientById(patientId: string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital session context missing." };
  }

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient) {
        return { success: false, error: "المريض المطلوب غير موجود في سجلات هذه المنشأة." };
      }

      return { success: true, data: patient };
    });
  } catch (error) {
    console.error("[PATIENTS_ACTION] getPatientById failed:", error);
    return { success: false, error: "فشل استرداد بيانات المريض من قاعدة البيانات." };
  }
}

/**
 * Searches the hospital patient directory with high speed matching across:
 * - Patient Number (file number)
 * - Name in Arabic / Name in English
 * - National ID
 * - Contact Phone Number
 */
export async function searchPatientsAction(query: string) {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const hospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!hospitalId) {
    return { success: false, error: "System Error: Hospital session context missing." };
  }

  // Normalize the incoming query for Arabic text consistency
  const normalizedQuery = normalizeArabic(query?.trim() || "");

  try {
    return await withTenantContext(hospitalId, async (tx) => {
      let results;

      if (!normalizedQuery) {
        // If query is empty, return latest 20 patients
        results = await tx
          .select()
          .from(patients)
          .where(eq(patients.hospitalId, hospitalId))
          .orderBy(sql`${patients.createdAt} DESC`)
          .limit(20);
      } else {
        // Run full database directory search using optimized normalized column
        results = await tx
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.hospitalId, hospitalId),
              or(
                ilike(patients.patientNumber, `%${normalizedQuery}%`),
                // Search against the pre-normalized B-Tree indexed column
                ilike(patients.normalizedNameAr, `%${normalizedQuery}%`),
                ilike(patients.nameEn, `%${normalizedQuery}%`),
                ilike(patients.contactPhone, `%${normalizedQuery}%`),
                ilike(patients.nationalId || "", `%${normalizedQuery}%`),
                ilike(patients.passportNumber || "", `%${normalizedQuery}%`)
              )
            )
          )
          .orderBy(sql`${patients.createdAt} DESC`)
          .limit(50);
      }

      return { success: true, data: results };
    });
  } catch (error) {
    console.error("[PATIENTS_ACTION] searchPatientsAction failed:", error);
    return { success: false, error: "حدث خطأ أثناء إجراء البحث. يرجى المحاولة لاحقاً." };
  }
}
