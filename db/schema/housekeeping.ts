import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, varchar, index , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { rooms, beds } from "./clinical";
import { housekeepingTaskStatusEnum } from "./enums";

export const housekeepingTasks = pgTable("housekeeping_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  bedId: uuid("bed_id").references(() => beds.id, { onDelete: "cascade" }),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // post_discharge, routine, pre_admission, deep_clean, isolation_terminal
  status: housekeepingTaskStatusEnum("status").default("pending").notNull(),
  priority: varchar("priority", { length: 50 }).default("routine").notNull(), // routine, urgent
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  assignedTo: uuid("assigned_to").references(() => staff.id, { onDelete: "set null" }), // Housekeeping staff member
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completionPhotoUrl: text("completion_photo_url"),
  notes: text("notes"),
  requestedBy: uuid("requested_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalQueueIdx: index("hk_hospital_status_priority_idx").on(table.hospitalId, table.status, table.priority),
  };
});
