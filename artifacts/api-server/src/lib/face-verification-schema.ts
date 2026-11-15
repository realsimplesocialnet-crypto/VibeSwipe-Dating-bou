import { pool } from "@workspace/db";

/** Additive and idempotent: also runs on publish, without altering existing profiles. */
export async function ensureFaceVerificationSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('vibeswipe-face-verification-schema'))");
    await client.query(`CREATE TABLE IF NOT EXISTS vibeswipe_face_verification_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES vibeswipe_profiles(id) ON DELETE CASCADE,
    main_photo text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`);
    await client.query(`CREATE INDEX IF NOT EXISTS vibeswipe_face_verification_user_created
    ON vibeswipe_face_verification_sessions(user_id, created_at)`);
    await client.query(`ALTER TABLE vibeswipe_face_verification_sessions
      ADD COLUMN IF NOT EXISTS reference_photo text,
      ADD COLUMN IF NOT EXISTS sealed_photo text,
      ADD COLUMN IF NOT EXISTS checked_at timestamptz,
      ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
      ADD COLUMN IF NOT EXISTS reviewed_by text,
      ADD COLUMN IF NOT EXISTS rejection_reason text`);
    await client.query(`CREATE INDEX IF NOT EXISTS vibeswipe_face_verification_review_queue
      ON vibeswipe_face_verification_sessions(status, created_at)`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupFaceVerificationSessions(): Promise<void> {
  await pool.query(`UPDATE vibeswipe_face_verification_sessions SET status = 'cancelled',
    rejection_reason = 'This request expired. Please submit verification again.'
    WHERE status = 'awaiting_review' AND created_at < now() - interval '30 days'`);
  await pool.query(`DELETE FROM vibeswipe_face_verification_sessions
    WHERE (status IN ('pending','processing','failed','passed') AND created_at < now() - interval '24 hours')
       OR (status IN ('approved','rejected','cancelled') AND created_at < now() - interval '90 days')`);
}
