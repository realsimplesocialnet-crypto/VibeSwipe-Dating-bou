import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminAuditTable = pgTable("vibeswipe_admin_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  created: index("vibeswipe_admin_audit_created_idx").using(
    "btree",
    table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
  ),
}));

// No FK: private-object cleanup must survive deletion of its owning account/chat.
export const adminMediaDeletionTable = pgTable("vibeswipe_admin_media_deletions", {
  objectPath: text("object_path").primaryKey(),
  mediaId: uuid("media_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminDeletedUsersTable = pgTable("vibeswipe_admin_deleted_users", {
  userId: text("user_id").primaryKey(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
});
