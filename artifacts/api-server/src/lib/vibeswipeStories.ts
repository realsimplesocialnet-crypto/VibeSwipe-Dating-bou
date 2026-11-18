import {
  and,
  asc,
  eq,
  lte,
  or,
} from "drizzle-orm";
import {
  db,
  blocksTable,
  storiesTable,
  vibeSwipeFollowsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { removeUnreferencedProfileMedia } from "./profileMediaCleanup";

const STORY_CLEANUP_BATCH_SIZE = 100;

export async function hasUnblockedMutualFollowBetween(
  firstUserId: string,
  secondUserId: string,
): Promise<boolean> {
  if (firstUserId === secondUserId) return false;
  const [mutualFollow, block] = await Promise.all([
    db
      .select({ followerId: vibeSwipeFollowsTable.followerId })
      .from(vibeSwipeFollowsTable)
      .where(or(
        and(
          eq(vibeSwipeFollowsTable.followerId, firstUserId),
          eq(vibeSwipeFollowsTable.followedId, secondUserId),
        ),
        and(
          eq(vibeSwipeFollowsTable.followerId, secondUserId),
          eq(vibeSwipeFollowsTable.followedId, firstUserId),
        ),
      ))
      .limit(2),
    db
      .select({ id: blocksTable.id })
      .from(blocksTable)
      .where(or(
        and(
          eq(blocksTable.blockerId, firstUserId),
          eq(blocksTable.blockedId, secondUserId),
        ),
        and(
          eq(blocksTable.blockerId, secondUserId),
          eq(blocksTable.blockedId, firstUserId),
        ),
      ))
      .limit(1),
  ]);
  return mutualFollow.length > 0 && block.length === 0;
}

export async function cleanupExpiredStories(): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select({
      id: storiesTable.id,
      mediaUrl: storiesTable.mediaUrl,
      userId: storiesTable.userId,
    })
    .from(storiesTable)
    .where(lte(storiesTable.expiresAt, now))
    .orderBy(asc(storiesTable.expiresAt))
    .limit(STORY_CLEANUP_BATCH_SIZE);

  let removed = 0;
  for (const story of candidates) {
    const [deleted] = await db
      .delete(storiesTable)
      .where(and(eq(storiesTable.id, story.id), lte(storiesTable.expiresAt, now)))
      .returning({ mediaUrl: storiesTable.mediaUrl, userId: storiesTable.userId });
    if (!deleted) continue;
    removed += 1;

    const mediaId = /^media:([0-9a-f-]{36})$/i.exec(deleted.mediaUrl ?? "")?.[1];
    if (!mediaId) continue;
    try {
      await removeUnreferencedProfileMedia(mediaId, deleted.userId);
    } catch (error) {
      logger.error(
        { err: error, mediaId },
        "Could not remove expired story media",
      );
    }
  }
  return removed;
}
