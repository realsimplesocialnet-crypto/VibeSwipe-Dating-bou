import { foreignKey, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { profilesTable } from "./vibeswipe";

/** No selfie, facial template or biometric score is persisted. */
export const faceVerificationSessionsTable = pgTable("vibeswipe_face_verification_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  mainPhoto: text("main_photo").notNull(),
  referencePhoto: text("reference_photo"),
  sealedPhoto: text("sealed_photo"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  rejectionReason: text("rejection_reason"),
  status: text("status").$type<"pending" | "processing" | "failed" | "passed" | "awaiting_review" | "approved" | "rejected" | "cancelled">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => ({
  userCreated: index("vibeswipe_face_verification_user_created").on(table.userId, table.createdAt),
  reviewQueue: index("vibeswipe_face_verification_review_queue").on(table.status, table.createdAt),
  userFk: foreignKey({
    name: "vibeswipe_face_verification_sessions_user_id_vibeswipe_profiles",
    columns: [table.userId],
    foreignColumns: [profilesTable.id],
  }).onDelete("cascade"),
}));

export const insertFaceVerificationSessionSchema = createInsertSchema(faceVerificationSessionsTable).omit({ id: true, createdAt: true });
export type FaceVerificationSessionRow = typeof faceVerificationSessionsTable.$inferSelect;
export type InsertFaceVerificationSession = typeof faceVerificationSessionsTable.$inferInsert;
