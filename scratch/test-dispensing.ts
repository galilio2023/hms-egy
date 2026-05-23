import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env BEFORE any imports that instantiate the DB connection
config({ path: resolve(process.cwd(), ".env") });

async function runTest() {
  console.log("🧪 Starting Pharmacy Dispensing Database Integration Test (RLS Aware)...");

  try {
    // Dynamically import files that establish DB connections or depend on DATABASE_URL
    const { withBypassContext } = await import("../src/lib/db/tenant");
    const { medications, prescriptions, prescriptionItems, stockTransactions } = await import("../db/schema/pharmacy");
    const { patients } = await import("../db/schema/patients");
    const { staff, hospitals } = await import("../db/schema/core");
    const { eq, and } = await import("drizzle-orm");

    await withBypassContext(async (tx) => {
      // 1. Fetch a hospital
      const hospital = await tx.query.hospitals.findFirst();
      if (!hospital) {
        console.log("❌ Setup Error: No hospital found. Please seed the database first.");
        process.exit(1);
      }
      console.log(`✅ Using Hospital: ${hospital.nameEn} (${hospital.id})`);

      // 2. Fetch or create a patient
      let patient = await tx.query.patients.findFirst();
      if (!patient) {
        console.log("🌱 Database clean: Seeding a test patient...");
        const [insertedPatient] = await tx
          .insert(patients)
          .values({
            hospitalId: hospital.id,
            patientNumber: "PAT-TEST-101",
            nameAr: "مريض تجريبي",
            normalizedNameAr: "مريض تجريبي",
            nameEn: "Test Patient",
            dob: new Date("1990-01-01"),
            gender: "male",
            contactPhone: "+201009988776",
            address: "123 Test St, Cairo",
            governorate: "Cairo",
            allergies: ["Penicillin"],
            chronicConditions: ["Hypertension"],
            nationalId: "29001010101235", // Satisfies both constraints (not null check and regex check)
          })
          .returning();
        patient = insertedPatient;
      }
      console.log(`✅ Using Patient: ${patient.nameEn} (${patient.id})`);

      // 3. Fetch or create a doctor / staff
      let doctor = await tx.query.staff.findFirst();
      if (!doctor) {
        console.log("🌱 Database clean: Seeding a test doctor...");
        const [insertedDoctor] = await tx
          .insert(staff)
          .values({
            hospitalId: hospital.id,
            nameAr: "د. طبيب تجريبي",
            nameEn: "Dr. Test Doctor",
            role: "DOCTOR",
            email: "doctor.test@hms.gov.eg",
            phone: "+201122334455",
            licenseNumber: "LIC-TEST-1234",
            isActive: true,
          })
          .returning();
        doctor = insertedDoctor;
      }
      console.log(`✅ Using Doctor: ${doctor.nameEn} (${doctor.id})`);

      // 4. Create or get test medication
      let [med] = await tx
        .select()
        .from(medications)
        .where(and(eq(medications.hospitalId, hospital.id), eq(medications.barcode, "999888777666")))
        .limit(1);

      if (!med) {
        console.log("🌱 Creating test medication...");
        [med] = await tx
          .insert(medications)
          .values({
            hospitalId: hospital.id,
            nameAr: "دواء تجريبي",
            nameEn: "Test Med 500mg",
            genericName: "TestGeneric",
            form: "tablet",
            strength: "500 mg",
            barcode: "999888777666",
            stockCount: 100,
            minStockLevel: 5,
            price: "15.50",
            isActive: true,
          })
          .returning();
      } else {
        // Reset stock
        await tx
          .update(medications)
          .set({ stockCount: 100 })
          .where(eq(medications.id, med.id));
        med.stockCount = 100;
      }
      console.log(`✅ Test Medication: ${med.nameEn}, Barcode: ${med.barcode}, Stock: ${med.stockCount}`);

      // 5. Create a prescription
      console.log("🌱 Creating test prescription...");
      const [rx] = await tx
        .insert(prescriptions)
        .values({
          hospitalId: hospital.id,
          patientId: patient.id,
          doctorId: doctor.id,
          notes: "Test notes for dispensing integration",
          status: "active",
        })
        .returning();

      console.log(`✅ Prescription Created: ${rx.id}`);

      // 6. Create prescription item
      const [rxItem] = await tx
        .insert(prescriptionItems)
        .values({
          hospitalId: hospital.id,
          prescriptionId: rx.id,
          medicationId: med.id,
          dosage: "1 tablet",
          frequency: "twice daily",
          durationDays: 10,
          instructions: "Take after meals",
          status: "pending",
          dispensedCount: 0,
        })
        .returning();

      console.log(`✅ Prescription Item Created: ${rxItem.id}`);

      // 7. Simulate Dispensing
      console.log("🌱 Simulating dispensing of 20 units...");
      const qtyToDispense = 20;

      // Verify stock
      const [freshMed] = await tx
        .select({ stockCount: medications.stockCount })
        .from(medications)
        .where(eq(medications.id, med.id));

      if (freshMed.stockCount < qtyToDispense) {
        throw new Error("Insufficient stock");
      }

      // Deduct stock
      await tx
        .update(medications)
        .set({ stockCount: freshMed.stockCount - qtyToDispense })
        .where(eq(medications.id, med.id));

      // Record stock transaction
      await tx.insert(stockTransactions).values({
        hospitalId: hospital.id,
        medicationId: med.id,
        type: "dispense",
        quantity: -qtyToDispense,
        notes: `Dispensed for prescription ${rx.id}`,
        performedBy: doctor.id,
      });

      // Update prescription item
      await tx
        .update(prescriptionItems)
        .set({
          dispensedCount: qtyToDispense,
          status: "dispensed",
        })
        .where(eq(prescriptionItems.id, rxItem.id));

      // Update prescription status if all items completed
      const allItems = await tx
        .select()
        .from(prescriptionItems)
        .where(eq(prescriptionItems.prescriptionId, rx.id));

      const allCompleted = allItems.every((item) => item.status === "dispensed" || item.status === "cancelled");
      if (allCompleted) {
        await tx
          .update(prescriptions)
          .set({ status: "completed" })
          .where(eq(prescriptions.id, rx.id));
        console.log("✅ Prescription status updated to 'completed'");
      }

      // 8. Verify post-dispense state
      const [finalMed] = await tx.select().from(medications).where(eq(medications.id, med.id));
      const [finalRxItem] = await tx.select().from(prescriptionItems).where(eq(prescriptionItems.id, rxItem.id));
      const [finalRx] = await tx.select().from(prescriptions).where(eq(prescriptions.id, rx.id));

      console.log("📊 Final Verification Results:");
      console.log(`- Medication stock level: ${finalMed.stockCount} (Expected: 80) - ${finalMed.stockCount === 80 ? "PASSED" : "FAILED"}`);
      console.log(`- Prescription item status: ${finalRxItem.status} (Expected: dispensed) - ${finalRxItem.status === "dispensed" ? "PASSED" : "FAILED"}`);
      console.log(`- Prescription status: ${finalRx.status} (Expected: completed) - ${finalRx.status === "completed" ? "PASSED" : "FAILED"}`);

      // Cleanup test data
      console.log("🧼 Cleaning up test records...");
      await tx.delete(stockTransactions).where(eq(stockTransactions.notes, `Dispensed for prescription ${rx.id}`));
      await tx.delete(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id));
      await tx.delete(prescriptions).where(eq(prescriptions.id, rx.id));
      
      console.log("🎉 Integration Test Completed Successfully!");
    });

  } catch (error: any) {
    console.error("❌ Test failed with error stack:");
    console.error(error);
  }
}

runTest();
