import { getAuth } from "@clerk/express";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  CreateReelBody, CreateReelCommentBody, CreateReelCommentParams, CreateReelCommentResponse, CreateReelResponse,
  DeleteReelCommentParams, DeleteReelParams, GetMyReelsQueryParams, GetMyReelsResponse, GetReelCommentsParams,
  GetReelCommentsResponse, GetReelParams, GetReelResponse, GetReelsFeedQueryParams, GetReelsFeedResponse,
  GetProfileLikedReelsQueryParams, GetProfileLikedReelsResponse, GetProfileReelsQueryParams, GetProfileReelsResponse,
  GetSavedReelsQueryParams, GetSavedReelsResponse, LikeReelParams, LikeReelResponse,
  GetProfileRepostedReelsQueryParams, GetProfileRepostedReelsResponse,
  MarkReelNotInterestedParams, DownloadReelParams,
  GetReelMusicResponse, RecordReelShareResponse, RecordReelViewResponse, TranscodeReelVideoParams,
  TranscodeReelVideoResponse, SetReelCommentReactionBody, SetReelCommentReactionParams, SetReelCommentReactionResponse,
  ReportReelBody,
  type ReelMusicTrack,
} from "@workspace/api-zod";
import {
  blocksTable, db, mediaAssetsTable, profilesTable, reelCommentsTable, reelCommentReactionsTable, reelLikesTable, reelSavesTable, reelRepostsTable, reelSharesTable, reelSlidesTable, reelViewsTable, reelNotInterestedTable, reelReportsTable, reelsTable, storiesTable, vibeSwipeFollowsTable, vibeSwipeNotificationsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { cleanReelCaption, decodeReelCursor, encodeReelCursor, reelAssetProblem, reelLocation } from "../lib/reel-cursor";
import { decodeReelFeedMixCursor, encodeReelFeedMixCursor, mixReelFeedLanes } from "../lib/reel-feed-mix";
import { reelSearchTerms } from "../lib/reel-search";
import { visibleReelCondition } from "../lib/reels-visibility";
import { removeUnreferencedProfileMedia } from "../lib/profileMediaCleanup";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { ProfileVideoValidationError, transcodeReelVideo } from "../lib/profileVideoTranscoder";
import { addReelEndCard } from "../lib/reel-end-card-export";
import { canDownloadReel } from "../lib/reel-download-permissions";
import { createReelPhotoArchive } from "../lib/reel-photo-archive";
import { processSafeReel, processSafeReelImage, reelIsApproved } from "../lib/reel-safety";
import { ReelSafetyError } from "../lib/reel-safety-policy";
import { sendReelCommentLikePush, sendReelCommentReplyPush, sendReelLikePush } from "../lib/vibeswipePush";
import { canCommentOnReel, canViewLikedVideos, canViewUserProfile } from "../lib/profile-privacy";
import { getReelSoundtrack, REEL_MUSIC_CATALOG } from "../lib/reel-music-catalog";

const router: IRouter = Router();
router.use("/vibeswipe/reels", requireAuth);
router.use("/vibeswipe/profile-reels", requireAuth);

const PAGE_SIZE = 6;
const reelStorage = new ObjectStorageService();

router.get("/vibeswipe/reels/music", (_req, res): void => {
  res.json(GetReelMusicResponse.parse({ tracks: REEL_MUSIC_CATALOG }));
});

router.post("/vibeswipe/reels/uploads/:mediaId/transcode", async (req, res): Promise<void> => {
  const params = TranscodeReelVideoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid video upload." }); return; }
  const userId = uid(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, params.data.mediaId), eq(mediaAssetsTable.ownerId, userId),
  )).limit(1);
  if (!asset || asset.matchId) { res.status(404).json({ error: "Your unpublished video upload was not found." }); return; }
  if (asset.mediaType !== "video") { res.status(400).json({ error: "Choose a video." }); return; }
  const reference = `media:${asset.id}`;
  const [publishedReel] = await db.select({ id: reelsTable.id }).from(reelsTable).where(eq(reelsTable.mediaId, asset.id)).limit(1);
  const [publishedStory] = await db.select({ id: storiesTable.id }).from(storiesTable).where(eq(storiesTable.mediaUrl, reference)).limit(1);
  const [publishedProfile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.videoUrl, reference)).limit(1);
  if (publishedReel || publishedStory || publishedProfile) {
    res.status(409).json({ error: "This video has already been published. Upload a new copy to process it." }); return;
  }
  try {
    const result = await processSafeReel(asset);
    res.json(TranscodeReelVideoResponse.parse({ mediaReference: reference, ...result }));
  } catch (error) {
    if (error instanceof ReelSafetyError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Your video upload was not found." }); return; }
    if (error instanceof ProfileVideoValidationError) { res.status(400).json({ error: error.message }); return; }
    req.log.error({ err: error, mediaId: asset.id }, "Could not process Reel video");
    res.status(500).json({ error: "Your video could not be processed. Please try again." });
  }
});

function uid(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

function reelColumns(viewerId: string) {
  return {
    id: reelsTable.id, userId: reelsTable.userId, mediaId: reelsTable.mediaId, mediaType: reelsTable.mediaType,
    allowDownloads: reelsTable.allowDownloads,
    audience: reelsTable.audience, caption: reelsTable.caption, soundtrack: reelsTable.soundtrack,
    durationSeconds: reelsTable.durationSeconds, createdAt: reelsTable.createdAt,
    slideMediaIds: sql<string[]>`COALESCE((
      SELECT array_agg(${reelSlidesTable.mediaId}::text ORDER BY ${reelSlidesTable.position})
      FROM ${reelSlidesTable} WHERE ${reelSlidesTable.reelId} = ${reelsTable.id}
    ), ARRAY[]::text[])`,
    viewCount: sql<number>`(SELECT count(*)::int FROM ${reelViewsTable} WHERE ${reelViewsTable.reelId} = ${reelsTable.id})`,
    shareCount: sql<number>`${reelsTable.shareCount} + (SELECT count(*)::int FROM ${reelSharesTable} WHERE ${reelSharesTable.reelId} = ${reelsTable.id})`,
    name: profilesTable.name, city: profilesTable.city,
    state: profilesTable.state, country: profilesTable.country, isVerified: profilesTable.isVerified, photos: profilesTable.photos,
    allowsDownloads: profilesTable.allowDownloads,
    canComment: sql<boolean>`CASE
      WHEN ${profilesTable.whoCanComment} = 'no_one' THEN false
      WHEN ${profilesTable.whoCanComment} = 'followers' THEN
        ${reelsTable.userId} = ${viewerId} OR EXISTS (
          SELECT 1 FROM ${vibeSwipeFollowsTable}
          WHERE ${vibeSwipeFollowsTable.followerId} = ${viewerId}
            AND ${vibeSwipeFollowsTable.followedId} = ${reelsTable.userId}
        )
      ELSE true
    END`,
    creatorFollowedByMe: sql<boolean>`EXISTS (
      SELECT 1 FROM ${vibeSwipeFollowsTable}
      WHERE ${vibeSwipeFollowsTable.followerId} = ${viewerId}
        AND ${vibeSwipeFollowsTable.followedId} = ${reelsTable.userId}
    )`,
    likeCount: sql<number>`(SELECT count(*)::int FROM ${reelLikesTable} WHERE ${reelLikesTable.reelId} = ${reelsTable.id})`,
    commentCount: sql<number>`(SELECT count(*)::int FROM ${reelCommentsTable} WHERE ${reelCommentsTable.reelId} = ${reelsTable.id})`,
    saveCount: sql<number>`(SELECT count(*)::int FROM ${reelSavesTable} WHERE ${reelSavesTable.reelId} = ${reelsTable.id})`,
    repostCount: sql<number>`(SELECT count(*)::int FROM ${reelRepostsTable} WHERE ${reelRepostsTable.reelId} = ${reelsTable.id})`,
    likedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${reelLikesTable} WHERE ${reelLikesTable.reelId} = ${reelsTable.id} AND ${reelLikesTable.userId} = ${viewerId})`,
    savedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${reelSavesTable} WHERE ${reelSavesTable.reelId} = ${reelsTable.id} AND ${reelSavesTable.userId} = ${viewerId})`,
    repostedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${reelRepostsTable} WHERE ${reelRepostsTable.reelId} = ${reelsTable.id} AND ${reelRepostsTable.userId} = ${viewerId})`,
  };
}
type ReelRow = Awaited<ReturnType<typeof selectReels>>[number];

function selectReels(viewerId: string, where: SQL | undefined, limit: number) {
  return db.select(reelColumns(viewerId)).from(reelsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(visibleReelCondition(viewerId), where))
    .orderBy(desc(reelsTable.createdAt), desc(reelsTable.id))
    .limit(limit);
}

function project(row: ReelRow, viewerId: string) {
  return {
    id: row.id, creatorId: row.userId, creatorName: row.name,
    creatorLocation: reelLocation([row.city, row.state, row.country]), creatorVerified: row.isVerified,
    creatorPhoto: row.photos[0] ?? null, creatorFollowedByMe: Boolean(row.creatorFollowedByMe),
    canComment: Boolean(row.canComment),
    canDownload: canDownloadReel(row.allowDownloads, row.mediaType as "video" | "slides", Boolean(row.allowsDownloads)),
    videoReference: `media:${row.mediaId}`, mediaType: row.mediaType as "video" | "slides", audience: row.audience,
    slideReferences: row.slideMediaIds.map((id) => `media:${id}`), caption: row.caption,
    soundtrack: row.soundtrack as ReelMusicTrack | null,
    durationSeconds: row.durationSeconds, likeCount: Number(row.likeCount), commentCount: Number(row.commentCount),
    viewCount: Number(row.viewCount), shareCount: Number(row.shareCount), saveCount: Number(row.saveCount),
    repostCount: Number(row.repostCount), likedByMe: Boolean(row.likedByMe), savedByMe: Boolean(row.savedByMe),
    repostedByMe: Boolean(row.repostedByMe), isOwner: row.userId === viewerId, createdAt: row.createdAt,
  };
}

async function findVisibleReel(viewerId: string, reelId: string) {
  const [row] = await selectReels(viewerId, eq(reelsTable.id, reelId), 1);
  return row;
}

async function engagement(viewerId: string, reelId: string) {
  const row = await findVisibleReel(viewerId, reelId);
  return row ? {
    likedByMe: Boolean(row.likedByMe), savedByMe: Boolean(row.savedByMe),
    likeCount: Number(row.likeCount), commentCount: Number(row.commentCount),
    saveCount: Number(row.saveCount), shareCount: Number(row.shareCount),
    repostCount: Number(row.repostCount), repostedByMe: Boolean(row.repostedByMe),
  } : null;
}

function afterCursor(cursorText: string | undefined, column: typeof reelsTable.createdAt | typeof reelSavesTable.createdAt | typeof reelLikesTable.createdAt | typeof reelRepostsTable.createdAt): SQL | undefined | false {
  if (!cursorText) return undefined;
  const cursor = decodeReelCursor(cursorText);
  if (!cursor) return false;
  return sql`(${column}, ${reelsTable.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`;
}

router.get("/vibeswipe/reels", async (req, res): Promise<void> => {
  const query = GetReelsFeedQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const terms = query.data.q ? reelSearchTerms(query.data.q) : [];
  const searchCondition = query.data.q
    ? terms.length
      ? and(...terms.map((term) => or(
        sql`to_tsvector('english', coalesce(${reelsTable.caption}, '')) @@ plainto_tsquery('english', ${term})`,
        sql`to_tsvector('english', coalesce(${profilesTable.name}, '')) @@ plainto_tsquery('english', ${term})`,
        sql`to_tsvector('english', coalesce(${profilesTable.city}, '')) @@ plainto_tsquery('english', ${term})`,
        sql`to_tsvector('english', coalesce(${profilesTable.state}, '')) @@ plainto_tsquery('english', ${term})`,
        sql`to_tsvector('english', coalesce(${profilesTable.country}, '')) @@ plainto_tsquery('english', ${term})`,
      )))
      : sql`false`
    : undefined;
  const viewerId = uid(req);
  const limit = query.data.limit ?? PAGE_SIZE;
  const followingCondition = query.data.feed === "friends"
    ? sql`EXISTS (
        SELECT 1 FROM ${vibeSwipeFollowsTable}
        WHERE ${vibeSwipeFollowsTable.followerId} = ${viewerId}
          AND ${vibeSwipeFollowsTable.followedId} = ${reelsTable.userId}
      )`
    : undefined;
  const notInterestedCondition = sql`(
    ${reelsTable.userId} = ${viewerId}
    OR NOT EXISTS (
      SELECT 1 FROM ${reelNotInterestedTable} ni
      WHERE ni.user_id = ${viewerId}
        AND (
          ni.reel_id = ${reelsTable.id}
          OR ni.creator_id = ${reelsTable.userId}
          OR ni.caption_terms && regexp_split_to_array(lower(coalesce(${reelsTable.caption}, '')), '[^[:alnum:]]+')
        )
    )
  )`;
  const baseWhere = and(searchCondition, followingCondition, notInterestedCondition);

  if (query.data.q) {
    const cursorCondition = afterCursor(query.data.cursor, reelsTable.createdAt);
    if (cursorCondition === false) { res.status(400).json({ error: "Invalid Reels page." }); return; }
    const rows = await selectReels(viewerId, and(cursorCondition, baseWhere), limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    res.json(GetReelsFeedResponse.parse({
      items: page.map((row) => project(row, viewerId)),
      nextCursor: rows.length > limit && last ? encodeReelCursor(last.createdAt, last.id) : null,
    }));
    return;
  }

  const mixCursor = query.data.cursor ? decodeReelFeedMixCursor(query.data.cursor) : null;
  if (query.data.cursor && !mixCursor) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const cutoff = mixCursor?.cutoff ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const olderCursor = mixCursor?.older ? encodeReelCursor(mixCursor.older.createdAt, mixCursor.older.id) : undefined;
  const recentCursor = mixCursor?.recent ? encodeReelCursor(mixCursor.recent.createdAt, mixCursor.recent.id) : undefined;
  const olderCondition = afterCursor(olderCursor, reelsTable.createdAt);
  const recentCondition = afterCursor(recentCursor, reelsTable.createdAt);
  if (olderCondition === false || recentCondition === false) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const [olderRows, recentRows] = await Promise.all([
    selectReels(viewerId, and(baseWhere, lt(reelsTable.createdAt, cutoff), olderCondition), limit + 1),
    selectReels(viewerId, and(baseWhere, gte(reelsTable.createdAt, cutoff), recentCondition), limit + 1),
  ]);
  const mixed = mixReelFeedLanes(olderRows, recentRows, limit, mixCursor?.nextLane ?? "older");
  const olderLast = mixed.olderUsed ? olderRows[mixed.olderUsed - 1] : undefined;
  const recentLast = mixed.recentUsed ? recentRows[mixed.recentUsed - 1] : undefined;
  const nextCursor = olderRows.length > mixed.olderUsed || recentRows.length > mixed.recentUsed
    ? encodeReelFeedMixCursor({
        cutoff,
        older: olderLast ? { createdAt: olderLast.createdAt, id: olderLast.id } : mixCursor?.older ?? null,
        recent: recentLast ? { createdAt: recentLast.createdAt, id: recentLast.id } : mixCursor?.recent ?? null,
        nextLane: mixed.nextLane,
      })
    : null;
  res.json(GetReelsFeedResponse.parse({
    items: mixed.items.map((row) => project(row, viewerId)),
    nextCursor,
  }));
});

router.get("/vibeswipe/reels/mine", async (req, res): Promise<void> => {
  const query = GetMyReelsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const where = afterCursor(query.data.cursor, reelsTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const viewerId = uid(req);
  const rows = await selectReels(viewerId, and(eq(reelsTable.userId, viewerId), where), 25);
  const page = rows.slice(0, 24);
  const last = page[page.length - 1];
  res.json(GetMyReelsResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > 24 && last ? encodeReelCursor(last.createdAt, last.id) : null,
  }));
});

router.get("/vibeswipe/profile-reels", async (req, res): Promise<void> => {
  const params = GetProfileReelsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Invalid profile Reels page." }); return; }
  const viewerId = uid(req);
  const profileId = params.data.profileId;
  const [profile] = await db.select({
    id: profilesTable.id,
    deactivated: profilesTable.deactivated,
  }).from(profilesTable).where(eq(profilesTable.id, profileId)).limit(1);
  if (!profile || (profileId !== viewerId && profile.deactivated)) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  if (profileId !== viewerId) {
    const [block] = await db.select({ blockerId: blocksTable.blockerId }).from(blocksTable).where(or(
      and(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, profileId)),
      and(eq(blocksTable.blockerId, profileId), eq(blocksTable.blockedId, viewerId)),
    )).limit(1);
    if (block) { res.status(404).json({ error: "Profile not found." }); return; }
    if (!(await canViewUserProfile(viewerId, profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
  }
  const where = afterCursor(params.data.cursor, reelsTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid profile Reels page." }); return; }
  const rows = await selectReels(viewerId, and(eq(reelsTable.userId, profileId), where), 25);
  const page = rows.slice(0, 24);
  const last = page[page.length - 1];
  res.json(GetProfileReelsResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > 24 && last ? encodeReelCursor(last.createdAt, last.id) : null,
  }));
});

router.get("/vibeswipe/profile-liked-reels", async (req, res): Promise<void> => {
  const query = GetProfileLikedReelsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid liked Reels page." }); return; }
  const viewerId = uid(req);
  const profileId = query.data.profileId;
  if (!(await canViewLikedVideos(viewerId, profileId))) {
    res.status(404).json({ error: "Liked videos are not available." });
    return;
  }
  const where = afterCursor(query.data.cursor, reelLikesTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid liked Reels page." }); return; }
  const rows = await db.select({
    ...reelColumns(viewerId),
    likedAt: reelLikesTable.createdAt,
  }).from(reelLikesTable)
    .innerJoin(reelsTable, eq(reelsTable.id, reelLikesTable.reelId))
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(
      eq(reelLikesTable.userId, profileId),
      visibleReelCondition(viewerId),
      where,
    ))
    .orderBy(desc(reelLikesTable.createdAt), desc(reelsTable.id))
    .limit(25);
  const page = rows.slice(0, 24);
  const last = page[page.length - 1];
  res.json(GetProfileLikedReelsResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > 24 && last ? encodeReelCursor(last.likedAt, last.id) : null,
  }));
});

router.get("/vibeswipe/profile-reposted-reels", async (req, res): Promise<void> => {
  const query = GetProfileRepostedReelsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid reposted Reels page." }); return; }
  const viewerId = uid(req);
  const profileId = query.data.profileId;
  if (!(await canViewUserProfile(viewerId, profileId))) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const where = afterCursor(query.data.cursor, reelRepostsTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid reposted Reels page." }); return; }
  const rows = await db.select({
    ...reelColumns(viewerId),
    repostedAt: reelRepostsTable.createdAt,
  }).from(reelRepostsTable)
    .innerJoin(reelsTable, eq(reelsTable.id, reelRepostsTable.reelId))
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(
      eq(reelRepostsTable.userId, profileId),
      visibleReelCondition(viewerId),
      where,
    ))
    .orderBy(desc(reelRepostsTable.createdAt), desc(reelsTable.id))
    .limit(25);
  const page = rows.slice(0, 24);
  const last = page[page.length - 1];
  res.json(GetProfileRepostedReelsResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > 24 && last ? encodeReelCursor(last.repostedAt, last.id) : null,
  }));
});

router.get("/vibeswipe/reels/saved", async (req, res): Promise<void> => {
  const query = GetSavedReelsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const where = afterCursor(query.data.cursor, reelSavesTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const viewerId = uid(req);
  // Saves are private: always scoped to the signed-in account, never a user id from the request.
  const rows = await db.select({ ...reelColumns(viewerId), savedAt: reelSavesTable.createdAt }).from(reelSavesTable)
    .innerJoin(reelsTable, eq(reelsTable.id, reelSavesTable.reelId))
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(eq(reelSavesTable.userId, viewerId), visibleReelCondition(viewerId), where))
    .orderBy(desc(reelSavesTable.createdAt), desc(reelsTable.id))
    .limit(25);
  const page = rows.slice(0, 24);
  const last = page[page.length - 1];
  res.json(GetSavedReelsResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > 24 && last ? encodeReelCursor(last.savedAt, last.id) : null,
  }));
});

router.post("/vibeswipe/reels", async (req, res): Promise<void> => {
  const body = CreateReelBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose an approved video or photo, with a caption under 300 characters." }); return; }
  const soundtrack = getReelSoundtrack(body.data.soundtrackId);
  if (body.data.soundtrackId && !soundtrack) {
    res.status(400).json({ error: "Choose a music track from the available catalog." }); return;
  }
  const userId = uid(req);
  if (body.data.slideMediaIds) {
    const mediaIds = body.data.slideMediaIds;
    if (mediaIds.length < 1 || mediaIds.length > 10 || new Set(mediaIds).size !== mediaIds.length) {
      res.status(400).json({ error: "Choose between 1 and 10 different photos." }); return;
    }
    const assets = await db.select().from(mediaAssetsTable).where(inArray(mediaAssetsTable.id, mediaIds));
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    const orderedAssets = mediaIds.map((id) => assetsById.get(id));
    if (orderedAssets.some((asset) => !asset)) { res.status(404).json({ error: "One or more photo uploads could not be found." }); return; }
    const slides = orderedAssets as NonNullable<typeof orderedAssets[number]>[];
    if (slides.some((asset) => asset.ownerId !== userId || asset.matchId)) {
      res.status(403).json({ error: "Every photo must be uploaded by your account." }); return;
    }
    if (slides.some((asset) => asset.mediaType !== "image")) {
      res.status(400).json({ error: "Photo slides can only contain images." }); return;
    }
    const [alreadyPosted] = await db.select({ mediaId: reelSlidesTable.mediaId }).from(reelSlidesTable)
      .where(inArray(reelSlidesTable.mediaId, mediaIds)).limit(1);
    const [alreadyVideo] = await db.select({ mediaId: reelsTable.mediaId }).from(reelsTable)
      .where(inArray(reelsTable.mediaId, mediaIds)).limit(1);
    if (alreadyPosted || alreadyVideo) { res.status(409).json({ error: "One of these photos has already been posted. Choose a fresh copy." }); return; }
    const [usedByStory] = await db.select({ id: storiesTable.id }).from(storiesTable)
      .where(inArray(storiesTable.mediaUrl, mediaIds.map((id) => `media:${id}`))).limit(1);
    if (usedByStory) { res.status(409).json({ error: "Choose photos that are not already used by a Story." }); return; }

    try {
      for (let start = 0; start < slides.length; start += 2) {
        const results = await Promise.allSettled(slides.slice(start, start + 2).map(processSafeReelImage));
        const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
        if (failed) throw failed.reason;
      }
    } catch (error) {
      if (error instanceof ReelSafetyError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "One or more photo uploads could not be found." }); return; }
      req.log.error({ err: error, mediaIds }, "Could not check Reel slideshow photos");
      res.status(500).json({ error: "The photos could not be checked. Please try again." });
      return;
    }
    const created = await db.transaction(async (tx) => {
      const [reel] = await tx.insert(reelsTable).values({
        userId, mediaId: mediaIds[0], mediaType: "slides", audience: body.data.audience ?? "public",
        allowDownloads: body.data.allowDownloads ?? null, caption: cleanReelCaption(body.data.caption),
        soundtrack,
        durationSeconds: null, createdAt: new Date(),
      }).onConflictDoNothing({ target: reelsTable.mediaId }).returning({ id: reelsTable.id });
      if (!reel) return null;
      const insertedSlides = await tx.insert(reelSlidesTable)
        .values(mediaIds.map((mediaId, position) => ({ reelId: reel.id, mediaId, position })))
        .onConflictDoNothing()
        .returning({ mediaId: reelSlidesTable.mediaId });
      if (insertedSlides.length !== mediaIds.length) {
        await tx.delete(reelsTable).where(eq(reelsTable.id, reel.id));
        return null;
      }
      return reel;
    });
    if (!created) { res.status(409).json({ error: "One of these photos has already been posted." }); return; }
    const row = await findVisibleReel(userId, created.id);
    res.status(201).json(CreateReelResponse.parse(project(row!, userId)));
    return;
  }
  if (!body.data.mediaId) { res.status(400).json({ error: "Choose a processed video or photo slideshow." }); return; }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, body.data.mediaId)).limit(1);
  const problem = reelAssetProblem(asset, userId);
  if (problem) { res.status(asset && asset.ownerId === userId && !asset.matchId ? 400 : 403).json({ error: problem }); return; }
  if (!(await reelIsApproved(asset!))) { res.status(422).json({ error: "This video has not passed its safety check. Process the video before posting." }); return; }
  const [story] = await db.select({ id: storiesTable.id }).from(storiesTable)
    .where(eq(storiesTable.mediaUrl, `media:${body.data.mediaId}`)).limit(1);
  if (story) { res.status(409).json({ error: "This video is already used by a story." }); return; }
  const [created] = await db.insert(reelsTable).values({
    userId, mediaId: body.data.mediaId, audience: body.data.audience ?? "public",
    allowDownloads: body.data.allowDownloads ?? null, caption: cleanReelCaption(body.data.caption),
    soundtrack, durationSeconds: asset!.durationSeconds, createdAt: new Date(),
  }).onConflictDoNothing({ target: reelsTable.mediaId }).returning({ id: reelsTable.id });
  if (!created) { res.status(409).json({ error: "This video has already been posted." }); return; }
  const row = await findVisibleReel(userId, created.id);
  res.status(201).json(CreateReelResponse.parse(project(row!, userId)));
});

router.get("/vibeswipe/reels/:reelId", async (req, res): Promise<void> => {
  const params = GetReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const viewerId = uid(req);
  const row = await findVisibleReel(viewerId, params.data.reelId);
  if (!row) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  res.json(GetReelResponse.parse(project(row, viewerId)));
});

router.get("/vibeswipe/reels/:reelId/download", async (req, res): Promise<void> => {
  const params = DownloadReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const viewerId = uid(req);
  const reel = await findVisibleReel(viewerId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  if (!canDownloadReel(reel.allowDownloads, reel.mediaType as "video" | "slides", Boolean(reel.allowsDownloads))) {
    res.status(403).json({ error: "The creator has disabled downloads for this Reel." }); return;
  }
  if (reel.mediaType === "slides") {
    const slides = await db.select({
      id: mediaAssetsTable.id,
      objectPath: mediaAssetsTable.objectPath,
      contentType: mediaAssetsTable.contentType,
      ownerId: mediaAssetsTable.ownerId,
      matchId: mediaAssetsTable.matchId,
      mediaType: mediaAssetsTable.mediaType,
    }).from(reelSlidesTable)
      .innerJoin(mediaAssetsTable, eq(mediaAssetsTable.id, reelSlidesTable.mediaId))
      .where(eq(reelSlidesTable.reelId, reel.id))
      .orderBy(asc(reelSlidesTable.position));
    if (
      slides.length < 1 ||
      slides.length > 10 ||
      slides.some((slide) => slide.ownerId !== reel.userId || slide.matchId || slide.mediaType !== "image" || slide.contentType !== "image/jpeg")
    ) {
      res.status(404).json({ error: "This Reel's photos are no longer available." });
      return;
    }
    const archive = createReelPhotoArchive();
    const cancelArchive = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) {
        cancelArchive.abort();
        archive.abort();
      }
    });
    try {
      res.status(200);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="vibeswipes-reel-${reel.id}-photos.zip"`);
      res.setHeader("Cache-Control", "private, no-store");
      archive.on("warning", (error) => {
        req.log.warn({ err: error, reelId: reel.id }, "Could not read a Reel photo for its archive");
        archive.destroy(error);
      });
      archive.on("error", (error) => {
        req.log.error({ err: error, reelId: reel.id }, "Reel photo archive failed");
      });
      const streaming = pipeline(archive, res, { signal: cancelArchive.signal });
      for (const [index, slide] of slides.entries()) {
        if (cancelArchive.signal.aborted) return;
        const file = await reelStorage.getObjectEntityFile(slide.objectPath);
        archive.append(file.createReadStream(), { name: `photo-${String(index + 1).padStart(2, "0")}.jpg` });
      }
      await archive.finalize();
      await streaming;
    } catch (error) {
      if (cancelArchive.signal.aborted || res.destroyed) return;
      cancelArchive.abort();
      archive.abort();
      req.log.error({ err: error, reelId: reel.id }, "Reel photo download failed");
      if (!res.headersSent) res.status(500).json({ error: "Could not export these Reel photos." });
      else res.destroy(error instanceof Error ? error : undefined);
    }
    return;
  }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, reel.mediaId)).limit(1);
  if (!asset) { res.status(404).json({ error: "Reel media not found." }); return; }
  const workDirectory = await mkdtemp(join(tmpdir(), "vibeswipe-reel-export-"));
  const inputPath = join(workDirectory, "source.mp4");
  const outputPath = join(workDirectory, "export.mp4");
  const cancelExport = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) cancelExport.abort();
  });
  try {
    const file = await reelStorage.getObjectEntityFile(asset.objectPath);
    const response = await reelStorage.downloadObject(file, 300);
    if (!response.ok || !response.body) {
      if (response.status === 404) { res.status(404).json({ error: "Reel media not found." }); return; }
      throw new Error(`Could not read stored Reel video (${response.status}).`);
    }
    await pipeline(
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      createWriteStream(inputPath),
      { signal: cancelExport.signal },
    );
    const rendered = await addReelEndCard(
      inputPath,
      outputPath,
      join(process.cwd(), "assets", "reel-end-card.png"),
      cancelExport.signal,
    );
    if (cancelExport.signal.aborted || res.destroyed) return;
    res.status(200);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(rendered.size));
    res.setHeader("Content-Disposition", `attachment; filename="vibeswipes-reel-${reel.id}.mp4"`);
    res.setHeader("Cache-Control", "private, no-store");
    await pipeline(createReadStream(outputPath), res);
  } catch (error) {
    if (cancelExport.signal.aborted || res.destroyed) return;
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Reel media not found." }); return; }
    req.log.error({ err: error, reelId: reel.id }, "Reel download failed");
    if (!res.headersSent) res.status(500).json({ error: "Could not export this Reel." });
    else res.destroy(error instanceof Error ? error : undefined);
  } finally {
    await rm(workDirectory, { recursive: true, force: true }).catch(error => {
      req.log.warn({ err: error, reelId: reel.id }, "Could not clean temporary Reel export files");
    });
  }
});

router.post("/vibeswipe/reels/:reelId/views", async (req, res): Promise<void> => {
  const params = GetReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const viewerId = uid(req);
  const reel = await findVisibleReel(viewerId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  if (reel.userId === viewerId) {
    res.json(RecordReelViewResponse.parse({ viewCount: Number(reel.viewCount) }));
    return;
  }
  await db.insert(reelViewsTable)
    .values({ reelId: params.data.reelId, viewerId })
    .onConflictDoNothing();
  const [views] = await db.select({
    viewCount: sql<number>`count(*)::int`,
  }).from(reelViewsTable).where(eq(reelViewsTable.reelId, params.data.reelId));
  res.json(RecordReelViewResponse.parse({ viewCount: Number(views?.viewCount ?? 0) }));
});

router.post("/vibeswipe/reels/:reelId/not-interested", async (req, res): Promise<void> => {
  const params = MarkReelNotInterestedParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const userId = uid(req);
  const reel = await findVisibleReel(userId, params.data.reelId);
  if (!reel || reel.userId === userId) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  const captionTerms = reelSearchTerms(reel.caption);
  await db.insert(reelNotInterestedTable).values({
    userId,
    reelId: reel.id,
    creatorId: reel.userId,
    captionTerms,
  }).onConflictDoUpdate({
    target: [reelNotInterestedTable.userId, reelNotInterestedTable.reelId],
    set: { creatorId: reel.userId, captionTerms, createdAt: new Date() },
  });
  res.status(204).end();
});

router.post("/vibeswipe/reels/:reelId/reports", async (req, res): Promise<void> => {
  const params = GetReelParams.safeParse(req.params);
  const body = ReportReelBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Choose a valid report reason." });
    return;
  }
  const reporterId = uid(req);
  const reel = await findVisibleReel(reporterId, params.data.reelId);
  if (!reel || reel.userId === reporterId) {
    res.status(404).json({ error: "This Reel is no longer available." });
    return;
  }
  const [created] = await db.insert(reelReportsTable).values({
    reelId: reel.id,
    reporterId,
    reason: body.data.reason,
    details: body.data.details?.trim() || null,
  }).onConflictDoNothing().returning({ id: reelReportsTable.id });
  if (!created) {
    res.status(409).json({ error: "You have already reported this Reel." });
    return;
  }
  res.status(201).end();
});

router.post("/vibeswipe/reels/:reelId/shares", async (req, res): Promise<void> => {
  const params = GetReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const viewerId = uid(req);
  const reel = await findVisibleReel(viewerId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  await db.insert(reelSharesTable)
    .values({ reelId: params.data.reelId, userId: viewerId })
    .onConflictDoNothing();
  const updated = await findVisibleReel(viewerId, params.data.reelId);
  if (!updated) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  res.json(RecordReelShareResponse.parse({ shareCount: Number(updated.shareCount) }));
});

router.delete("/vibeswipe/reels/:reelId", async (req, res): Promise<void> => {
  const params = DeleteReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const userId = uid(req);
  const slideRows = await db.select({ mediaId: reelSlidesTable.mediaId }).from(reelSlidesTable)
    .where(eq(reelSlidesTable.reelId, params.data.reelId));
  const [deleted] = await db.delete(reelsTable)
    .where(and(eq(reelsTable.id, params.data.reelId), eq(reelsTable.userId, userId)))
    .returning({ mediaId: reelsTable.mediaId });
  if (!deleted) { res.status(404).json({ error: "Reel not found." }); return; }
  for (const mediaId of new Set([deleted.mediaId, ...slideRows.map((row) => row.mediaId)])) {
    try { await removeUnreferencedProfileMedia(mediaId, userId); }
    catch (error) { req.log.error({ err: error, mediaId }, "Could not remove deleted Reel media"); }
  }
  res.status(204).end();
});

for (const kind of ["like", "save", "repost"] as const) {
  const table = kind === "like" ? reelLikesTable : kind === "save" ? reelSavesTable : reelRepostsTable;
  router.put(`/vibeswipe/reels/:reelId/${kind}`, async (req, res): Promise<void> => {
    const params = LikeReelParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
    const userId = uid(req);
    const reel = await findVisibleReel(userId, params.data.reelId);
    if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
    if (kind === "repost" && reel.userId === userId) {
      res.status(400).json({ error: "You cannot repost your own Reel." });
      return;
    }
    const notify = await db.transaction(async tx => {
      const inserted = await tx.insert(table).values({ reelId: reel.id, userId, createdAt: new Date() }).onConflictDoNothing().returning();
      if (kind !== "like" || !inserted.length || reel.userId === userId) return false;
      const [recipient] = await tx.select({
        notifyLikes: profilesTable.notifyLikes, notifyMatches: profilesTable.notifyMatches,
      }).from(profilesTable).where(eq(profilesTable.id, reel.userId)).limit(1);
      if (!recipient || !(recipient.notifyLikes ?? recipient.notifyMatches)) return false;
      const notices = await tx.insert(vibeSwipeNotificationsTable).values({
        recipientId: reel.userId, actorId: userId, type: "reel_like", reelId: reel.id,
      }).onConflictDoNothing().returning({ id: vibeSwipeNotificationsTable.id });
      return notices.length > 0;
    });
    if (notify) {
      const [actor] = await db.select({ name: profilesTable.name }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
      void sendReelLikePush({ recipientId: reel.userId, actorName: actor?.name ?? "Someone", reelId: reel.id })
        .catch(error => req.log.error({ err: error }, "Could not deliver Reel like push"));
    }
    res.json(LikeReelResponse.parse(await engagement(userId, params.data.reelId)));
  });
  router.delete(`/vibeswipe/reels/:reelId/${kind}`, async (req, res): Promise<void> => {
    const params = LikeReelParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
    const userId = uid(req);
    await db.delete(table).where(and(eq(table.reelId, params.data.reelId), eq(table.userId, userId)));
    const result = await engagement(userId, params.data.reelId);
    if (!result) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
    res.json(LikeReelResponse.parse(result));
  });
}

router.get("/vibeswipe/reels/:reelId/comments", async (req, res): Promise<void> => {
  const params = GetReelCommentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const viewerId = uid(req);
  const reel = await findVisibleReel(viewerId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  const rows = await db.select({
    id: reelCommentsTable.id, reelId: reelCommentsTable.reelId, authorId: reelCommentsTable.userId,
    parentCommentId: reelCommentsTable.parentCommentId, content: reelCommentsTable.content,
    mediaId: reelCommentsTable.mediaId,
    createdAt: reelCommentsTable.createdAt, name: profilesTable.name, photos: profilesTable.photos,
    likeCount: sql<number>`(SELECT count(*)::int FROM ${reelCommentReactionsTable} WHERE ${reelCommentReactionsTable.commentId} = ${reelCommentsTable.id} AND ${reelCommentReactionsTable.reaction} = 'like')`,
    dislikeCount: sql<number>`(SELECT count(*)::int FROM ${reelCommentReactionsTable} WHERE ${reelCommentReactionsTable.commentId} = ${reelCommentsTable.id} AND ${reelCommentReactionsTable.reaction} = 'dislike')`,
    myReaction: sql<"like" | "dislike" | null>`(SELECT ${reelCommentReactionsTable.reaction} FROM ${reelCommentReactionsTable} WHERE ${reelCommentReactionsTable.commentId} = ${reelCommentsTable.id} AND ${reelCommentReactionsTable.userId} = ${viewerId} LIMIT 1)`,
  }).from(reelCommentsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reelCommentsTable.userId))
    .where(and(
      eq(reelCommentsTable.reelId, reel.id),
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
      sql`NOT EXISTS (SELECT 1 FROM ${blocksTable} WHERE (${blocksTable.blockerId} = ${viewerId} AND ${blocksTable.blockedId} = ${reelCommentsTable.userId}) OR (${blocksTable.blockerId} = ${reelCommentsTable.userId} AND ${blocksTable.blockedId} = ${viewerId}))`,
    ))
    .orderBy(desc(reelCommentsTable.createdAt)).limit(100);
  res.json(GetReelCommentsResponse.parse(rows.reverse().map((row) => ({
    id: row.id, reelId: row.reelId, parentCommentId: row.parentCommentId, authorId: row.authorId, authorName: row.name, authorPhoto: row.photos[0] ?? null,
    content: row.content, mediaReference: row.mediaId ? `media:${row.mediaId}` : null,
    likeCount: row.likeCount, dislikeCount: row.dislikeCount, myReaction: row.myReaction,
    canDelete: row.authorId === viewerId || reel.userId === viewerId, createdAt: row.createdAt,
  }))));
});

router.post("/vibeswipe/reels/:reelId/comments", async (req, res): Promise<void> => {
  const params = CreateReelCommentParams.safeParse(req.params);
  const body = CreateReelCommentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Write a comment up to 500 characters." }); return; }
  const content = body.data.content?.trim() ?? "";
  const mediaId = body.data.mediaId;
  if (!content && !mediaId) { res.status(400).json({ error: "Add text or a photo to your comment." }); return; }
  const userId = uid(req);
  const reel = await findVisibleReel(userId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  if (mediaId) {
    const [asset] = await db.select({ id: mediaAssetsTable.id }).from(mediaAssetsTable).where(and(
      eq(mediaAssetsTable.id, mediaId),
      eq(mediaAssetsTable.ownerId, userId),
      eq(mediaAssetsTable.mediaType, "image"),
      isNull(mediaAssetsTable.matchId),
    )).limit(1);
    if (!asset) { res.status(403).json({ error: "Choose a photo uploaded from this account." }); return; }
  }
  const parentCommentId = body.data.parentCommentId;
  let parentAuthorId: string | null = null;
  if (parentCommentId) {
    const [parent] = await db.select({
      id: reelCommentsTable.id, authorId: reelCommentsTable.userId,
    }).from(reelCommentsTable)
      .innerJoin(profilesTable, eq(profilesTable.id, reelCommentsTable.userId))
      .where(and(
        eq(reelCommentsTable.id, parentCommentId),
        eq(reelCommentsTable.reelId, reel.id),
        isNull(reelCommentsTable.parentCommentId),
        eq(profilesTable.deactivated, false),
        eq(profilesTable.adminSuspended, false),
        sql`NOT EXISTS (SELECT 1 FROM ${blocksTable} WHERE (${blocksTable.blockerId} = ${userId} AND ${blocksTable.blockedId} = ${reelCommentsTable.userId}) OR (${blocksTable.blockerId} = ${reelCommentsTable.userId} AND ${blocksTable.blockedId} = ${userId}))`,
      )).limit(1);
    if (!parent) { res.status(404).json({ error: "That comment is no longer available to reply to." }); return; }
    parentAuthorId = parent.authorId;
  }
  if (!(await canCommentOnReel(userId, reel.userId))) {
    res.status(403).json({ error: "The creator does not allow you to comment on this Reel." });
    return;
  }
  const [comment] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(reelCommentsTable).values({
      reelId: reel.id, parentCommentId: parentCommentId ?? null, userId, content, mediaId: mediaId ?? null, createdAt: new Date(),
    }).returning();
    if (created && parentAuthorId && parentAuthorId !== userId) {
      const [recipient] = await tx.select({
        notifyLikes: profilesTable.notifyLikes, notifyMatches: profilesTable.notifyMatches,
      }).from(profilesTable).where(eq(profilesTable.id, parentAuthorId)).limit(1);
      if (recipient && (recipient.notifyLikes ?? recipient.notifyMatches)) {
        await tx.insert(vibeSwipeNotificationsTable).values({
          recipientId: parentAuthorId, actorId: userId, type: "reel_comment_reply", reelId: reel.id, commentId: created.id,
        });
      }
    }
    return [created];
  });
  const [me] = await db.select({ name: profilesTable.name, photos: profilesTable.photos }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (parentAuthorId && parentAuthorId !== userId) {
    void sendReelCommentReplyPush({
      recipientId: parentAuthorId, actorName: me?.name ?? "Someone", reelId: reel.id, commentId: comment!.id,
    }).catch(error => req.log.error({ err: error, reelId: reel.id }, "Could not deliver Reel comment reply push"));
  }
  res.status(201).json(CreateReelCommentResponse.parse({
    id: comment!.id, reelId: reel.id, parentCommentId: comment!.parentCommentId, authorId: userId, authorName: me?.name ?? "You", authorPhoto: me?.photos[0] ?? null,
    content, mediaReference: mediaId ? `media:${mediaId}` : null, likeCount: 0, dislikeCount: 0, myReaction: null, canDelete: true, createdAt: comment!.createdAt,
  }));
});

router.put("/vibeswipe/reels/:reelId/comments/:commentId/reaction", async (req, res): Promise<void> => {
  const params = SetReelCommentReactionParams.safeParse(req.params);
  const body = SetReelCommentReactionBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Choose a valid comment reaction." }); return; }
  const userId = uid(req);
  const reel = await findVisibleReel(userId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  const [comment] = await db.select({ id: reelCommentsTable.id, authorId: reelCommentsTable.userId }).from(reelCommentsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reelCommentsTable.userId))
    .where(and(
      eq(reelCommentsTable.id, params.data.commentId),
      eq(reelCommentsTable.reelId, reel.id),
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
      sql`NOT EXISTS (SELECT 1 FROM ${blocksTable} WHERE (${blocksTable.blockerId} = ${userId} AND ${blocksTable.blockedId} = ${reelCommentsTable.userId}) OR (${blocksTable.blockerId} = ${reelCommentsTable.userId} AND ${blocksTable.blockedId} = ${userId}))`,
    )).limit(1);
  if (!comment) { res.status(404).json({ error: "Comment not found." }); return; }

  const notifyCommentLike = await db.transaction(async tx => {
    const [previousReaction] = await tx.select({ reaction: reelCommentReactionsTable.reaction })
      .from(reelCommentReactionsTable)
      .where(and(
        eq(reelCommentReactionsTable.commentId, comment.id),
        eq(reelCommentReactionsTable.userId, userId),
      )).limit(1);

    if (body.data.reaction === null) {
      await tx.delete(reelCommentReactionsTable).where(and(
        eq(reelCommentReactionsTable.commentId, comment.id),
        eq(reelCommentReactionsTable.userId, userId),
      ));
    } else {
      await tx.insert(reelCommentReactionsTable).values({
        commentId: comment.id,
        userId,
        reaction: body.data.reaction,
      }).onConflictDoUpdate({
        target: [reelCommentReactionsTable.commentId, reelCommentReactionsTable.userId],
        set: { reaction: body.data.reaction, createdAt: new Date() },
      });
    }

    if (body.data.reaction !== "like" || previousReaction?.reaction === "like" || comment.authorId === userId) return false;
    const [recipient] = await tx.select({
      notifyLikes: profilesTable.notifyLikes,
      notifyMatches: profilesTable.notifyMatches,
    }).from(profilesTable).where(eq(profilesTable.id, comment.authorId)).limit(1);
    if (!recipient || !(recipient.notifyLikes ?? recipient.notifyMatches)) return false;
    const [notification] = await tx.insert(vibeSwipeNotificationsTable).values({
      recipientId: comment.authorId,
      actorId: userId,
      type: "reel_comment_like",
      reelId: reel.id,
      commentId: comment.id,
    }).onConflictDoNothing().returning({ id: vibeSwipeNotificationsTable.id });
    return Boolean(notification);
  });

  if (notifyCommentLike) {
    const [actor] = await db.select({ name: profilesTable.name }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    void sendReelCommentLikePush({
      recipientId: comment.authorId,
      actorName: actor?.name ?? "Someone",
      reelId: reel.id,
      commentId: comment.id,
    }).catch(error => req.log.error({ err: error, reelId: reel.id, commentId: comment.id }, "Could not deliver Reel comment-like push"));
  }

  const [summary] = await db.select({
    likeCount: sql<number>`count(*) FILTER (WHERE ${reelCommentReactionsTable.reaction} = 'like')::int`,
    dislikeCount: sql<number>`count(*) FILTER (WHERE ${reelCommentReactionsTable.reaction} = 'dislike')::int`,
    myReaction: sql<"like" | "dislike" | null>`max(CASE WHEN ${reelCommentReactionsTable.userId} = ${userId} THEN ${reelCommentReactionsTable.reaction} END)`,
  }).from(reelCommentReactionsTable).where(eq(reelCommentReactionsTable.commentId, comment.id));
  res.json(SetReelCommentReactionResponse.parse(summary));
});

router.delete("/vibeswipe/reels/:reelId/comments/:commentId", async (req, res): Promise<void> => {
  const params = DeleteReelCommentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid comment." }); return; }
  const userId = uid(req);
  const [target] = await db.select({ id: reelCommentsTable.id, authorId: reelCommentsTable.userId, ownerId: reelsTable.userId })
    .from(reelCommentsTable).innerJoin(reelsTable, eq(reelsTable.id, reelCommentsTable.reelId))
    .where(and(eq(reelCommentsTable.id, params.data.commentId), eq(reelCommentsTable.reelId, params.data.reelId))).limit(1);
  if (!target || (target.authorId !== userId && target.ownerId !== userId)) { res.status(404).json({ error: "Comment not found." }); return; }
  await db.delete(reelCommentsTable).where(eq(reelCommentsTable.id, target.id));
  res.status(204).end();
});

export default router;
