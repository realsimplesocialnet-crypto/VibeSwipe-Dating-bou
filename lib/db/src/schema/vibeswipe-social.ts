import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./vibeswipe";

export const vibeSwipeFollowsTable = pgTable(
  "vibeswipe_follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    followedId: text("followed_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    followPairPrimaryKey: primaryKey({
      name: "vibeswipe_follows_pk",
      columns: [table.followerId, table.followedId],
    }),
    noSelfFollow: check(
      "vibeswipe_follows_no_self_check",
      sql`${table.followerId} <> ${table.followedId}`,
    ),
    followerCreatedIndex: index("vibeswipe_follows_follower_created_idx").on(
      table.followerId,
      table.createdAt,
    ),
    followedCreatedIndex: index("vibeswipe_follows_followed_created_idx").on(
      table.followedId,
      table.createdAt,
    ),
  }),
);

export const vibeSwipeFollowRequestsTable = pgTable(
  "vibeswipe_follow_requests",
  {
    requesterId: text("requester_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    requestPairPrimaryKey: primaryKey({
      name: "vibeswipe_follow_requests_pk",
      columns: [table.requesterId, table.targetId],
    }),
    noSelfRequest: check(
      "vibeswipe_follow_requests_no_self_check",
      sql`${table.requesterId} <> ${table.targetId}`,
    ),
    byTarget: index("vibeswipe_follow_requests_target_created_idx").on(
      table.targetId,
      table.createdAt,
    ),
  }),
);
