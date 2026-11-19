import { adminDeletedUsersTable, blocksTable, db, mediaAssetsTable, profilesTable, reelCommentsTable, reelSlidesTable, reelsTable, vibeSwipeFollowsTable } from "@workspace/db";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { REEL_SAFETY_VERSION } from "./reel-safety-policy";

/** Enforces account privacy, Reel audience, safety approval, account state, and blocks. */
export function visibleReelCondition(viewerId: string): SQL {
  return and(sql`EXISTS (SELECT 1 FROM vibeswipe_reel_safety s
    JOIN vibeswipe_media_assets m ON m.id=s.media_id
    WHERE s.media_id=${reelsTable.mediaId} AND s.status='approved'
      AND s.version=${REEL_SAFETY_VERSION} AND s.checked_path=m.object_path)`,
    sql`NOT EXISTS (
      SELECT 1 FROM ${reelSlidesTable} rs
      LEFT JOIN vibeswipe_reel_safety safety ON safety.media_id=rs.media_id
      LEFT JOIN vibeswipe_media_assets media ON media.id=rs.media_id
      WHERE rs.reel_id=${reelsTable.id}
        AND (safety.status IS DISTINCT FROM 'approved'
          OR safety.version IS DISTINCT FROM ${REEL_SAFETY_VERSION}
          OR safety.checked_path IS DISTINCT FROM media.object_path)
    )`, or(
    eq(reelsTable.userId, viewerId),
    and(
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
      sql`NOT EXISTS (SELECT 1 FROM ${blocksTable} WHERE (${blocksTable.blockerId} = ${viewerId} AND ${blocksTable.blockedId} = ${reelsTable.userId}) OR (${blocksTable.blockerId} = ${reelsTable.userId} AND ${blocksTable.blockedId} = ${viewerId}))`,
      sql`NOT EXISTS (SELECT 1 FROM ${adminDeletedUsersTable} WHERE ${adminDeletedUsersTable.userId} = ${reelsTable.userId})`,
      sql`(
        (${reelsTable.audience} = 'public'
          AND ${profilesTable.privateAccount} = false
          AND ${profilesTable.incognito} = false)
        OR
        (${reelsTable.audience} = 'public' AND EXISTS (
          SELECT 1 FROM ${vibeSwipeFollowsTable}
          WHERE ${vibeSwipeFollowsTable.followerId} = ${viewerId}
            AND ${vibeSwipeFollowsTable.followedId} = ${reelsTable.userId}
        ))
        OR
        (${reelsTable.audience} = 'friends'
          AND EXISTS (
            SELECT 1 FROM ${vibeSwipeFollowsTable} f1
            WHERE f1.follower_id = ${viewerId} AND f1.followed_id = ${reelsTable.userId}
          )
          AND EXISTS (
            SELECT 1 FROM ${vibeSwipeFollowsTable} f2
            WHERE f2.follower_id = ${reelsTable.userId} AND f2.followed_id = ${viewerId}
          ))
      )`,
    ),
  ))!;
}

export async function canViewReelMedia(viewerId: string, mediaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reelsTable.id })
    .from(reelsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(or(
      eq(reelsTable.mediaId, mediaId),
      sql`EXISTS (SELECT 1 FROM ${reelSlidesTable} WHERE ${reelSlidesTable.reelId}=${reelsTable.id} AND ${reelSlidesTable.mediaId}=${mediaId})`,
    ), visibleReelCondition(viewerId)))
    .limit(1);
  return Boolean(row);
}

/** Comment photos follow the audience of their Reel and the comment author's block/deletion state. */
export async function canViewReelCommentMedia(viewerId: string, mediaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reelCommentsTable.id })
    .from(reelCommentsTable)
    .innerJoin(mediaAssetsTable, eq(mediaAssetsTable.id, reelCommentsTable.mediaId))
    .innerJoin(reelsTable, eq(reelsTable.id, reelCommentsTable.reelId))
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(
      eq(reelCommentsTable.mediaId, mediaId),
      eq(mediaAssetsTable.ownerId, reelCommentsTable.userId),
      eq(mediaAssetsTable.mediaType, "image"),
      isNull(mediaAssetsTable.matchId),
      visibleReelCondition(viewerId),
      sql`EXISTS (SELECT 1 FROM vibeswipe_profiles author
        WHERE author.id=${reelCommentsTable.userId}
          AND author.deactivated=false AND author.admin_suspended=false)`,
      sql`NOT EXISTS (SELECT 1 FROM ${blocksTable}
        WHERE (${blocksTable.blockerId}=${viewerId} AND ${blocksTable.blockedId}=${reelCommentsTable.userId})
          OR (${blocksTable.blockerId}=${reelCommentsTable.userId} AND ${blocksTable.blockedId}=${viewerId}))`,
    ))
    .limit(1);
  return Boolean(row);
}
