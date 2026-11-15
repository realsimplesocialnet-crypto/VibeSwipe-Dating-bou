import { pool } from "@workspace/db";

/** Additive rollout: chat reads must not precede the optional story-reply column. */
export async function ensureChatSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(632191518)");
    await client.query("ALTER TABLE vibeswipe_messages ADD COLUMN IF NOT EXISTS story_reply_id uuid");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
