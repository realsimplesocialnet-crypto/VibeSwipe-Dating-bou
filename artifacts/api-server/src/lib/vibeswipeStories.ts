import {
  and,
  asc,
  eq,
  lte,
  or,
} from "drizzle-orm";
import { db, blocksTable, matchesTable, storiesTable } from "@workspace/db";
import { logger } from "./logger";
import { removeUnreferencedProfileMedia } from "./profileMediaCleanup";

const STORY_CLEANUP_BATCH_SIZE = 100;

export async function getUnblockedMatchBetween(
  firstUserId: string,
  secondUserId: string,
) {
  const [match] = await db
    .select({
      id: matchesTable.id,
      userAId: matchesTable.userAId,
      userBId: matchesTable.userBId,
    })
    .from(matchesTable)
    .where(
      or(
        and(
          eq(matchesTable.userAId, firstUserId),
          eq(matchesTable.userBId, secondUserId),
        ),
        and(
          eq(matchesTable.userAId, secondUserId),
          eq(matchesTable.userBId, firstUserId),
        ),
      ),
    )
    .limit(1);
  if (!match) return null;

  const [block] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(
      or(
        and(
          eq(blocksTable.blockerId, firstUserId),
          eq(blocksTable.blockedId, secondUserId),
        ),
        and(
          eq(blocksTable.blockerId, secondUserId),
          eq(blocksTable.blockedId, firstUserId),
        ),
      ),
    )
    .limit(1);
  return block ? null : match;
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
