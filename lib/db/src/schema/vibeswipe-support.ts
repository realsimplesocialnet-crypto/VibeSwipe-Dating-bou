import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./vibeswipe";

export const screenTimeDailyTable = pgTable("vibeswipe_screen_time_daily", {
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  usageDate: date("usage_date", { mode: "string" }).notNull(),
  secondsUsed: integer("seconds_used").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ name: "vibeswipe_screen_time_daily_pk", columns: [table.userId, table.usageDate] }),
  usageNonNegative: check("vibeswipe_screen_time_daily_seconds_check", sql`${table.secondsUsed} >= 0 AND ${table.secondsUsed} <= 86400`),
  byDate: index("vibeswipe_screen_time_daily_date_idx").on(table.usageDate),
}));

export const supportRequestsTable = pgTable("vibeswipe_support_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  details: text("details").notNull(),
  status: text("status").notNull().default("new"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  byCreatedAt: index("vibeswipe_support_requests_created_idx").on(table.createdAt),
  byReporter: index("vibeswipe_support_requests_reporter_idx").on(table.reporterId, table.createdAt),
}));
