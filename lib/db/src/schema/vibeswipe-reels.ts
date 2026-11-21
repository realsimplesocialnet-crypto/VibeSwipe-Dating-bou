import { sql } from "drizzle-orm";
import { doublePrecision, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  soundtrack: jsonb("soundtrack"),
  durationSeconds: doublePrecision("duration_seconds"),
  viewCount: integer("view_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  feed: index("vibeswipe_reels_feed_idx").on(t.createdAt, t.id),
  captionSearch: index("vibeswipe_reels_caption_search_idx").using("gin", sql`to_tsvector('english', coalesce(${t.caption}, ''))`),
}));

export const reelReportsTable = pgTable("vibeswipe_reel_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oneReportPerMember: uniqueIndex("vibeswipe_reel_reports_reporter_reel_idx").on(table.reporterId, table.reelId),
  byCreatedAt: index("vibeswipe_reel_reports_created_idx").on(table.createdAt),
}));

export const reelNotInterestedTable = pgTable("vibeswipe_reel_not_interested", {
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").notNull(),
  captionTerms: text("caption_terms").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_not_interested_pk", columns: [t.userId, t.reelId] }),
  byUser: index("vibeswipe_reel_not_interested_user_idx").on(t.userId, t.createdAt),
  creatorFk: foreignKey({
    name: "vibeswipe_reel_not_interested_creator_id_vibeswipe_profiles_id_",
    columns: [t.creatorId],
    foreignColumns: [profilesTable.id],
  }).onDelete("cascade"),
}));

export const reelSlidesTable = pgTable("vibeswipe_reel_slides", {
  reelId: uuid("reel_id").notNull(),
  mediaId: uuid("media_id").notNull(),
  position: integer("position").notNull(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_slides_pk", columns: [t.reelId, t.position] }),
  media: uniqueIndex("vibeswipe_reel_slides_media_idx").on(t.mediaId),
  reelFk: foreignKey({ name: "vibeswipe_reel_slides_reel_id_fkey", columns: [t.reelId], foreignColumns: [reelsTable.id] }).onDelete("cascade"),
  mediaFk: foreignKey({ name: "vibeswipe_reel_slides_media_id_fkey", columns: [t.mediaId], foreignColumns: [mediaAssetsTable.id] }).onDelete("cascade"),
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

export const reelRepostsTable = pgTable("vibeswipe_reel_reposts", {
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_reposts_pk", columns: [t.reelId, t.userId] }),
  byUser: index("vibeswipe_reel_reposts_user_idx").on(t.userId, t.createdAt),
}));

export const reelSharesTable = pgTable("vibeswipe_reel_shares", {
  reelId: uuid("reel_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_shares_pk", columns: [t.reelId, t.userId] }),
  reelFk: foreignKey({ name: "vibeswipe_reel_shares_reel_id_fkey", columns: [t.reelId], foreignColumns: [reelsTable.id] }).onDelete("cascade"),
  userFk: foreignKey({ name: "vibeswipe_reel_shares_user_id_fkey", columns: [t.userId], foreignColumns: [profilesTable.id] }).onDelete("cascade"),
}));

export const reelCommentsTable = pgTable("vibeswipe_reel_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reelId: uuid("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  parentCommentId: uuid("parent_comment_id"),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaId: uuid("media_id").references(() => mediaAssetsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byReel: index("vibeswipe_reel_comments_reel_idx").on(t.reelId, t.createdAt),
  byParent: index("vibeswipe_reel_comments_parent_idx").on(t.parentCommentId, t.createdAt),
  byMedia: index("vibeswipe_reel_comments_media_idx").on(t.mediaId),
}));

export const reelCommentReactionsTable = pgTable("vibeswipe_reel_comment_reactions", {
  commentId: uuid("comment_id").notNull().references(() => reelCommentsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reaction: text("reaction").$type<"like" | "dislike">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ name: "vibeswipe_reel_comment_reactions_pk", columns: [t.commentId, t.userId] }),
  byComment: index("vibeswipe_reel_comment_reactions_comment_idx").on(t.commentId, t.reaction),
}));

export type Reel = typeof reelsTable.$inferSelect;
export type ReelComment = typeof reelCommentsTable.$inferSelect;
