"use server";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { medicalCertificates } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/utils/errors";

export interface CertificateInput {
  patientId: string;
  certificateType: "sick_leave" | "fitness" | "companion";
  diagnosis: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  restDays: number;
  notes?: string | null;
}

/**
 * Generates a unique serial number for the medical certificate.
 * Format: MC-YYYYMMDD-XXXX (where XXXX is a unique random alphanumeric code)
 */
function generateSerialNumber(): string {
  const cairoTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
  const d = new Date(cairoTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  
  // 4 secure hex characters code
  const randomPart = randomBytes(2).toString("hex").toUpperCase();
  
  return `MC-${dateStr}-${randomPart}`;
}

/**
 * Creates a new medical certificate for a patient.
 */
export async function createCertificateAction(input: CertificateInput) {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط لإصدار شهادة طبية.");
  }

  const serialNumber = generateSerialNumber();

  try {
    const result = await withTenantContext(hospitalId, async (tx) => {
      // Resolve Doctor (Staff) ID of the current user for this hospital
      const currentStaff = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]);

      if (!currentStaff) {
        throw new AppError(ErrorCode.NOT_FOUND, "Clinical Profile Error: Doctor profile not found for current user.");
      }

      const [newCertificate] = await tx
        .insert(medicalCertificates)
        .values({
          hospitalId,
          patientId: input.patientId,
          doctorId: currentStaff.id,
          certificateType: input.certificateType,
          diagnosis: input.diagnosis.trim(),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          restDays: input.restDays,
          notes: input.notes?.trim() || null,
          serialNumber,
        })
        .returning();

      return newCertificate;
    });

    revalidatePath(`/[locale]/${hospitalId}/patients/${input.patientId}`, "page");
    return { success: true, data: result };
  } catch (error) {
    console.error("[CREATE_CERTIFICATE_ERROR]", error);
    return { success: false, error: "فشل إصدار الشهادة الطبية." };
  }
}

/**
 * Retrieves all medical certificates for a given patient.
 */
export async function getPatientCertificatesAction(patientId: string) {
  const session = await auth();
  if (!session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "غير مصرح بالوصول.");
  }

  const { hospitalId } = session.user;
  if (!hospitalId || hospitalId === "system-wide") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "يجب أن تكون مرتبطاً بمستشفى نشط.");
  }

  try {
    const results = await withTenantContext(hospitalId, async (tx) => {
      return await tx
        .select({
          id: medicalCertificates.id,
          serialNumber: medicalCertificates.serialNumber,
          certificateType: medicalCertificates.certificateType,
          diagnosis: medicalCertificates.diagnosis,
          startDate: medicalCertificates.startDate,
          endDate: medicalCertificates.endDate,
          restDays: medicalCertificates.restDays,
          notes: medicalCertificates.notes,
          createdAt: medicalCertificates.createdAt,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
        })
        .from(medicalCertificates)
        .leftJoin(staff, eq(medicalCertificates.doctorId, staff.id))
        .where(eq(medicalCertificates.patientId, patientId))
        .orderBy(desc(medicalCertificates.createdAt));
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[GET_CERTIFICATES_ERROR]", error);
    return { success: false, error: "فشل استرداد الشهادات الطبية." };
  }
}
alse, error: "فشل استرداد الشهادات الطبية." };
  }
}
