import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withBypassContext } from "@/lib/db/tenant";
import { appointments } from "@db/schema/clinical";
import { patients } from "@db/schema/patients";
import { staff, departments } from "@db/schema/core";
import { sentReminders } from "@db/schema/system";
import { toCairoTime } from "@/lib/utils/egypt";
import { and, eq, or, sql } from "drizzle-orm";

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

    console.log("⏰ Starting Appointment Reminders Cron Job...");

    // 2. Compute date boundaries in Cairo Timezone
    const nowCairo = toCairoTime(new Date());
    
    // Normalize today and tomorrow midnight to match scheduledDate normalized pattern
    const todayMidnight = new Date(Date.UTC(
      nowCairo.getFullYear(),
      nowCairo.getMonth(),
      nowCairo.getDate(),
      0, 0, 0, 0
    ));
    
    const tomorrowCairo = new Date(nowCairo);
    tomorrowCairo.setDate(tomorrowCairo.getDate() + 1);
    
    const tomorrowMidnight = new Date(Date.UTC(
      tomorrowCairo.getFullYear(),
      tomorrowCairo.getMonth(),
      tomorrowCairo.getDate(),
      0, 0, 0, 0
    ));

    console.log(`- Current Cairo Time: ${nowCairo.toISOString()}`);
    console.log(`- Today Midnight: ${todayMidnight.toISOString()}`);
    console.log(`- Tomorrow Midnight: ${tomorrowMidnight.toISOString()}`);

    const toISODate = (date: Date) => date.toISOString().split("T")[0];
    const todayStr = toISODate(todayMidnight);
    const tomorrowStr = toISODate(tomorrowMidnight);

    const results = await withBypassContext(async (tx) => {
      // 3. Fetch scheduled appointments matching today or tomorrow that haven't received their reminder yet
      const apps = await tx
        .select({
          id: appointments.id,
          hospitalId: appointments.hospitalId,
          patientId: appointments.patientId,
          patientPhone: patients.contactPhone,
          patientNameAr: patients.nameAr,
          patientNameEn: patients.nameEn,
          doctorId: appointments.doctorId,
          doctorNameAr: staff.nameAr,
          doctorNameEn: staff.nameEn,
          departmentId: appointments.departmentId,
          departmentNameAr: departments.nameAr,
          departmentNameEn: departments.nameEn,
          scheduledDate: appointments.scheduledDate,
          startTime: appointments.startTime,
          status: appointments.status,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(staff, eq(appointments.doctorId, staff.id))
        .innerJoin(departments, eq(appointments.departmentId, departments.id))
        .leftJoin(
          sentReminders,
          and(
            eq(sentReminders.entityId, appointments.id),
            or(
              and(
                eq(appointments.scheduledDate, tomorrowMidnight),
                eq(sentReminders.reminderType, "24h_reminder")
              ),
              and(
                eq(appointments.scheduledDate, todayMidnight),
                eq(sentReminders.reminderType, "2h_reminder")
              )
            )
          )
        )
        .where(
          and(
            eq(appointments.status, "scheduled"),
            or(
              eq(appointments.scheduledDate, todayMidnight),
              eq(appointments.scheduledDate, tomorrowMidnight)
            ),
            isNull(sentReminders.id)
          )
        )
        .limit(500);

      console.log(`Found ${apps.length} total active scheduled appointments for today/tomorrow.`);

      const remindersToInsert: any[] = [];
      const appRemindersMap = new Map<string, { type: "24h_reminder" | "2h_reminder", app: any }>();

      for (const app of apps) {
        const appDate = app.scheduledDate instanceof Date ? app.scheduledDate : new Date(app.scheduledDate);
        const appDateStr = toISODate(appDate);

        // 4. Handle 24h Tomorrow Reminders
        if (appDateStr === tomorrowStr) {
          const key = `appointment_24h_${app.id}`;
          remindersToInsert.push({
            hospitalId: app.hospitalId,
            entityType: "appointment",
            entityId: app.id,
            reminderType: "24h_reminder",
            channel: "sms",
            patientId: app.patientId,
            success: true,
            sentAt: new Date(),
          });
          appRemindersMap.set(key, { type: "24h_reminder", app });
        }

        // 5. Handle 2h Today Urgent Reminders
        if (appDateStr === todayStr) {
          const [sh, sm] = app.startTime.split(":").map(Number);
          const appTimeCairo = new Date(todayMidnight);
          appTimeCairo.setHours(sh, sm, 0, 0);

          const diffMs = appTimeCairo.getTime() - nowCairo.getTime();
          const diffMinutes = diffMs / (60 * 1000);

          // If the appointment starts within 2 hours (0 to 120 minutes in the future)
          if (diffMinutes > 0 && diffMinutes <= 120) {
            const key = `appointment_2h_${app.id}`;
            remindersToInsert.push({
              hospitalId: app.hospitalId,
              entityType: "appointment",
              entityId: app.id,
              reminderType: "2h_reminder",
              channel: "sms",
              patientId: app.patientId,
              success: true,
              sentAt: new Date(),
            });
            appRemindersMap.set(key, { type: "2h_reminder", app });
          }
        }
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
        
        return { remindersSent, duplicatesSkipped, insertedLogs, appRemindersMap };
      }

      return { remindersSent, duplicatesSkipped, insertedLogs: [], appRemindersMap };
    });

    // 6. Safely perform simulated network I/O (SMS Gateway) outside the database transaction block
    for (const log of results.insertedLogs) {
      const key = `${log.entityType}_${log.reminderType === "24h_reminder" ? "24h" : "2h"}_${log.entityId}`;
      const mapped = results.appRemindersMap.get(key);
      if (mapped) {
        const { type, app } = mapped;
        if (type === "24h_reminder") {
          const msg = `تذكير: موعدكم غداً في عيادة ${app.departmentNameAr} مع د. ${app.doctorNameAr} الساعة ${app.startTime.substring(0, 5)} في HMS مصر. لخدمتكم.`;
          console.log(`[24h SMS SENT] To: ${app.patientPhone || "N/A"} (${app.patientNameAr || app.patientNameEn})`);
          console.log(`Message: ${msg}`);
          // STUB: await sendEgyptianSms(app.patientPhone, msg, "VictoryLink");
        } else {
          const msg = `تذكير عاجل: موعدكم اليوم خلال ساعتين في عيادة ${app.departmentNameAr} مع د. ${app.doctorNameAr} الساعة ${app.startTime.substring(0, 5)} في HMS مصر.`;
          console.log(`[2h SMS SENT] To: ${app.patientPhone || "N/A"} (${app.patientNameAr || app.patientNameEn})`);
          console.log(`Message: ${msg}`);
          // STUB: await sendEgyptianSms(app.patientPhone, msg, "CEQUENS");
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Appointment reminders cron executed successfully.",
      stats: results,
    });
  } catch (error: any) {
    console.error("❌ [CRON_APPOINTMENT_REMINDERS_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
