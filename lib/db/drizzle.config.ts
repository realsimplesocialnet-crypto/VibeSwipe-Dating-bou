import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  tablesFilter: [
    "vibeswipe_profiles",
    "vibeswipe_reels",
    "vibeswipe_follow_requests",
    "vibeswipe_reel_not_interested",
    "vibeswipe_direct_conversations",
    "vibeswipe_direct_messages",
  ],
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
