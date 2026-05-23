import { db } from "@/lib/db";
import { getHospitalBySlug } from "@/lib/db/cache";
import { withTenantContext } from "@/lib/db/tenant";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { rooms, beds } from "@db/schema/clinical";
import { staff } from "@db/schema/core";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { eq, and, or, inArray, desc, sql, gte, lt } from "drizzle-orm";
import HousekeepingDashboardClient from "./HousekeepingDashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const t = await getTranslations({ locale, namespace: "housekeeping" });
  
  const hospital = await getHospitalBySlug(hospitalSlug);
  const hospitalName = hospital 
    ? (locale === "ar" ? hospital.nameAr : hospital.nameEn)
    : "Hospital";

  return {
    title: `${t("title") || "Housekeeping Queue"} | ${hospitalName} | HMS Egypt`,
    description: "Real-time housekeeping task queue, bed disinfection map, and cleaning metrics.",
  };
}

export default async function HousekeepingPage({
  params,
}: {
  params: Promise<{ locale: string; hospitalSlug: string }>;
}) {
  const { locale, hospitalSlug } = await params;
  const session = await auth();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Route Guard: Restrict access to housekeeping, administrative, and nursing roles
  const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "HOUSEKEEPING", "NURSE", "OR_NURSE"];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    notFound();
  }

  const hospital = await getHospitalBySlug(hospitalSlug);
  if (!hospital) {
    notFound();
  }

  // Cross-tenant protection
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const currentHospitalId = session.activeHospitalId || session.user.hospitalId;
  if (!isSuperAdmin && currentHospitalId !== hospital.id) {
    notFound();
  }

  // Query database in tenant context
  const dashboardData = await withTenantContext(hospital.id, async (tx) => {
    // Calculate Cairo day boundaries in UTC for a sargable query
    const now = new Date();
    const cairoFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = cairoFormatter.formatToParts(now);
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    
    // Create UTC boundaries by assuming Cairo is between UTC+2 and UTC+3
    // A safer way is to let the DB calculate the UTC timestamp for 00:00:00 Cairo time
    const result = await tx.execute(sql`
      SELECT 
        (CURRENT_DATE AT TIME ZONE 'Africa/Cairo' AT TIME ZONE 'UTC') as start_utc,
        ((CURRENT_DATE + 1) AT TIME ZONE 'Africa/Cairo' AT TIME ZONE 'UTC') as end_utc
    `);
    
    const timeBoundaries = result.rows[0];
    const startOfCairoDayUtc = new Date(timeBoundaries.start_utc as string);
    const endOfCairoDayUtc = new Date(timeBoundaries.end_utc as string);

    const [
      roomsList,
      bedsWithRooms,
      tasksQueue,
      housekeepingStaff,
      completedToday,
      currentUserStaff,
    ] = await Promise.all([
      // A. Fetch all rooms
      tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          type: rooms.type,
          floor: rooms.floor,
          wing: rooms.wing,
          isActive: rooms.isActive,
        })
        .from(rooms)
        .where(eq(rooms.hospitalId, hospital.id))
        .orderBy(rooms.roomNumber),

      // B. Fetch all beds joined with rooms details
      tx
        .select({
          bedId: beds.id,
          bedNumber: beds.bedNumber,
          status: beds.status,
          lastDischargedAt: beds.lastDischargedAt,
          cleaningRequestedAt: beds.cleaningRequestedAt,
          roomId: rooms.id,
          roomNumber: rooms.roomNumber,
          roomType: rooms.type,
          floor: rooms.floor,
          wing: rooms.wing,
        })
        .from(beds)
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .where(eq(beds.hospitalId, hospital.id))
        .orderBy(beds.bedNumber),

      // C. Fetch all pending and in_progress housekeeping tasks
      tx
        .select({
          id: housekeepingTasks.id,
          bedId: housekeepingTasks.bedId,
          roomId: housekeepingTasks.roomId,
          type: housekeepingTasks.type,
          status: housekeepingTasks.status,
          priority: housekeepingTasks.priority,
          requestedAt: housekeepingTasks.requestedAt,
          startedAt: housekeepingTasks.startedAt,
          completedAt: housekeepingTasks.completedAt,
          notes: housekeepingTasks.notes,
          assignedTo: housekeepingTasks.assignedTo,
          assignedStaffNameAr: staff.nameAr,
          assignedStaffNameEn: staff.nameEn,
          bedNumber: beds.bedNumber,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          wing: rooms.wing,
        })
        .from(housekeepingTasks)
        .leftJoin(beds, eq(housekeepingTasks.bedId, beds.id))
        .leftJoin(rooms, eq(housekeepingTasks.roomId, rooms.id))
        .leftJoin(staff, eq(housekeepingTasks.assignedTo, staff.id))
        .where(
          and(
            eq(housekeepingTasks.hospitalId, hospital.id),
            inArray(housekeepingTasks.status, ["pending", "in_progress"])
          )
        )
        .orderBy(desc(housekeepingTasks.priority), desc(housekeepingTasks.requestedAt)),

      // D. Fetch active housekeeping staff list for dropdown assignment
      tx
        .select({
          id: staff.id,
          nameAr: staff.nameAr,
          nameEn: staff.nameEn,
        })
        .from(staff)
        .where(
          and(
            eq(staff.hospitalId, hospital.id),
            eq(staff.role, "HOUSEKEEPING"),
            eq(staff.isActive, true)
          )
        )
        .orderBy(staff.nameEn),

      // E. Fetch tasks completed today for supervisor metrics
      tx
        .select({
          id: housekeepingTasks.id,
          status: housekeepingTasks.status,
          priority: housekeepingTasks.priority,
          requestedAt: housekeepingTasks.requestedAt,
          startedAt: housekeepingTasks.startedAt,
          completedAt: housekeepingTasks.completedAt,
        })
        .from(housekeepingTasks)
        .where(
          and(
            eq(housekeepingTasks.hospitalId, hospital.id),
            eq(housekeepingTasks.status, "completed"),
            gte(housekeepingTasks.completedAt, startOfCairoDayUtc),
            lt(housekeepingTasks.completedAt, endOfCairoDayUtc)
          )
        ),

      // F. Fetch current user staff record
      tx
        .select({
          id: staff.id,
          nameAr: staff.nameAr,
          nameEn: staff.nameEn,
        })
        .from(staff)
        .where(
          and(
            eq(staff.userId, session.user.id),
            eq(staff.hospitalId, hospital.id)
          )
        )
        .limit(1)
        .then((res) => res[0] || null),
    ]);

    return {
      roomsList,
      bedsWithRooms,
      tasksQueue,
      housekeepingStaff,
      completedToday,
      currentUserStaff,
    };
  });

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <HousekeepingDashboardClient
        locale={locale}
        hospitalSlug={hospitalSlug}
        rooms={dashboardData.roomsList}
        bedsData={dashboardData.bedsWithRooms}
        tasks={dashboardData.tasksQueue}
        staffList={dashboardData.housekeepingStaff}
        completedTasks={dashboardData.completedToday}
        currentUserStaff={dashboardData.currentUserStaff}
        currentUserRole={session.user.role}
      />
    </div>
  );
}
