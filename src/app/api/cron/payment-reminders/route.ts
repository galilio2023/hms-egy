import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withBypassContext } from "@/lib/db/tenant";
import { invoices } from "@db/schema/billing";
import { patients } from "@db/schema/patients";
import { sentReminders } from "@db/schema/system";
import { toCairoTime } from "@/lib/utils/egypt";
import { formatEGP } from "@/lib/utils/formatting";
import { and, eq, lte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization check - strict fail-closed across all environments
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured on the server.");
      return NextResponse.json({ error: "Unauthorized: Missing server configuration" }, { status: 401 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("⏰ Starting Payment Reminders Cron Job...");

    // 2. Compute date threshold (dueDate older than 7 days ago) in Cairo time
    const nowCairo = toCairoTime(new Date());
    const sevenDaysAgo = new Date(nowCairo);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log(`- Current Cairo Time: ${nowCairo.toISOString()}`);
    console.log(`- Overdue Cutoff (7 Days Ago): ${sevenDaysAgo.toISOString()}`);

    const results = await withBypassContext(async (tx) => {
      // 3. Fetch unpaid or partially paid invoices that are overdue by 7+ days
      const overdueInvoices = await tx
        .select({
          id: invoices.id,
          hospitalId: invoices.hospitalId,
          patientId: invoices.patientId,
          patientPhone: patients.contactPhone,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          invoiceNumber: invoices.invoiceNumber,
          totalAmount: invoices.totalAmount,
          dueDate: invoices.dueDate,
          status: invoices.status,
        })
        .from(invoices)
        .innerJoin(patients, eq(invoices.patientId, patients.id))
        .where(
          and(
            inArray(invoices.status, ["unpaid", "partially_paid"]),
            eq(invoices.isArchived, false),
            lte(invoices.dueDate, sevenDaysAgo)
          )
        )
        .limit(500);

      console.log(`Found ${overdueInvoices.length} unpaid/partially paid invoices overdue by 7+ days.`);

      const remindersToInsert: any[] = [];
      const overdueRemindersMap = new Map<string, any>();

      for (const invoice of overdueInvoices) {
        const key = `invoice_overdue_7days_${invoice.id}`;
        remindersToInsert.push({
          hospitalId: invoice.hospitalId,
          entityType: "invoice",
          entityId: invoice.id,
          reminderType: "overdue_7days",
          channel: "sms",
          patientId: invoice.patientId,
          success: true,
          sentAt: new Date(),
        });
        overdueRemindersMap.set(key, invoice);
      }

      let remindersSent = 0;
      let duplicatesSkipped = 0;

      if (remindersToInsert.length > 0) {
        const insertedLogs = await tx
          .insert(sentReminders)
          .values(remindersToInsert)
          .onConflictDoNothing()
          .returning();

        remindersSent = insertedLogs.length;
        duplicatesSkipped = remindersToInsert.length - remindersSent;

        return { remindersSent, duplicatesSkipped, insertedLogs, overdueRemindersMap };
      }

      return { remindersSent, duplicatesSkipped, insertedLogs: [], overdueRemindersMap };
    });

    // 4. Safely perform simulated network I/O (SMS Gateway) outside the database transaction block
    for (const log of results.insertedLogs) {
      const key = `${log.entityType}_overdue_7days_${log.entityId}`;
      const invoice = results.overdueRemindersMap.get(key);
      if (invoice) {
        const rawAmount = parseFloat(invoice.totalAmount);
        const formattedAmount = formatEGP(rawAmount, { arabic: false });

        // Log/Simulate SMS Gateway Delivery
        console.log(`[OVERDUE SMS SENT] To: ${invoice.patientPhone || "N/A"} (${invoice.patientNameAr || invoice.patientNameEn})`);
        console.log(`Message: تذكير بالدفع: نود تذكيركم بوجود فاتورة مستحقة برقم ${invoice.invoiceNumber} بمبلغ ${formattedAmount} ج.م في HMS مصر. يرجى السداد في أقرب وقت.`);
        // STUB: await sendEgyptianSms(invoice.patientPhone, msg, "VictoryLink");
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment reminders cron executed successfully.",
      stats: results,
    });
  } catch (error: any) {
    console.error("❌ [CRON_PAYMENT_REMINDERS_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
