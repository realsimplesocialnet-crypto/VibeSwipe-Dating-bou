import { adminDeletedUsersTable, blocksTable, db, profilesTable, reelSlidesTable, reelsTable } from "@workspace/db";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { REEL_SAFETY_VERSION } from "./reel-safety-policy";

/** Reels visible to a viewer: own Reels, or active public members with no block either way. */
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
      eq(profilesTable.incognito, false),
      sql`NOT EXISTS (SELECT 1 FROM ${blocksTable} WHERE (${blocksTable.blockerId} = ${viewerId} AND ${blocksTable.blockedId} = ${reelsTable.userId}) OR (${blocksTable.blockerId} = ${reelsTable.userId} AND ${blocksTable.blockedId} = ${viewerId}))`,
      sql`NOT EXISTS (SELECT 1 FROM ${adminDeletedUsersTable} WHERE ${adminDeletedUsersTable.userId} = ${reelsTable.userId})`,
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
