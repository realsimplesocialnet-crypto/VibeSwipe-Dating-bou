import { pool } from "@workspace/db";

export async function ensureSecuritySchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vibeswipe_api_rate_limits (
      bucket_key text NOT NULL,
      window_started_at timestamptz NOT NULL,
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      PRIMARY KEY (bucket_key, window_started_at)
    )
  `);
  await cleanupSecurityRateLimits();
}

export async function cleanupSecurityRateLimits(): Promise<number> {
  const result = await pool.query(
    "DELETE FROM vibeswipe_api_rate_limits WHERE window_started_at < now() - interval '2 days'",
  );
  return result.rowCount ?? 0;
}
