import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profilesTable } from "./vibeswipe";

export const referralsTable = pgTable(
  "vibeswipe_referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    pointsAwarded: integer("points_awarded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    referredUserUnique: uniqueIndex("vibeswipe_referrals_referred_user_idx").on(
      table.referredUserId,
    ),
    referrerCreated: index("vibeswipe_referrals_referrer_created_idx").on(
      table.referrerId,
      table.createdAt,
    ),
    noSelfReferral: check(
      "vibeswipe_referrals_no_self_referral_check",
      sql`${table.referrerId} <> ${table.referredUserId}`,
    ),
  }),
);
