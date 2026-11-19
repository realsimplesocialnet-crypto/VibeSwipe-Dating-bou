import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  mediaType: text("media_type").notNull().default("video"),
  audience: text("audience").$type<"public" | "friends">().notNull().default("public"),
  caption: text("caption").notNull().default(""),
  durationSeconds: doublePrecision("duration_seconds"),
  viewCount: integer("view_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ feed: index("vibeswipe_reels_feed_idx").on(t.createdAt, t.id) }));

export const reelNotInterestedTable = pgTable("vibeswipe_reel_not_interested", {
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  captionTerms: text("caption_terms").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_not_interested_pk", columns: [t.userId, t.reelId] }),
  byUser: index("vibeswipe_reel_not_interested_user_idx").on(t.userId, t.createdAt),
}));

export const reelSlidesTable = pgTable("vibeswipe_reel_slides", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_slides_pk", columns: [t.reelId, t.position] }),
  media: uniqueIndex("vibeswipe_reel_slides_media_idx").on(t.mediaId),
}));

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

export const reelSharesTable = pgTable("vibeswipe_reel_shares", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_shares_pk", columns: [t.reelId, t.userId] }),
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
