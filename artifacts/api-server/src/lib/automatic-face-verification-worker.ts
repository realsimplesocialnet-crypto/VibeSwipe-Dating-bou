import { db, faceVerificationSessionsTable as sessions } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { activateCheckedFace } from "./automatic-face-verification";
import { FaceVerificationError } from "./luxand";
import { logger } from "./logger";

let running = false;

/** Resume checked evidence even when the member closes the app. Never bypass a failed check. */
export async function finishPendingFaceVerifications(): Promise<void> {
  if (running || !process.env.LUXAND_API_TOKEN) return;
  running = true;
  try {
    // Rotate temporary failures to the back, so one unavailable photo cannot starve the queue.
    const requests = await db.select({ id: sessions.id, userId: sessions.userId }).from(sessions)
      .where(eq(sessions.status, "awaiting_review"))
      .orderBy(sql`${sessions.reviewedAt} ASC NULLS FIRST`, asc(sessions.createdAt)).limit(3);
    for (const request of requests) {
      try {
        await activateCheckedFace(request.userId, request.id);
      } catch (error) {
        const terminal = error instanceof FaceVerificationError && error.status >= 400 && error.status < 500 && error.status !== 429;
        await db.update(sessions).set({
          status: terminal ? (error.status === 409 ? "cancelled" : "rejected") : "awaiting_review",
          reviewedAt: new Date(),
          reviewedBy: null,
          rejectionReason: error instanceof FaceVerificationError ? error.message : "Photo checking is temporarily unavailable. It will retry automatically.",
        }).where(and(eq(sessions.id, request.id), eq(sessions.status, "awaiting_review")));
        if (!terminal) logger.warn("Automatic face activation was deferred for retry");
      }
    }
  } catch {
    logger.warn("Pending face checks could not run; they will retry automatically");
  } finally {
    running = false;
  }
}
