import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { patients } from "@db/schema/patients";
import { hospitals, staff, operatingRooms, departments } from "@db/schema/core";
import { surgicalCases } from "@db/schema/surgical";
import { medicalRecords, vitalsFlowsheet, internalReferrals, medicalCertificates } from "@db/schema/clinical";
import { nursingAssessments } from "@db/schema/nursing";
import { and, eq, desc, aliasedTable, sql, inArray } from "drizzle-orm";
import { getHospitalBySlug } from "@/lib/db/cache";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PatientProfileClient } from "@/components/tables/PatientProfileClient";
import { auth } from "@/lib/auth";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const hospital = await getHospitalBySlug(hospitalSlug);

  if (!hospital) return { title: "Patient Profile" };

  const patientName = await withTenantContext(hospital.id, async (tx) => {
    const [patient] = await tx
      .select({
        nameAr: patients.nameAr,
        nameEn: patients.nameEn,
      })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);
    return patient ? (locale === "ar" ? patient.nameAr : patient.nameEn) : null;
  });

  const hospitalName = locale === "ar" ? hospital.nameAr : hospital.nameEn;

  return {
    title: `${patientName || t("title")} | ${hospitalName} | HMS Egypt`,
    description: `Clinical profile, demographic metrics, signed treatment consents, and surgical histories for ${patientName || "patient"}.`,
  };
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Fetch hospital tenant data
  const dbHospital = await getHospitalBySlug(hospitalSlug);

  if (!dbHospital) {
    notFound();
  }

  // Validate cross-tenant access context
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== dbHospital.id) {
    notFound(); // Return 404 to avoid exposing that the slug exists
  }


  const hospitalId = dbHospital.id;

  // Retrieve patient profile and surgical history transactionally in tenant context
  const data = await withTenantContext(hospitalId, async (tx) => {
    // 1. Fetch patient details
    const [patient] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.hospitalId, hospitalId)))
      .limit(1);

    if (!patient) return null;

    // 2. Fetch past surgery cases joined with surgeon staff and OR rooms
    const surgeon = aliasedTable(staff, "surgeon");
    const anesthesiologist = aliasedTable(staff, "anesthesiologist");

    const patientSurgeries = await tx
      .select({
        id: surgicalCases.id,
        caseNumber: surgicalCases.caseNumber,
        procedureName: surgicalCases.procedureName,
        procedureNameAr: surgicalCases.procedureNameAr,
        anesthesiaType: surgicalCases.anesthesiaType,
        scheduledDate: surgicalCases.scheduledDate,
        scheduledStartTime: surgicalCases.scheduledStartTime,
        status: surgicalCases.status,
        bloodLossML: surgicalCases.bloodLossML,
        complications: surgicalCases.complications,
        surgeonNotes: surgicalCases.surgeonNotes,
        anesthesiaNotes: surgicalCases.anesthesiaNotes,
        // Joined details
        surgeonNameAr: surgeon.nameAr,
        surgeonNameEn: surgeon.nameEn,
        anesthesiologistNameAr: anesthesiologist.nameAr,
        anesthesiologistNameEn: anesthesiologist.nameEn,
        orNameAr: operatingRooms.nameAr,
        orNameEn: operatingRooms.nameEn,
      })
      .from(surgicalCases)
      .leftJoin(surgeon, eq(surgicalCases.leadSurgeonId, surgeon.id))
      .leftJoin(anesthesiologist, eq(surgicalCases.anesthesiologistId, anesthesiologist.id))
      .leftJoin(operatingRooms, eq(surgicalCases.orRoomId, operatingRooms.id))
      .where(and(eq(surgicalCases.patientId, id), eq(surgicalCases.hospitalId, hospitalId)))
      .orderBy(desc(surgicalCases.scheduledDate));

    // 3. Fetch real clinical SOAP records
    const recordDoctor = aliasedTable(staff, "recordDoctor");
    const patientRecords = await tx
      .select({
        id: medicalRecords.id,
        encounterType: medicalRecords.encounterType,
        symptoms: medicalRecords.symptoms,
        diagnosis: medicalRecords.diagnosis,
        soapNotes: medicalRecords.soapNotes,
        icdCodes: medicalRecords.icdCodes,
        createdAt: medicalRecords.createdAt,
        doctorNameAr: recordDoctor.nameAr,
        doctorNameEn: recordDoctor.nameEn,
      })
      .from(medicalRecords)
      .leftJoin(recordDoctor, eq(medicalRecords.doctorId, recordDoctor.id))
      .where(and(eq(medicalRecords.patientId, id), eq(medicalRecords.hospitalId, hospitalId)))
      .orderBy(desc(medicalRecords.createdAt));

    // 4. Fetch recent vitals flowsheet history
    const patientVitals = await tx
      .select()
      .from(vitalsFlowsheet)
      .where(and(eq(vitalsFlowsheet.patientId, id), eq(vitalsFlowsheet.hospitalId, hospitalId)))
      .orderBy(desc(vitalsFlowsheet.recordedAt))
      .limit(20);

    // 5. Fetch internal referrals
    const referringStaff = aliasedTable(staff, "referringStaff");
    const targetStaff = aliasedTable(staff, "targetStaff");
    const patientReferrals = await tx
      .select({
        id: internalReferrals.id,
        reason: internalReferrals.reason,
        urgency: internalReferrals.urgency,
        status: internalReferrals.status,
        notes: internalReferrals.notes,
        createdAt: internalReferrals.createdAt,
        targetDepartmentNameAr: departments.nameAr,
        targetDepartmentNameEn: departments.nameEn,
        referringDoctorNameAr: referringStaff.nameAr,
        referringDoctorNameEn: referringStaff.nameEn,
        targetDoctorNameAr: targetStaff.nameAr,
        targetDoctorNameEn: targetStaff.nameEn,
      })
      .from(internalReferrals)
      .leftJoin(departments, eq(internalReferrals.targetDepartmentId, departments.id))
      .leftJoin(referringStaff, eq(internalReferrals.referringDoctorId, referringStaff.id))
      .leftJoin(targetStaff, eq(internalReferrals.targetDoctorId, targetStaff.id))
      .where(and(eq(internalReferrals.patientId, id), eq(internalReferrals.hospitalId, hospitalId)))
      .orderBy(desc(internalReferrals.createdAt));

    // 6. Fetch medical certificates
    const certDoctor = aliasedTable(staff, "certDoctor");
    const patientCertificates = await tx
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
        doctorNameAr: certDoctor.nameAr,
        doctorNameEn: certDoctor.nameEn,
      })
      .from(medicalCertificates)
      .leftJoin(certDoctor, eq(medicalCertificates.doctorId, certDoctor.id))
      .where(and(eq(medicalCertificates.patientId, id), eq(medicalCertificates.hospitalId, hospitalId)))
      .orderBy(desc(medicalCertificates.createdAt));

    // 7. Fetch nursing assessments
    const assessmentStaff = aliasedTable(staff, "assessmentStaff");
    const patientAssessments = await tx
      .select({
        id: nursingAssessments.id,
        type: nursingAssessments.type,
        data: nursingAssessments.data,
        notes: nursingAssessments.notes,
        createdAt: nursingAssessments.createdAt,
        recordedByNameAr: assessmentStaff.nameAr,
        recordedByNameEn: assessmentStaff.nameEn,
      })
      .from(nursingAssessments)
      .leftJoin(assessmentStaff, eq(nursingAssessments.recordedBy, assessmentStaff.id))
      .where(and(eq(nursingAssessments.patientId, id), eq(nursingAssessments.hospitalId, hospitalId)))
      .orderBy(desc(nursingAssessments.createdAt));

    // 8. Fetch active departments for select options
    const activeDepartments = await tx
      .select({
        id: departments.id,
        nameAr: departments.nameAr,
        nameEn: departments.nameEn,
      })
      .from(departments)
      .where(and(eq(departments.hospitalId, hospitalId), eq(departments.isActive, true)))
      .orderBy(departments.nameAr);

    // 9. Fetch active doctors/surgeons for select options
    const activeDoctors = await tx
      .select({
        id: staff.id,
        nameAr: staff.nameAr,
        nameEn: staff.nameEn,
        role: staff.role,
      })
      .from(staff)
      .where(
        and(
          eq(staff.hospitalId, hospitalId),
          eq(staff.isActive, true),
          sql`${staff.role} IN ('DOCTOR', 'SURGEON', 'ANESTHESIOLOGIST', 'NURSE')`
        )
      )
      .orderBy(staff.nameAr);

    return { 
      patient, 
      patientSurgeries, 
      patientRecords, 
      patientVitals,
      patientReferrals,
      patientCertificates,
      patientAssessments,
      activeDepartments,
      activeDoctors
    };
  });

  if (!data) {
    notFound();
  }

  // Map database nulls into undefined/optional types for PatientProfileClientProps
  const mappedPatient = {
    id: data.patient.id,
    nameAr: data.patient.nameAr,
    nameEn: data.patient.nameEn,
    patientNumber: data.patient.patientNumber,
    gender: data.patient.gender || "male",
    dob: data.patient.dob,
    contactPhone: data.patient.contactPhone || undefined,
    address: data.patient.address || undefined,
    bloodType: undefined,
    isUhisActive: data.patient.isUhisActive ?? false,
    uhisNumber: data.patient.uhisNumber || undefined,
    createdAt: data.patient.createdAt,
  };

  const mappedSurgeries = data.patientSurgeries.map((s) => ({
    id: s.id,
    caseNumber: s.caseNumber,
    scheduledDate: s.scheduledDate,
    scheduledStartTime: s.scheduledStartTime,
    procedureName: s.procedureName,
    procedureNameAr: s.procedureNameAr,
    surgeonNameAr: s.surgeonNameAr || undefined,
    surgeonNameEn: s.surgeonNameEn || undefined,
    orNameAr: s.orNameAr || undefined,
    orNameEn: s.orNameEn || undefined,
    anesthesiaType: s.anesthesiaType || undefined,
    complications: s.complications || undefined,
    surgeonNotes: s.surgeonNotes || undefined,
    anesthesiaNotes: s.anesthesiaNotes || undefined,
    bloodLossML: s.bloodLossML || undefined,
  }));

  const mappedRecords = data.patientRecords.map((r) => ({
    id: r.id,
    encounterType: r.encounterType,
    symptoms: r.symptoms || undefined,
    diagnosis: r.diagnosis || undefined,
    soapNotes: r.soapNotes || undefined,
    icdCodes: r.icdCodes || undefined,
    createdAt: r.createdAt,
    doctorNameAr: r.doctorNameAr || undefined,
    doctorNameEn: r.doctorNameEn || undefined,
  }));

  const mappedVitals = data.patientVitals.map((v) => ({
    id: v.id,
    recordedAt: v.recordedAt,
    bloodPressureSystolic: v.bloodPressureSystolic || undefined,
    bloodPressureDiastolic: v.bloodPressureDiastolic || undefined,
    heartRate: v.heartRate || undefined,
    respiratoryRate: v.respiratoryRate || undefined,
    temperature: v.temperature || undefined,
    oxygenSaturation: v.oxygenSaturation || undefined,
    weightKg: v.weightKg || undefined,
    heightCm: v.heightCm || undefined,
  }));

  const mappedReferrals = data.patientReferrals.map((ref) => ({
    id: ref.id,
    reason: ref.reason,
    urgency: ref.urgency,
    status: ref.status,
    notes: ref.notes || undefined,
    createdAt: ref.createdAt,
    targetDepartmentNameAr: ref.targetDepartmentNameAr || undefined,
    targetDepartmentNameEn: ref.targetDepartmentNameEn || undefined,
    referringDoctorNameAr: ref.referringDoctorNameAr || undefined,
    referringDoctorNameEn: ref.referringDoctorNameEn || undefined,
    targetDoctorNameAr: ref.targetDoctorNameAr || undefined,
    targetDoctorNameEn: ref.targetDoctorNameEn || undefined,
  }));

  const mappedCertificates = data.patientCertificates.map((cert) => ({
    id: cert.id,
    serialNumber: cert.serialNumber,
    certificateType: cert.certificateType,
    diagnosis: cert.diagnosis,
    startDate: cert.startDate,
    endDate: cert.endDate,
    restDays: cert.restDays,
    notes: cert.notes || undefined,
    createdAt: cert.createdAt,
    doctorNameAr: cert.doctorNameAr || undefined,
    doctorNameEn: cert.doctorNameEn || undefined,
  }));

  const mappedAssessments = data.patientAssessments.map((ass) => ({
    id: ass.id,
    type: ass.type,
    data: ass.data as any,
    notes: ass.notes || undefined,
    createdAt: ass.createdAt,
    recordedByNameAr: ass.recordedByNameAr || undefined,
    recordedByNameEn: ass.recordedByNameEn || undefined,
  }));

  return (
    <div className="min-h-screen bg-gray-50/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-border/30 pb-4 flex flex-col gap-1 text-start">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {locale === "ar" ? "الملف الشخصي للمريض" : "Patient File Profile"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {locale === "ar" 
              ? "استعرض تفاصيل الهوية الديموغرافية، التنبيهات السريرية الحرجة، الموافقات القانونية وسجلات الجراحة السابقة." 
              : "Access complete clinical records, critical allergy warnings, statutory consent forms, and perioperative operations logs."}
          </p>
        </header>

        <PatientProfileClient 
          patient={mappedPatient} 
          surgeries={mappedSurgeries} 
          records={mappedRecords}
          vitals={mappedVitals}
          hospitalSlug={hospitalSlug} 
          hospitalId={hospitalId}
          departments={data.activeDepartments}
          doctors={data.activeDoctors}
          referrals={mappedReferrals}
          certificates={mappedCertificates}
          assessments={mappedAssessments}
        />
      </div>
    </div>
  );
}

