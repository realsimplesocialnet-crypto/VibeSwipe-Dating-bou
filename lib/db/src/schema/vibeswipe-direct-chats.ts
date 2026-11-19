import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./vibeswipe";

export const directConversationsTable = pgTable(
  "vibeswipe_direct_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    startedById: text("started_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniquePair: uniqueIndex("vibeswipe_direct_conversations_pair_idx").on(table.userAId, table.userBId),
    validPair: check("vibeswipe_direct_conversations_pair_check", sql`${table.userAId} < ${table.userBId}`),
    byUserA: index("vibeswipe_direct_conversations_user_a_idx").on(table.userAId, table.updatedAt),
    byUserB: index("vibeswipe_direct_conversations_user_b_idx").on(table.userBId, table.updatedAt),
    userAFk: foreignKey({ name: "vibeswipe_direct_conversations_user_a_id_vibeswipe_profiles_id_", columns: [table.userAId], foreignColumns: [profilesTable.id] }).onDelete("cascade"),
    userBFk: foreignKey({ name: "vibeswipe_direct_conversations_user_b_id_vibeswipe_profiles_id_", columns: [table.userBId], foreignColumns: [profilesTable.id] }).onDelete("cascade"),
    startedByFk: foreignKey({ name: "vibeswipe_direct_conversations_started_by_id_vibeswipe_profiles", columns: [table.startedById], foreignColumns: [profilesTable.id] }).onDelete("cascade"),
  }),
);

export const directMessagesTable = pgTable(
  "vibeswipe_direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    senderId: text("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    byConversation: index("vibeswipe_direct_messages_conversation_idx").on(table.conversationId, table.createdAt),
    conversationFk: foreignKey({ name: "vibeswipe_direct_messages_conversation_id_vibeswipe_direct_conv", columns: [table.conversationId], foreignColumns: [directConversationsTable.id] }).onDelete("cascade"),
  }),
);

export type DirectConversation = typeof directConversationsTable.$inferSelect;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
