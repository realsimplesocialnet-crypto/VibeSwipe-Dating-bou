import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { profilesTable } from "./vibeswipe";

/** No selfie, facial template or biometric score is persisted. */
export const faceVerificationSessionsTable = pgTable("vibeswipe_face_verification_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  mainPhoto: text("main_photo").notNull(),
  status: text("status").$type<"pending" | "processing" | "failed" | "passed">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("vibeswipe_face_verification_user_created").on(table.userId, table.createdAt)]);

export const insertFaceVerificationSessionSchema = createInsertSchema(faceVerificationSessionsTable).omit({ id: true, createdAt: true });
export type FaceVerificationSessionRow = typeof faceVerificationSessionsTable.$inferSelect;
export type InsertFaceVerificationSession = typeof faceVerificationSessionsTable.$inferInsert;
