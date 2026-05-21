import { pgTable, text, uuid, timestamp, boolean, varchar, index, integer, time } from "drizzle-orm/pg-core";
import { hospitalTypeEnum, roleEnum } from "./enums";

export const hospitals = pgTable("hospitals", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  address: text("address").notNull(),
  governorate: text("governorate").notNull(),
  type: hospitalTypeEnum("type").notNull(),
  logoUrl: text("logo_url"),
  planTier: varchar("plan_tier", { length: 50 }).default("starter").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    governorateIdx: index("gov_idx").on(table.governorate),
    isActiveIdx: index("active_idx").on(table.isActive),
  };
});

export const hospitalSettings = pgTable("hospital_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull().unique(),

  // Enabled Modules
  isSurgicalEnabled: boolean("is_surgical_enabled").default(false),
  isTelemedicineEnabled: boolean("is_telemedicine_enabled").default(false),
  isPatientPortalEnabled: boolean("is_patient_portal_enabled").default(false),
  isOnlinePaymentsEnabled: boolean("is_online_payments_enabled").default(false),

  // Regional settings
  timezone: text("timezone").default("Africa/Cairo"),
  currency: text("currency").default("EGP"),

  // Paymob Credentials
  paymobApiKey: text("paymob_api_key"),
  paymobCardId: text("paymob_card_id"),
  paymobWalletId: text("paymob_wallet_id"),
  paymobFawryId: text("paymob_fawry_id"),
  paymobHmacSecret: text("paymob_hmac_secret"),

  // Surgical & Housekeeping settings
  orCleaningDuration: integer("or_cleaning_duration").default(30).notNull(),
  autoHousekeeping: boolean("auto_housekeeping").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalIdIdx: index("dept_hospital_idx").on(table.hospitalId),
    codeIdx: index("dept_code_idx").on(table.code),
  };
});

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 255 }), // Links to auth user ID when configured
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  role: roleEnum("role").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number"), // For doctors and medical professionals
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalIdIdx: index("staff_hospital_idx").on(table.hospitalId),
    emailIdx: index("staff_email_idx").on(table.email),
    roleIdx: index("staff_role_idx").on(table.role),
  };
});

export const operatingRooms = pgTable("operating_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  floor: text("floor").notNull(),
  wing: text("wing"),
  type: text("type").notNull(), // e.g. general, cardiac, orthopedic
  equipmentList: text("equipment_list").array(), // list of available equipment items
  isActive: boolean("is_active").default(true).notNull(),
  cleaningDurationMinutes: integer("cleaning_duration_minutes").default(30).notNull(),
  nextAvailableAt: timestamp("next_available_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalActiveIdx: index("or_hospital_active_idx").on(table.hospitalId, table.isActive),
  };
});

export const orBlocks = pgTable("or_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  orRoomId: uuid("or_room_id").references(() => operatingRooms.id, { onDelete: "cascade" }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }).notNull(),
  owningDoctorId: uuid("owning_doctor_id").references(() => staff.id, { onDelete: "set null" }), // Surgeon owning block
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday to Saturday)
  startTime: time("start_time").notNull(), // e.g. "08:00:00"
  endTime: time("end_time").notNull(), // e.g. "14:00:00"
  blockName: text("block_name").notNull(),
  isRecurring: boolean("is_recurring").default(true).notNull(),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalRoomIdx: index("orb_hospital_room_idx").on(table.hospitalId, table.orRoomId),
    dayTimeIdx: index("orb_day_time_idx").on(table.dayOfWeek, table.startTime),
  };
});

export const orBlockOverrides = pgTable("or_block_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  orBlockId: uuid("or_block_id").references(() => orBlocks.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  type: text("type").notNull(), // cancelled, modified, emergency_takeover
  reason: text("reason").notNull(),
  newStartTime: time("new_start_time"),
  newEndTime: time("new_end_time"),
  createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalBlockDateIdx: index("obo_hospital_block_date_idx").on(table.hospitalId, table.orBlockId, table.date),
  };
});
