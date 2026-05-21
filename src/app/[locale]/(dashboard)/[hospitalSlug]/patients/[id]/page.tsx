import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant";
import { patients } from "@db/schema/patients";
import { hospitals, staff, operatingRooms } from "@db/schema/core";
import { surgicalCases } from "@db/schema/surgical";
import { and, eq, desc, aliasedTable } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PatientProfileClient } from "@/components/tables/PatientProfileClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string; id: string }>;
}) {
  const { id, locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "patients" });

  const [hospital] = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
    })
    .from(hospitals)
    .where(eq(hospitals.slug, hospitalSlug))
    .limit(1);

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

  // Fetch hospital tenant data
  const [dbHospital] = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
    })
    .from(hospitals)
    .where(eq(hospitals.slug, hospitalSlug))
    .limit(1);

  if (!dbHospital) {
    notFound();
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

    return { patient, patientSurgeries };
  });

  if (!data) {
    notFound();
  }

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
          patient={data.patient} 
          surgeries={data.patientSurgeries} 
          hospitalSlug={hospitalSlug} 
        />
      </div>
    </div>
  );
}
