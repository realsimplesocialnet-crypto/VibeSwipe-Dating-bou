import { adminDeletedUsersTable, blocksTable, db, profilesTable, reelsTable } from "@workspace/db";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { REEL_SAFETY_VERSION } from "./reel-safety-policy";

/** Reels visible to a viewer: own Reels, or active public members with no block either way. */
export function visibleReelCondition(viewerId: string): SQL {
  return and(sql`EXISTS (SELECT 1 FROM vibeswipe_reel_safety s
    JOIN vibeswipe_media_assets m ON m.id=s.media_id
    WHERE s.media_id=${reelsTable.mediaId} AND s.status='approved'
      AND s.version=${REEL_SAFETY_VERSION} AND s.checked_path=m.object_path)`, or(
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
    .where(and(eq(reelsTable.mediaId, mediaId), visibleReelCondition(viewerId)))
    .limit(1);
  return Boolean(row);
}
