import { pool } from "@workspace/db";

// Additive, idempotent migration runs before serving in development AND production.
export async function ensureAdminSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(632191504)");
    await client.query("ALTER TABLE vibeswipe_profiles ADD COLUMN IF NOT EXISTS admin_suspended boolean NOT NULL DEFAULT false");
    await client.query("ALTER TABLE vibeswipe_profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_admin_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text NOT NULL,
      action text NOT NULL, target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_admin_media_deletions (
      object_path text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query("CREATE INDEX IF NOT EXISTS vibeswipe_admin_audit_created_idx ON vibeswipe_admin_audit(created_at DESC)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
