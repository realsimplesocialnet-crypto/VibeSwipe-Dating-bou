import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { matchesTable, messagesTable, profilesTable } from "./vibeswipe";

export const vibeSwipePresenceTable = pgTable("vibeswipe_presence", {
  userId: text("user_id").primaryKey(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vibeSwipeReadReceiptsTable = pgTable(
  "vibeswipe_read_receipts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    readReceiptPrimaryKey: primaryKey({
      name: "vibeswipe_read_receipts_pk",
      columns: [table.userId, table.matchId],
    }),
  }),
);

export const vibeSwipeNotificationsTable = pgTable(
  "vibeswipe_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    matchId: uuid("match_id").references(() => matchesTable.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messagesTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    recipientCreatedIndex: index("vibeswipe_notifications_recipient_created_idx")
      .on(table.recipientId, table.createdAt),
  }),
);
