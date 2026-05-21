import { pgTable, text, uuid, timestamp, boolean, varchar, pgEnum, index } from "drizzle-orm/pg-core";

export const hospitalTypeEnum = pgEnum("hospital_type", ["private", "government", "military", "ngo"]);

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

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
