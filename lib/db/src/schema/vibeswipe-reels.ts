import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { mediaAssetsTable, profilesTable } from "./vibeswipe";

export const reelSafetyTable = pgTable("vibeswipe_reel_safety", {
  mediaId: uuid("media_id").primaryKey().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  version: text("version").notNull(),
  checkedPath: text("checked_path").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  result: jsonb("result"),
});

export const reelsTable = pgTable("vibeswipe_reels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().unique().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  durationSeconds: doublePrecision("duration_seconds"),
  viewCount: integer("view_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ feed: index("vibeswipe_reels_feed_idx").on(t.createdAt, t.id) }));

export const reelViewsTable = pgTable("vibeswipe_reel_views", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_views_pk", columns: [t.reelId, t.viewerId] }),
}));

export const reelLikesTable = pgTable("vibeswipe_reel_likes", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ name: "vibeswipe_reel_likes_pk", columns: [t.reelId, t.userId] }) }));

export const reelSavesTable = pgTable("vibeswipe_reel_saves", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_saves_pk", columns: [t.reelId, t.userId] }),
  byUser: index("vibeswipe_reel_saves_user_idx").on(t.userId, t.createdAt),
}));

export const reelCommentsTable = pgTable("vibeswipe_reel_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  parentCommentId: uuid("parent_comment_id"),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byReel: index("vibeswipe_reel_comments_reel_idx").on(t.reelId, t.createdAt) }));

export type Reel = typeof reelsTable.$inferSelect;
export type ReelComment = typeof reelCommentsTable.$inferSelect;
