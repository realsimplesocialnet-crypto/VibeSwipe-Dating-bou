import { doublePrecision, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { mediaAssetsTable, profilesTable } from "./vibeswipe";

export const reelsTable = pgTable("vibeswipe_reels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().unique().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  durationSeconds: doublePrecision("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ feed: index("vibeswipe_reels_feed_idx").on(t.createdAt, t.id) }));

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
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byReel: index("vibeswipe_reel_comments_reel_idx").on(t.reelId, t.createdAt) }));

export type Reel = typeof reelsTable.$inferSelect;
export type ReelComment = typeof reelCommentsTable.$inferSelect;
