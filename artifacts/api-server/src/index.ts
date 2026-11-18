import app from "./app";
import { createServer } from "node:http";
import { logger } from "./lib/logger";
import { cleanupAbandonedProfileMedia } from "./lib/profileMediaCleanup";
import { cleanupExpiredStories } from "./lib/vibeswipeStories";
import { ensureAdminSchema } from "./lib/admin-schema";
import { ensureReelsSchema } from "./lib/reels-schema";
import { ensureChatSchema } from "./lib/chat-schema";
import { cleanupFaceVerificationSessions, ensureFaceVerificationSchema } from "./lib/face-verification-schema";
import { cleanupAdminMediaDeletions } from "./lib/adminMediaCleanup";
import { checkExistingReels } from "./lib/reel-safety";
import { finishPendingFaceVerifications } from "./lib/automatic-face-verification-worker";
import { cleanupSecurityRateLimits, ensureSecuritySchema } from "./lib/security-schema";

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
const httpServer = createServer(app);
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

void ensureSecuritySchema().then(ensureAdminSchema).then(ensureFaceVerificationSchema).then(ensureReelsSchema).then(ensureChatSchema).then(() => {
  httpServer.once("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
    void finishPendingFaceVerifications();
    const faceVerificationTimer = setInterval(() => void finishPendingFaceVerifications(), 5 * 60_000);
    faceVerificationTimer.unref();
    void checkExistingReels();
    const reelSafetyTimer = setInterval(() => void checkExistingReels(), 60_000);
    reelSafetyTimer.unref();
    void runProfileMediaCleanup();
    const cleanupTimer = setInterval(
      () => void runProfileMediaCleanup(),
      60 * 60 * 1000,
    );
    cleanupTimer.unref();
    const rateLimitCleanupTimer = setInterval(() => {
      void cleanupSecurityRateLimits().catch((err) => {
        logger.warn({ err }, "Could not prune expired API rate-limit records");
      });
    }, 6 * 60 * 60 * 1000);
    rateLimitCleanupTimer.unref();
  });
}).catch((err: unknown) => {
  logger.error({ err }, "Unable to prepare account moderation storage");
  process.exit(1);
});

process.on("SIGTERM", () => httpServer.close());
