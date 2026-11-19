import {
  blocksTable,
  db,
  profilesTable,
  vibeSwipeFollowsTable,
} from "@workspace/db";
import { and, eq, or } from "drizzle-orm";

export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const [block] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(or(
      and(eq(blocksTable.blockerId, userA), eq(blocksTable.blockedId, userB)),
      and(eq(blocksTable.blockerId, userB), eq(blocksTable.blockedId, userA)),
    ))
    .limit(1);
  return Boolean(block);
}

export async function hasApprovedFollow(viewerId: string, ownerId: string): Promise<boolean> {
  const [follow] = await db
    .select({ followerId: vibeSwipeFollowsTable.followerId })
    .from(vibeSwipeFollowsTable)
    .where(and(
      eq(vibeSwipeFollowsTable.followerId, viewerId),
      eq(vibeSwipeFollowsTable.followedId, ownerId),
    ))
    .limit(1);
  return Boolean(follow);
}

export async function hasMutualFollow(userA: string, userB: string): Promise<boolean> {
  const [mutual] = await db
    .select({ followerId: vibeSwipeFollowsTable.followerId })
    .from(vibeSwipeFollowsTable)
    .where(or(
      and(eq(vibeSwipeFollowsTable.followerId, userA), eq(vibeSwipeFollowsTable.followedId, userB)),
      and(eq(vibeSwipeFollowsTable.followerId, userB), eq(vibeSwipeFollowsTable.followedId, userA)),
    ))
    .limit(1);
  if (!mutual) return false;
  const [reverse] = await db
    .select({ followerId: vibeSwipeFollowsTable.followerId })
    .from(vibeSwipeFollowsTable)
    .where(and(
      eq(vibeSwipeFollowsTable.followerId, userA === mutual.followerId ? userB : userA),
      eq(vibeSwipeFollowsTable.followedId, userA === mutual.followerId ? userA : userB),
    ))
    .limit(1);
  return Boolean(reverse);
}

export async function canViewUserProfile(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  if (await isBlockedBetween(viewerId, ownerId)) return false;
  const [owner] = await db
    .select({
      privateAccount: profilesTable.privateAccount,
      incognito: profilesTable.incognito,
      deactivated: profilesTable.deactivated,
      adminSuspended: profilesTable.adminSuspended,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, ownerId))
    .limit(1);
  if (!owner || owner.deactivated || owner.adminSuspended) return false;
  if (!owner.privateAccount && !owner.incognito) return true;
  return hasApprovedFollow(viewerId, ownerId);
}

export async function canViewLikedVideos(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  if (!(await canViewUserProfile(viewerId, ownerId))) return false;
  const [owner] = await db
    .select({ audience: profilesTable.likedVideoAudience })
    .from(profilesTable)
    .where(eq(profilesTable.id, ownerId))
    .limit(1);
  if (!owner || owner.audience === "only_me") return false;
  return owner.audience === "everyone" || hasApprovedFollow(viewerId, ownerId);
}

export async function canStartChat(viewerId: string, recipientId: string): Promise<boolean> {
  if (viewerId === recipientId) return false;
  if (await isBlockedBetween(viewerId, recipientId)) return false;
  const [recipient] = await db
    .select({ audience: profilesTable.whoCanMessage })
    .from(profilesTable)
    .where(eq(profilesTable.id, recipientId))
    .limit(1);
  if (!recipient || recipient.audience === "no_one") return false;
  return recipient.audience === "everyone" || hasApprovedFollow(viewerId, recipientId);
}

export async function canCommentOnReel(viewerId: string, ownerId: string): Promise<boolean> {
  if (await isBlockedBetween(viewerId, ownerId)) return false;
  const [owner] = await db
    .select({ audience: profilesTable.whoCanComment })
    .from(profilesTable)
    .where(eq(profilesTable.id, ownerId))
    .limit(1);
  if (!owner || owner.audience === "no_one") return false;
  return owner.audience === "everyone" || hasApprovedFollow(viewerId, ownerId);
}
