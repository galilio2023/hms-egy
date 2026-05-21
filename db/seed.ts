import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as fs from "fs";
import * as path from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

console.log("🌱 Connecting to Neon database...");
const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

async function seed() {
  try {
    console.log("🧼 Cleaning existing clinical and core data...");

    // topological order deletion
    await db.delete(schema.sentReminders);
    await db.delete(schema.aiAuditLogs);
    await db.delete(schema.auditLogs);
    await db.delete(schema.documents);
    await db.delete(schema.notifications);
    await db.delete(schema.anesthesiaRecords);
    await db.delete(schema.surgicalChecklists);
    await db.delete(schema.surgicalChecklistTemplates);
    await db.delete(schema.surgicalCases);
    await db.delete(schema.onlinePayments);
    await db.delete(schema.paymentReminders);
    await db.delete(schema.payments);
    await db.delete(schema.insuranceClaims);
    await db.delete(schema.invoiceItems);
    await db.delete(schema.invoices);
    await db.delete(schema.labOrderItems);
    await db.delete(schema.criticalValueAlerts);
    await db.delete(schema.labOrders);
    await db.delete(schema.labTests);
    await db.delete(schema.radiologyReports);
    await db.delete(schema.radiologyOrders);
    await db.delete(schema.stockTransactions);
    await db.delete(schema.prescriptionItems);
    await db.delete(schema.prescriptions);
    await db.delete(schema.medications);
    await db.delete(schema.medicationInteractions);
    await db.delete(schema.drugAllergyCrossReferences);
    await db.delete(schema.housekeepingTasks);
    await db.delete(schema.admissions);
    await db.delete(schema.dischargeSummaries);
    await db.delete(schema.medicalRecords);
    await db.delete(schema.vitalsFlowsheet);
    await db.delete(schema.appointments);
    await db.delete(schema.waitingList);
    await db.delete(schema.beds);
    await db.delete(schema.rooms);
    await db.delete(schema.patientConsents);
    await db.delete(schema.patients);
    await db.delete(schema.orBlockOverrides);
    await db.delete(schema.orBlocks);
    await db.delete(schema.operatingRooms);
    await db.delete(schema.staff);
    await db.delete(schema.departments);
    await db.delete(schema.hospitalSettings);
    await db.delete(schema.hospitals);

    console.log("🏥 Seeding hospitals & core settings...");
    // 1. Create a hospital
    const [hospital] = await db.insert(schema.hospitals).values({
      nameAr: "مستشفى الشفاء التخصصي",
      nameEn: "Al-Shifa Specialty Hospital",
      slug: "al-shifa",
      contactEmail: "info@alshifa-hospital.com",
      contactPhone: "19100", // hotline support
      address: "٥ شارع القصر العيني، القاهرة",
      governorate: "Cairo",
      type: "private",
      planTier: "enterprise",
      isActive: true,
    }).returning();

    console.log(`✅ Seeded Hospital: ${hospital.nameEn} (ID: ${hospital.id})`);

    // 2. Settings
    await db.insert(schema.hospitalSettings).values({
      hospitalId: hospital.id,
      isSurgicalEnabled: true,
      isTelemedicineEnabled: true,
      isPatientPortalEnabled: true,
      isOnlinePaymentsEnabled: true,
      timezone: "Africa/Cairo",
      currency: "EGP",
      orCleaningDuration: 30,
      autoHousekeeping: true,
    });

    console.log("✅ Seeded Hospital Settings.");

    // 3. Departments
    const [deptSurgery] = await db.insert(schema.departments).values({
      hospitalId: hospital.id,
      nameAr: "قسم الجراحة العامة",
      nameEn: "General Surgery Department",
      code: "SURG",
      isActive: true,
    }).returning();

    const [deptCardiology] = await db.insert(schema.departments).values({
      hospitalId: hospital.id,
      nameAr: "قسم أمراض القلب",
      nameEn: "Cardiology Department",
      code: "CARD",
      isActive: true,
    }).returning();

    console.log("✅ Seeded Departments.");

    // 4. Staff
    const [surgeon] = await db.insert(schema.staff).values({
      hospitalId: hospital.id,
      nameAr: "د. أحمد الشرقاوي",
      nameEn: "Dr. Ahmed El-Sharkawy",
      role: "SURGEON",
      email: "ahmed.sharkawy@alshifa.com",
      phone: "+201012345678",
      licenseNumber: "DOC-2021-9988",
      isActive: true,
    }).returning();

    const [anesthesiologist] = await db.insert(schema.staff).values({
      hospitalId: hospital.id,
      nameAr: "د. سارة المنشاوي",
      nameEn: "Dr. Sarah El-Menshawy",
      role: "ANESTHESIOLOGIST",
      email: "sarah.menshawy@alshifa.com",
      phone: "+201123456789",
      licenseNumber: "DOC-2023-1122",
      isActive: true,
    }).returning();

    const [nurse] = await db.insert(schema.staff).values({
      hospitalId: hospital.id,
      nameAr: "أ. منى زكي",
      nameEn: "Ms. Mona Zaki",
      role: "OR_NURSE",
      email: "mona.zaki@alshifa.com",
      phone: "+201234567890",
      isActive: true,
    }).returning();

    const [housekeeper] = await db.insert(schema.staff).values({
      hospitalId: hospital.id,
      nameAr: "أ. محمد علي",
      nameEn: "Mr. Mohamed Ali",
      role: "HOUSEKEEPING",
      email: "mohamed.ali@alshifa.com",
      phone: "+201534567890",
      isActive: true,
    }).returning();

    console.log("✅ Seeded Staff.");

    // 5. Operating Rooms
    const [or1] = await db.insert(schema.operatingRooms).values({
      hospitalId: hospital.id,
      nameAr: "غرفة عمليات جراحة القلب (١)",
      nameEn: "Cardiothoracic Operating Room (OR-1)",
      floor: "2",
      wing: "A",
      type: "cardiac",
      equipmentList: ["Ventilator", "Heart-Lung Machine", "Defibrillator"],
      isActive: true,
      cleaningDurationMinutes: 45,
    }).returning();

    const [or2] = await db.insert(schema.operatingRooms).values({
      hospitalId: hospital.id,
      nameAr: "غرفة عمليات الجراحة العامة (٢)",
      nameEn: "General Surgery Operating Room (OR-2)",
      floor: "2",
      wing: "A",
      type: "general",
      equipmentList: ["Ventilator", "Electrocautery Machine", "Anesthesia Unit"],
      isActive: true,
      cleaningDurationMinutes: 30,
    }).returning();

    console.log("✅ Seeded Operating Rooms.");

    // 6. Schedule blocks (orBlocks)
    await db.insert(schema.orBlocks).values({
      hospitalId: hospital.id,
      orRoomId: or1.id,
      departmentId: deptCardiology.id,
      owningDoctorId: surgeon.id,
      dayOfWeek: 1, // Monday
      startTime: "08:00:00",
      endTime: "14:00:00",
      blockName: "Dr. Ahmed Cardiothoracic Block",
      isRecurring: true,
      effectiveFrom: new Date(),
    });

    console.log("✅ Seeded Operating Room Scheduling Blocks.");

    // 7. Rooms & Beds
    const [room301] = await db.insert(schema.rooms).values({
      hospitalId: hospital.id,
      roomNumber: "301",
      type: "standard",
      floor: "3",
      wing: "B",
      isActive: true,
    }).returning();

    const [room302] = await db.insert(schema.rooms).values({
      hospitalId: hospital.id,
      roomNumber: "302",
      type: "icu",
      floor: "3",
      wing: "B",
      isActive: true,
    }).returning();

    await db.insert(schema.beds).values([
      {
        hospitalId: hospital.id,
        roomId: room301.id,
        bedNumber: "301-A",
        status: "available",
      },
      {
        hospitalId: hospital.id,
        roomId: room301.id,
        bedNumber: "301-B",
        status: "available",
      },
      {
        hospitalId: hospital.id,
        roomId: room302.id,
        bedNumber: "ICU-1",
        status: "available",
      }
    ]);

    console.log("✅ Seeded Rooms and Beds.");

    // 8. WHO Surgical Checklist Templates
    console.log("📋 Seeding WHO Surgical Safety Checklist Templates...");
    await db.insert(schema.surgicalChecklistTemplates).values([
      {
        hospitalId: hospital.id,
        name: "WHO Surgical Safety Checklist - Pre-Op (Sign In)",
        nameAr: "قائمة منظمة الصحة العالمية لسلامة الجراحة - تسجيل الدخول (قبل التخدير)",
        phase: "pre_op_sign_in",
        items: [
          { id: "1", itemAr: "تأكيد هوية المريض وموقع الجراحة والعملية والموافقة", itemEn: "Patient has confirmed identity, site, procedure and consent", requiresInitials: true, category: "Confirmation" },
          { id: "2", itemAr: "تعليم موقع الجراحة (إن وجد)", itemEn: "Surgical site marked (if applicable)", requiresInitials: true, category: "Site" },
          { id: "3", itemAr: "اكتمال فحص سلامة أجهزة وأدوية التخدير", itemEn: "Anesthesia safety check completed (machine and medication)", requiresInitials: true, category: "Anesthesia" },
          { id: "4", itemAr: "جهاز قياس الأكسجين بالنبض يعمل بشكل سليم", itemEn: "Pulse oximeter on patient and functioning", requiresInitials: false, category: "Monitoring" },
          { id: "5", itemAr: "سؤال المريض عن وجود أي حساسية معروفة لديه", itemEn: "Does the patient have a known allergy?", requiresInitials: true, category: "Allergy" },
          { id: "6", itemAr: "تقييم مخاطر مجرى الهواء أو الطموح وصعوبة التنفس", itemEn: "Difficult airway or aspiration risk assessed?", requiresInitials: true, category: "Airway" },
          { id: "7", itemAr: "تقييم مخاطر فقدان الدم (>500 مل أو >7مل/كجم في الأطفال)", itemEn: "Risk of blood loss (>500ml or >7ml/kg in children) assessed?", requiresInitials: true, category: "Blood Loss" }
        ],
        isActive: true,
      },
      {
        hospitalId: hospital.id,
        name: "WHO Surgical Safety Checklist - Time Out (Before Incision)",
        nameAr: "قائمة منظمة الصحة العالمية لسلامة الجراحة - فترة التوقف (قبل الشق الجراحي)",
        phase: "time_out",
        items: [
          { id: "1", itemAr: "تأكيد تعريف جميع أعضاء الفريق الجراحي باسمائهم وأدوارهم", itemEn: "Confirm all team members have introduced themselves by name and role", requiresInitials: false, category: "Team" },
          { id: "2", itemAr: "تأكيد اسم المريض وموقع الجراحة والعملية شفهياً", itemEn: "Confirm patient's name, surgical site, and procedure verbally", requiresInitials: true, category: "Confirmation" },
          { id: "3", itemAr: "إعطاء المضادات الحيوية الوقائية خلال الستين دقيقة الماضية", itemEn: "Has antibiotic prophylaxis been given within the last 60 minutes?", requiresInitials: true, category: "Antibiotics" },
          { id: "4", itemAr: "عرض الصور والتقارير الطبية الهامة في غرفة العمليات", itemEn: "Are essential imaging displays available and shown?", requiresInitials: false, category: "Imaging" },
          { id: "5", itemAr: "مراجعة جراحية للأحداث غير المتوقعة والخطوات الحرجة والمدة وكمية الدم المفقودة المتوقعة", itemEn: "Surgeon reviews: critical steps, duration, anticipated blood loss", requiresInitials: true, category: "Surgeon Review" },
          { id: "6", itemAr: "مراجعة تخديرية لمخاوف واحتياجات المريض الخاصة ومخاطر الإنعاش", itemEn: "Anesthesiology team reviews: patient-specific concerns", requiresInitials: true, category: "Anesthesia Review" },
          { id: "7", itemAr: "مراجعة تمريضية لتعقيم الأدوات والمعدات وتأكيد سلامة المواد الاستهلاكية", itemEn: "Nursing team reviews: sterility confirmed, equipment concerns addressed", requiresInitials: true, category: "Nurse Review" }
        ],
        isActive: true,
      },
      {
        hospitalId: hospital.id,
        name: "WHO Surgical Safety Checklist - Sign Out (Before leaving OR)",
        nameAr: "قائمة منظمة الصحة العالمية لسلامة الجراحة - تسجيل الخروج (قبل مغادرة المريض غرفة العمليات)",
        phase: "sign_out",
        items: [
          { id: "1", itemAr: "تأكيد اسم العملية الجراحية التي تم تسجيلها شفهياً", itemEn: "Nurse verbally confirms name of the procedure recorded", requiresInitials: true, category: "Confirmation" },
          { id: "2", itemAr: "تأكيد مطابقة وصحة عد الآلات الجراحية والشاش والإبر كاملة", itemEn: "Instrument, sponge, and needle counts are correct", requiresInitials: true, category: "Counting" },
          { id: "3", itemAr: "تسمية وتوثيق عينات الأنسجة المأخوذة بشكل صحيح شفهياً باسم المريض", itemEn: "Verbal labeling of specimen (read patient name aloud)", requiresInitials: true, category: "Specimen" },
          { id: "4", itemAr: "تحديد أي أعطال أو مشكلات في الأجهزة الطبية تحتاج إلى معالجة", itemEn: "Are there any equipment problems to be addressed?", requiresInitials: false, category: "Equipment" },
          { id: "5", itemAr: "مراجعة الجراح وطبيب التخدير وممرض العمليات للمخاوف الرئيسية لتعافي المريض", itemEn: "Surgeon, anesthesiologist, and nurse review key concerns for recovery and management", requiresInitials: true, category: "Recovery Plan" }
        ],
        isActive: true,
      }
    ]);

    console.log("✅ Seeded WHO Surgical Safety Checklist Templates.");

    // 9. Drug-Drug Interactions (DDI)
    console.log("💊 Seeding Drug-Drug Interactions from JSON dataset...");
    const drugInteractionsPath = path.join(process.cwd(), "db", "clinical-data", "drug-interactions.json");
    if (fs.existsSync(drugInteractionsPath)) {
      const ddiRaw = fs.readFileSync(drugInteractionsPath, "utf-8");
      const ddiList = JSON.parse(ddiRaw);

      const ddiValues = ddiList.map((item: any) => ({
        drug1Name: item.drug1,
        drug2Name: item.drug2,
        drug1Generic: item.drug1, // fallback to standard drug name
        drug2Generic: item.drug2,
        severity: item.severity,
        mechanismEn: item.mechanismEn,
        mechanismAr: item.mechanismAr,
        clinicalEffectEn: item.clinicalEffectEn,
        clinicalEffectAr: item.clinicalEffectAr,
        managementAr: item.managementAr,
        category: item.category,
        source: "HMS-Egypt-DB-v1",
      }));

      // Chunk inserts to prevent query size limitations in Neon serverless payloads
      const chunkSize = 50;
      for (let i = 0; i < ddiValues.length; i += chunkSize) {
        const chunk = ddiValues.slice(i, i + chunkSize);
        await db.insert(schema.medicationInteractions).values(chunk);
      }
      console.log(`✅ Seeded ${ddiValues.length} Drug-Drug Interactions successfully.`);
    } else {
      console.warn("⚠️ Warning: drug-interactions.json not found in clinical-data directory.");
    }

    // 10. Lab tests with LOINC and CPT codes
    console.log("🔬 Seeding Lab Tests catalog with LOINC codes...");
    const loincPath = path.join(process.cwd(), "db", "clinical-data", "loinc-common.json");
    if (fs.existsSync(loincPath)) {
      const loincRaw = fs.readFileSync(loincPath, "utf-8");
      const loincList = JSON.parse(loincRaw);

      const labTestValues = loincList.slice(0, 100).map((item: any, idx: number) => ({
        hospitalId: hospital.id,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        loincCode: item.loincCode,
        cptCode: (80000 + idx).toString(), // mock CPT panel code
        normalRange: item.loincCode === "718-7" ? "12.0-16.0" : "70-110", // custom fallback sample
        unit: item.loincCode === "718-7" ? "g/dL" : "mg/dL",
        price: "150.00",
        isActive: true,
      }));

      const chunkSize = 50;
      for (let i = 0; i < labTestValues.length; i += chunkSize) {
        const chunk = labTestValues.slice(i, i + chunkSize);
        await db.insert(schema.labTests).values(chunk);
      }
      console.log(`✅ Seeded ${labTestValues.length} Lab Tests with standardized LOINC codes.`);
    } else {
      console.warn("⚠️ Warning: loinc-common.json not found in clinical-data directory.");
    }

    console.log("🎉 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed with database error:", error);
    process.exit(1);
  }
}

seed();
