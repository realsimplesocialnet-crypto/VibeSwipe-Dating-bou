import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profilesTable } from "./vibeswipe";

export const storiesTable = pgTable(
  "vibeswipe_stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    caption: text("caption").notNull().default(""),
    backgroundColor: text("background_color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    activeByOwner: index("vibeswipe_stories_owner_expiry_idx").on(
      table.userId,
      table.expiresAt,
      table.createdAt,
    ),
    expiry: index("vibeswipe_stories_expiry_idx").on(table.expiresAt),
    uniqueMedia: uniqueIndex("vibeswipe_stories_media_url_idx").on(table.mediaUrl),
  }),
);

export const storyViewsTable = pgTable(
  "vibeswipe_story_views",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    storyViewerPrimaryKey: primaryKey({
      name: "vibeswipe_story_views_pk",
      columns: [table.storyId, table.viewerId],
    }),
    viewerRecent: index("vibeswipe_story_views_viewer_idx").on(
      table.viewerId,
      table.viewedAt,
    ),
  }),
);

export const storyLikesTable = pgTable(
  "vibeswipe_story_likes",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    storyLikerPrimaryKey: primaryKey({
      name: "vibeswipe_story_likes_pk",
      columns: [table.storyId, table.userId],
    }),
    likerRecent: index("vibeswipe_story_likes_user_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const insertStorySchema = createInsertSchema(storiesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  expiresAt: true,
});
export type InsertStory = typeof storiesTable.$inferInsert;
export type Story = typeof storiesTable.$inferSelect;
export type StoryView = typeof storyViewsTable.$inferSelect;
export type StoryLike = typeof storyLikesTable.$inferSelect;
