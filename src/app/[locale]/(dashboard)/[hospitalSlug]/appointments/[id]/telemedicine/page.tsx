import { db } from "@/lib/db";
import { appointments } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { staff, departments } from "@db/schema/core";
import { medications } from "@db/schema/pharmacy";
import { eq, and } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TelemedicineClientRoom } from "./TelemedicineClientRoom";
import { getTranslations } from "next-intl/server";
import { createHmac } from "crypto";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "appointments" });

  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("telemedicine") || "Telemedicine Consult"} | ${hospitalName} | HMS Egypt`,
    description: "Secure, clinical high-definition virtual consultation outpatient room.",
  };
}

export default async function TelemedicinePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { locale, hospitalSlug, id } = await params;

  // 1. Session and Auth validation
  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // 2. Fetch hospital tenant data
  const dbHospital = await getHospitalBySlug(hospitalSlug);
  if (!dbHospital) {
    notFound();
  }

  // Cross-tenant protection
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== dbHospital.id) {
    notFound();
  }

  const hospitalId = dbHospital.id;

  // 3. Fetch data inside tenant context for RLS compliance and performance
  const { appointment, activeMedications } = await withTenantContext(hospitalId, async (tx) => {
    const [appointmentRes, rawMedicationsRes, currentStaffRes] = await Promise.all([
      // Fetch specific appointment with all clinical associations
      tx
        .select({
          id: appointments.id,
          scheduledDate: appointments.scheduledDate,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          type: appointments.type,
          notes: appointments.notes,
          patientId: patients.id,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          patientNumber: patients.patientNumber,
          patientPhone: patients.contactPhone,
          patientDob: patients.dob,
          patientGender: patients.gender,
          patientNationalId: patients.nationalId,
          doctorId: staff.id,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          departmentId: departments.id,
          departmentNameAr: departments.nameAr,
          departmentNameEn: departments.nameEn,
          hospitalId: appointments.hospitalId,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(staff, eq(appointments.doctorId, staff.id))
        .innerJoin(departments, eq(appointments.departmentId, departments.id))
        .where(and(eq(appointments.id, id), eq(appointments.hospitalId, hospitalId)))
        .limit(1)
        .then((res) => res[0]),

      // Fetch active medications for prescribing
      tx
        .select({
          id: medications.id,
          nameAr: medications.nameAr,
          nameEn: medications.nameEn,
          genericName: medications.genericName,
          form: medications.form,
          strength: medications.strength,
          price: medications.price,
        })
        .from(medications)
        .where(and(eq(medications.hospitalId, hospitalId), eq(medications.isActive, true)))
        .orderBy(medications.nameEn),

      // Resolve current user staff profile
      !isSuperAdmin 
        ? tx
            .select()
            .from(staff)
            .where(and(eq(staff.userId, session.user.id), eq(staff.hospitalId, hospitalId)))
            .limit(1)
            .then((res) => res[0])
        : Promise.resolve(null),
    ]);

    if (!appointmentRes) {
      notFound();
    }

    // Enforce doctor assignment ownership check (only the assigned doctor or SUPER_ADMIN can enter)
    let isAssignedDoctor = false;
    if (isSuperAdmin) {
      isAssignedDoctor = true;
    } else if (currentStaffRes && appointmentRes.doctorId === currentStaffRes.id) {
      isAssignedDoctor = true;
    }

    if (!isAssignedDoctor) {
      notFound();
    }

    const medicationsMapped = rawMedicationsRes.map((med) => ({
      ...med,
      price: med.price ? (isNaN(parseFloat(med.price)) ? 0 : parseFloat(med.price)) : 0,
    }));

    return {
      appointment: appointmentRes,
      activeMedications: medicationsMapped,
    };
  });

  // If already completed or cancelled, prevent entering the call room to maintain record integrity
  if (appointment.status !== "scheduled") {
    redirect(`/${locale}/${hospitalSlug}/appointments`);
  }

  // 4. Generate secure, cryptographically hashed Jitsi Room name to prevent eavesdropping
  const salt = process.env.JITSI_SALT || "hms-egypt-telemedicine-secret-salt-2026";
  const secureHash = createHmac("sha256", salt).update(id).digest("hex").slice(0, 16);
  const secureRoomName = `hms-egypt-${id}-${secureHash}`;

  return (
    <div className="bg-slate-950 min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
      <div className="max-w-7xl mx-auto w-full">
        <TelemedicineClientRoom
          appointment={appointment}
          medications={activeMedications}
          hospitalSlug={hospitalSlug}
          locale={locale}
          secureRoomName={secureRoomName}
        />
      </div>
    </div>
  );
}
