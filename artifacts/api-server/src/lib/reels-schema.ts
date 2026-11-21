import { pool } from "@workspace/db";

async function ensureReelSearchIndexes(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("DROP INDEX CONCURRENTLY IF EXISTS vibeswipe_profiles_location_search_idx");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS vibeswipe_reels_caption_search_idx ON vibeswipe_reels USING GIN (to_tsvector('english', coalesce(caption, '')))");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS vibeswipe_profiles_name_search_idx ON vibeswipe_profiles USING GIN (to_tsvector('english', coalesce(name, '')))");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS vibeswipe_profiles_city_search_idx ON vibeswipe_profiles USING GIN (to_tsvector('english', coalesce(city, '')))");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS vibeswipe_profiles_state_search_idx ON vibeswipe_profiles USING GIN (to_tsvector('english', coalesce(state, '')))");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS vibeswipe_profiles_country_search_idx ON vibeswipe_profiles USING GIN (to_tsvector('english', coalesce(country, '')))");
  } catch (error) {
    console.error("Could not finish creating Reel search indexes.", error);
  } finally {
    client.release();
  }
}

// Additive, idempotent migration for Reels; runs before serving in development and production.
export async function ensureReelsSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(632191517)");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      media_id uuid NOT NULL UNIQUE REFERENCES vibeswipe_media_assets(id) ON DELETE CASCADE,
      caption text NOT NULL DEFAULT '',
      duration_seconds double precision,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query("ALTER TABLE vibeswipe_reels ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE vibeswipe_reels ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE vibeswipe_reels ADD COLUMN IF NOT EXISTS soundtrack jsonb");
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reels_feed_idx ON vibeswipe_reels(created_at, id)");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_safety (
      media_id uuid PRIMARY KEY REFERENCES vibeswipe_media_assets(id) ON DELETE CASCADE,
      status text NOT NULL CHECK(status IN ('checking','approved','rejected','error')),
      version text NOT NULL, checked_path text NOT NULL,
      checked_at timestamptz NOT NULL DEFAULT now(), result jsonb)`);
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_likes (
      reel_id uuid NOT NULL REFERENCES vibeswipe_reels(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vibeswipe_reel_likes_pk PRIMARY KEY (reel_id, user_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_saves (
      reel_id uuid NOT NULL REFERENCES vibeswipe_reels(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vibeswipe_reel_saves_pk PRIMARY KEY (reel_id, user_id))`);
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reel_saves_user_idx ON vibeswipe_reel_saves(user_id, created_at)");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_shares (
      reel_id uuid NOT NULL REFERENCES vibeswipe_reels(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vibeswipe_reel_shares_pk PRIMARY KEY (reel_id, user_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES vibeswipe_reels(id) ON DELETE CASCADE,
      parent_comment_id uuid REFERENCES vibeswipe_reel_comments(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query("ALTER TABLE vibeswipe_reel_comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES vibeswipe_reel_comments(id) ON DELETE CASCADE");
    await client.query("ALTER TABLE vibeswipe_reel_comments ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES vibeswipe_media_assets(id) ON DELETE SET NULL");
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reel_comments_reel_idx ON vibeswipe_reel_comments(reel_id, created_at)");
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reel_comments_parent_idx ON vibeswipe_reel_comments(parent_comment_id, created_at)");
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reel_comments_media_idx ON vibeswipe_reel_comments(media_id)");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_reel_comment_reactions (
      comment_id uuid NOT NULL REFERENCES vibeswipe_reel_comments(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
      reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vibeswipe_reel_comment_reactions_pk PRIMARY KEY (comment_id, user_id))`);
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_reel_comment_reactions_comment_idx ON vibeswipe_reel_comment_reactions(comment_id, reaction)");
    await client.query("ALTER TABLE vibeswipe_notifications ADD COLUMN IF NOT EXISTS reel_id uuid REFERENCES vibeswipe_reels(id) ON DELETE CASCADE");
    await client.query("ALTER TABLE vibeswipe_notifications ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES vibeswipe_reel_comments(id) ON DELETE CASCADE");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS vibeswipe_reel_like_notification_idx ON vibeswipe_notifications(recipient_id, actor_id, reel_id) WHERE type = 'reel_like'");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS vibeswipe_reel_comment_like_notification_idx ON vibeswipe_notifications(recipient_id, actor_id, comment_id) WHERE type = 'reel_comment_like'");
    await client.query("COMMIT");
    void ensureReelSearchIndexes();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
