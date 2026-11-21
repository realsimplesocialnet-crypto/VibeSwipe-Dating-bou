import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type ProfilePreferences = {
  ageMin: number;
  ageMax: number;
  gender: string;
  distanceKm: number;
  discoveryLocation?: {
    scope: "city" | "state" | "country" | "radius";
    country: string | null;
    state: string | null;
    city: string | null;
    radiusKm: number | null;
  };
};

export type ProfilePrivacyAudience = "everyone" | "followers" | "no_one";
export type LikedVideoAudience = "everyone" | "followers" | "only_me";

export const profilesTable = pgTable("vibeswipe_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  lookingFor: text("looking_for").notNull(),
  bio: text("bio").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country"),
  state: text("state"),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  occupation: text("occupation").notNull().default(""),
  occupationOther: text("occupation_other").notNull().default(""),
  photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
  videoUrl: text("video_url"),
  isDemo: boolean("is_demo").notNull().default(false),
  incognito: boolean("incognito").notNull().default(false),
  privateAccount: boolean("private_account").notNull().default(false),
  whoCanComment: text("who_can_comment").$type<ProfilePrivacyAudience>().notNull().default("everyone"),
  whoCanMessage: text("who_can_message").$type<ProfilePrivacyAudience>().notNull().default("everyone"),
  allowDownloads: boolean("allow_downloads").notNull().default(true),
  likedVideoAudience: text("liked_video_audience").$type<LikedVideoAudience>().notNull().default("everyone"),
  keywordFilters: text("keyword_filters").array().notNull().default(sql`'{}'::text[]`),
  screenTimeReminderMinutes: integer("screen_time_reminder_minutes"),
  screenTimeLimitMinutes: integer("screen_time_limit_minutes"),
  showAge: boolean("show_age").notNull().default(true),
  showDistance: boolean("show_distance").notNull().default(true),
  notifyMatches: boolean("notify_matches").notNull().default(true),
  notifyLikes: boolean("notify_likes"),
  notifyMessages: boolean("notify_messages").notNull().default(true),
  notifyProfileViews: boolean("notify_profile_views").notNull().default(true),
  darkMode: boolean("dark_mode").notNull().default(true),
  language: text("language").notNull().default("en"),
  deactivated: boolean("deactivated").notNull().default(false),
  adminSuspended: boolean("admin_suspended").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  referralCode: text("referral_code"),
  points: integer("points").notNull().default(0),
  travelMode: boolean("travel_mode").notNull().default(false),
  travelCity: text("travel_city"),
  boostStartTime: timestamp("boost_start_time", { withTimezone: true }),
  boostEndTime: timestamp("boost_end_time", { withTimezone: true }),
  nextBoostAvailableTime: timestamp("next_boost_available_time", {
    withTimezone: true,
  }),
  preferences: jsonb("preferences")
    .$type<ProfilePreferences>()
    .notNull()
    .default(sql`'{"ageMax": 35, "ageMin": 22, "gender": "Everyone", "distanceKm": 50}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  nameSearch: index("vibeswipe_profiles_name_search_idx").using("gin", sql`to_tsvector('english', coalesce(${table.name}, ''))`),
  citySearch: index("vibeswipe_profiles_city_search_idx").using("gin", sql`to_tsvector('english', coalesce(${table.city}, ''))`),
  stateSearch: index("vibeswipe_profiles_state_search_idx").using("gin", sql`to_tsvector('english', coalesce(${table.state}, ''))`),
  countrySearch: index("vibeswipe_profiles_country_search_idx").using("gin", sql`to_tsvector('english', coalesce(${table.country}, ''))`),
  referralCodeUnique: uniqueIndex("vibeswipe_profiles_referral_code_idx").on(table.referralCode),
}));

/** This table is also initialized by the API server. Keeping it in Drizzle prevents push from treating it as a rename candidate. */
export const apiRateLimitsTable = pgTable("vibeswipe_api_rate_limits", {
  bucketKey: text("bucket_key").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ name: "vibeswipe_api_rate_limits_pkey", columns: [table.bucketKey, table.windowStartedAt] }),
  attemptsNonNegative: check("vibeswipe_api_rate_limits_attempts_check", sql`${table.attempts} >= 0`),
}));

export const profileSetupDraftsTable = pgTable("vibeswipe_profile_setup_drafts", {
  userId: text("user_id").primaryKey(),
  step: integer("step").notNull().default(1),
  data: jsonb("data")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reactionsTable = pgTable(
  "vibeswipe_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueReaction: uniqueIndex("vibeswipe_reaction_pair_idx").on(
      table.fromUserId,
      table.toUserId,
    ),
  }),
);

export const icebreakersTable = pgTable(
  "vibeswipe_icebreakers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    question: text("question").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueQuestion: uniqueIndex("vibeswipe_icebreaker_question_idx").on(
      table.question,
    ),
  }),
);

export const dailyLikeUsageTable = pgTable("vibeswipe_daily_like_usage", {
  userId: text("user_id")
    .primaryKey()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  likeCount: integer("like_count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }),
});

export const matchesTable = pgTable(
  "vibeswipe_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueMatch: uniqueIndex("vibeswipe_match_pair_idx").on(
      table.userAId,
      table.userBId,
    ),
  }),
);

export const matchUserStateTable = pgTable(
  "vibeswipe_match_user_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    typingUntil: timestamp("typing_until", { withTimezone: true }),
    chatTheme: text("chat_theme").notNull().default("pink"),
  },
  (table) => ({
    matchUserStatePrimaryKey: primaryKey({
      name: "vibeswipe_match_user_state_pk",
      columns: [table.userId, table.matchId],
    }),
  }),
);

export const messagesTable = pgTable("vibeswipe_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaReference: text("media_reference"),
  mediaType: text("media_type"),
  mediaDuration: integer("media_duration"),
  // Server-verified story reply context; no FK so expired story cleanup is unaffected.
  storyReplyId: uuid("story_reply_id"),
  deletedForEveryone: boolean("deleted_for_everyone").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messageHiddenByUserTable = pgTable(
  "vibeswipe_message_hidden_by_user",
  {
    messageId: uuid("message_id").notNull(),
    userId: text("user_id").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    messageUserPrimaryKey: primaryKey({
      name: "vibeswipe_message_hidden_by_user_pk",
      columns: [table.messageId, table.userId],
    }),
    messageFk: foreignKey({
      name: "vibeswipe_message_hidden_by_user_message_id_vibeswipe_messages_",
      columns: [table.messageId],
      foreignColumns: [messagesTable.id],
    }).onDelete("cascade"),
    userFk: foreignKey({
      name: "vibeswipe_message_hidden_by_user_user_id_vibeswipe_profiles_id_",
      columns: [table.userId],
      foreignColumns: [profilesTable.id],
    }).onDelete("cascade"),
  }),
);

export const blocksTable = pgTable(
  "vibeswipe_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueBlock: uniqueIndex("vibeswipe_block_pair_idx").on(
      table.blockerId,
      table.blockedId,
    ),
  }),
);

export const reportsTable = pgTable("vibeswipe_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  reportedId: text("reported_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("new"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mediaAssetsTable = pgTable("vibeswipe_media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  matchId: uuid("match_id").references(() => matchesTable.id, {
    onDelete: "cascade",
  }),
  objectPath: text("object_path").notNull().unique(),
  mediaType: text("media_type").notNull(),
  contentType: text("content_type").notNull(),
  durationSeconds: doublePrecision("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
