import app from "./app";
import { logger } from "./lib/logger";
import { cleanupAbandonedProfileMedia } from "./lib/profileMediaCleanup";
import { cleanupExpiredStories } from "./lib/vibeswipeStories";
import { ensureAdminSchema } from "./lib/admin-schema";
import { cleanupFaceVerificationSessions, ensureFaceVerificationSchema } from "./lib/face-verification-schema";
import { cleanupAdminMediaDeletions } from "./lib/adminMediaCleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

let cleanupRunning = false;
const runProfileMediaCleanup = async (): Promise<void> => {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    const [abandonedMediaDeleted, expiredStoriesDeleted, adminMediaDeleted] = await Promise.all([
      cleanupAbandonedProfileMedia(),
      cleanupExpiredStories(),
      cleanupAdminMediaDeletions(),
      cleanupFaceVerificationSessions(),
    ]);
    if (abandonedMediaDeleted > 0) {
      logger.info(
        { deleted: abandonedMediaDeleted },
        "Removed abandoned profile media uploads",
      );
    }
    if (expiredStoriesDeleted > 0) {
      logger.info(
        { deleted: expiredStoriesDeleted },
        "Removed expired stories",
      );
    }
    if (adminMediaDeleted > 0) {
      logger.info({ deleted: adminMediaDeleted }, "Removed media queued by account moderation");
    }
  } catch (err) {
    logger.error({ err }, "Failed to clean up abandoned profile media uploads");
  } finally {
    cleanupRunning = false;
  }
};

void ensureAdminSchema().then(ensureFaceVerificationSchema).then(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void runProfileMediaCleanup();
  const cleanupTimer = setInterval(
    () => void runProfileMediaCleanup(),
    60 * 60 * 1000,
  );
  cleanupTimer.unref();
})).catch((err: unknown) => {
  logger.error({ err }, "Unable to prepare account moderation storage");
  process.exit(1);
});
