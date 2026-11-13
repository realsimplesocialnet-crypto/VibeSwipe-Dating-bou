import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { profilesTable } from "./vibeswipe";

export const emergencyContactsTable = pgTable(
  "vibeswipe_emergency_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userSlotUnique: uniqueIndex("vibeswipe_emergency_contacts_user_slot_idx").on(
      table.userId,
      table.slot,
    ),
    slotRange: check(
      "vibeswipe_emergency_contacts_slot_check",
      sql`${table.slot} >= 1 AND ${table.slot} <= 3`,
    ),
  }),
);

export const insertEmergencyContactSchema = createInsertSchema(
  emergencyContactsTable,
).omit({ id: true, userId: true, slot: true, createdAt: true });
export type InsertEmergencyContact = typeof emergencyContactsTable.$inferInsert;
export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;

export const liveLocationSharesTable = pgTable(
  "vibeswipe_live_location_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  },
  (table) => ({
    latitudeRange: check(
      "vibeswipe_live_location_shares_latitude_check",
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`,
    ),
    longitudeRange: check(
      "vibeswipe_live_location_shares_longitude_check",
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`,
    ),
  }),
);

export const insertLiveLocationShareSchema = createInsertSchema(
  liveLocationSharesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stoppedAt: true,
});
export type InsertLiveLocationShare = typeof liveLocationSharesTable.$inferInsert;
export type LiveLocationShare = typeof liveLocationSharesTable.$inferSelect;
