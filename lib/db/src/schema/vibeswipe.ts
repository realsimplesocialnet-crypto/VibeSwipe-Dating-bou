import {
  boolean,
  doublePrecision,
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
};

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
  interests: text("interests").array().notNull().default([]),
  occupation: text("occupation").notNull().default(""),
  occupationOther: text("occupation_other").notNull().default(""),
  photos: text("photos").array().notNull().default([]),
  videoUrl: text("video_url"),
  isDemo: boolean("is_demo").notNull().default(false),
  incognito: boolean("incognito").notNull().default(false),
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
    .default({ ageMin: 22, ageMax: 35, gender: "Everyone", distanceKm: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  deletedForEveryone: boolean("deleted_for_everyone").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messageHiddenByUserTable = pgTable(
  "vibeswipe_message_hidden_by_user",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    messageUserPrimaryKey: primaryKey({
      name: "vibeswipe_message_hidden_by_user_pk",
      columns: [table.messageId, table.userId],
    }),
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
