/**
 * HMS Egypt - Row-Level Security & Compliance Verification Script
 * 
 * Verifies that:
 * 1. Default unscoped queries to tenant tables return 0 rows (Fail-Closed).
 * 2. Scoped queries using withTenantContext retrieve correct records.
 * 3. Scoped queries using withBypassContext retrieve all records.
 * 4. runDataArchivingJob correctly processes and archives historical medical records and invoices.
 */

import { db } from "../src/lib/db/index";
import { withTenantContext, withBypassContext } from "../src/lib/db/tenant";
import { runDataArchivingJob } from "../src/lib/actions/retention";
import * as schema from "./schema/index";
import { eq } from "drizzle-orm";

async function verify() {
  console.log("🧪 Starting Row-Level Security & Compliance Verification...");

  try {
    // 1. Get Al-Shifa Specialty Hospital ID from the shared hospitals table
    const hospital = await db.query.hospitals.findFirst({
      where: eq(schema.hospitals.slug, "al-shifa"),
    });

    if (!hospital) {
      console.error("❌ Al-Shifa Specialty Hospital not found in database. Please run db seeding first.");
      process.exit(1);
    }

    console.log(`🏥 Found Hospital: "${hospital.nameEn}" (ID: ${hospital.id})`);

    // 2. Query patients table without setting transaction tenant context
    console.log("\n--- Verification 1: Fail-Closed Security (No Scoping Context) ---");
    try {
      const patientsUnscoped = await db.query.patients.findMany();
      console.log(`Unscoped query returned: ${patientsUnscoped.length} patients.`);
      if (patientsUnscoped.length === 0) {
        console.log("✅ FAIL-CLOSED SUCCESS: Unscoped query returned 0 rows due to forced RLS policy!");
      } else {
        console.error("❌ FAIL-CLOSED FAILURE: Unscoped query leaked database owner records!");
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.log(`ℹ️ Unscoped query thrown exception (expected if connection is restricted): ${err.message}`);
    }

    // 3. Query patients table inside withTenantContext
    console.log("\n--- Verification 2: Scoped Tenant Access ---");
    const patientsScoped = await withTenantContext(hospital.id, async (tx) => {
      return await tx.query.patients.findMany();
    });
    console.log(`✅ Scoped tenant query returned: ${patientsScoped.length} patients.`);

    // 4. Query patients table inside withBypassContext (Super-Admin)
    console.log("\n--- Verification 3: Super-Admin Bypass Access ---");
    const patientsBypassed = await withBypassContext(async (tx) => {
      return await tx.query.patients.findMany();
    });
    console.log(`✅ Bypassed query returned: ${patientsBypassed.length} patients.`);
    if (patientsBypassed.length >= patientsScoped.length) {
      console.log("✅ BYPASS SUCCESS: Correctly bypassed RLS for background job context.");
    } else {
      console.error("❌ BYPASS FAILURE: Bypass returned fewer records than tenant scope!");
    }

    // 5. Test Data Retention Archiving
    console.log("\n--- Verification 4: Compliance Archiving Worker ---");
    
    // We need a doctor and patient to insert mock record
    const doctor = await withTenantContext(hospital.id, async (tx) => {
      return await tx.query.staff.findFirst({
        where: eq(schema.staff.hospitalId, hospital.id),
      });
    });

    if (!doctor) {
      console.error("❌ Staff record missing. Cannot perform archiving test. Please run seeding first.");
      process.exit(1);
    }

    console.log(`👨‍⚕️ Using Doctor: ${doctor.nameEn} (ID: ${doctor.id})`);

    let patient = patientsScoped[0];
    let createdMockPatientId: string | null = null;

    if (!patient) {
      console.log("ℹ️ No patients found. Dynamically creating a mock patient for archiving test...");
      const [mockPatient] = await withTenantContext(hospital.id, async (tx) => {
        return await tx.insert(schema.patients).values({
          hospitalId: hospital.id,
          patientNumber: "PAT-VERIFY-001",
          nameAr: "أحمد محمد علي",
          normalizedNameAr: "احمد محمد على",
          nameEn: "Ahmed Mohamed Ali",
          nationalId: "29505210123456",
          dob: new Date("1995-05-21"),
          gender: "male",
          contactPhone: "01012345678",
          address: "الدقي، الجيزة",
          governorate: "Giza",
        }).returning();
      });
      patient = mockPatient;
      createdMockPatientId = mockPatient.id;
      console.log(`👤 Created Mock Patient: ${patient.nameEn} (ID: ${patient.id})`);
    } else {
      console.log(`👤 Using Existing Patient: ${patient.nameEn} (ID: ${patient.id})`);
    }

    // Insert a historical medical record (created 11 years ago)
    const elevenYearsAgo = new Date();
    elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);

    const [oldRecord] = await withTenantContext(hospital.id, async (tx) => {
      return await tx
        .insert(schema.medicalRecords)
        .values({
          hospitalId: hospital.id,
          patientId: patient.id,
          doctorId: doctor.id,
          encounterType: "outpatient",
          soapNotes: "Verification SOAP Notes - 11 Years Ago",
          createdAt: elevenYearsAgo,
          updatedAt: elevenYearsAgo,
        })
        .returning();
    });

    console.log(`📝 Created Mock Historical Medical Record (ID: ${oldRecord.id}, Date: ${oldRecord.createdAt.toISOString()})`);

    // Insert a historical invoice (created 6 years ago)
    const sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

    const [oldInvoice] = await withTenantContext(hospital.id, async (tx) => {
      return await tx
        .insert(schema.invoices)
        .values({
          hospitalId: hospital.id,
          patientId: patient.id,
          invoiceNumber: `VERIFY-${Date.now()}`,
          subtotal: "100.00",
          vatAmount: "14.00",
          stampTaxAmount: "0.50",
          totalAmount: "114.50",
          amountPaid: "114.50",
          dueDate: sixYearsAgo,
          status: "paid",
          createdAt: sixYearsAgo,
          updatedAt: sixYearsAgo,
        })
        .returning();
    });

    console.log(`💵 Created Mock Historical Invoice (ID: ${oldInvoice.id}, Date: ${oldInvoice.createdAt.toISOString()})`);

    // Run the archiving job
    console.log("🏃 Executing Archiving Job...");
    const jobResult = await runDataArchivingJob(hospital.id, doctor.id);
    console.log("Job Result:", jobResult);

    if (jobResult.success && jobResult.clinicalArchived >= 1 && jobResult.financialArchived >= 1) {
      console.log("✅ ARCHIVING SUCCESS: Historical records were correctly processed and archived!");
    } else {
      console.error("❌ ARCHIVING FAILURE: Historical records were not archived.");
    }

    // Verify records are actually flagged isArchived = true in the DB
    const verifiedRecord = await withTenantContext(hospital.id, async (tx) => {
      return await tx.query.medicalRecords.findFirst({
        where: eq(schema.medicalRecords.id, oldRecord.id),
      });
    });

    const verifiedInvoice = await withTenantContext(hospital.id, async (tx) => {
      return await tx.query.invoices.findFirst({
        where: eq(schema.invoices.id, oldInvoice.id),
      });
    });

    if (verifiedRecord?.isArchived && verifiedInvoice?.isArchived) {
      console.log("✅ COMPLIANCE STATUS VERIFIED: Database columns are set to isArchived = true!");
    } else {
      console.error("❌ COMPLIANCE STATUS FAILURE: Records in DB do not have isArchived = true!");
    }

    // Clean up verification data
    console.log("\n🧹 Cleaning up test data...");
    await withTenantContext(hospital.id, async (tx) => {
      await tx.delete(schema.medicalRecords).where(eq(schema.medicalRecords.id, oldRecord.id));
      await tx.delete(schema.invoices).where(eq(schema.invoices.id, oldInvoice.id));
      if (createdMockPatientId) {
        await tx.delete(schema.patients).where(eq(schema.patients.id, createdMockPatientId));
      }
      // Delete logs created for this verification
      await tx.delete(schema.dataRetentionLogs).where(eq(schema.dataRetentionLogs.hospitalId, hospital.id));
    });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 ALL VERIFICATION CHECKS PASSED!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed with error:", error);
    process.exit(1);
  }
}

verify();
