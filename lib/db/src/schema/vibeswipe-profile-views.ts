import {
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./vibeswipe";

export const vibeswipeProfileViewsTable = pgTable(
  "vibeswipe_profile_views",
  {
    viewerId: text("viewer_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    profileViewPairPrimaryKey: primaryKey({
      name: "vibeswipe_profile_views_pk",
      columns: [table.viewerId, table.profileId],
    }),
  }),
);
