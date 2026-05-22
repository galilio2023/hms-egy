import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { patients } from "@db/schema/patients";
import { hospitals, staff, operatingRooms } from "@db/schema/core";
import { surgicalCases } from "@db/schema/surgical";
import { medicalRecords, vitalsFlowsheet } from "@db/schema/clinical";
import { and, eq, desc, aliasedTable } from "drizzle-orm";
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

    return { patient, patientSurgeries, patientRecords, patientVitals };
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
        />
      </div>
    </div>
  );
}
