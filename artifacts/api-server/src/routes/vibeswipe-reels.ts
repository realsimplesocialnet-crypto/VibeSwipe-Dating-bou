import { getAuth } from "@clerk/express";
import {
  CreateReelBody, CreateReelCommentBody, CreateReelCommentParams, CreateReelCommentResponse, CreateReelResponse,
  DeleteReelCommentParams, DeleteReelParams, GetMyReelsQueryParams, GetMyReelsResponse, GetReelCommentsParams,
  GetReelCommentsResponse, GetReelParams, GetReelResponse, GetReelsFeedQueryParams, GetReelsFeedResponse,
  GetSavedReelsQueryParams, GetSavedReelsResponse, LikeReelParams, LikeReelResponse,
  TranscodeReelVideoParams, TranscodeReelVideoResponse,
} from "@workspace/api-zod";
import {
  blocksTable, db, mediaAssetsTable, profilesTable, reelCommentsTable, reelLikesTable, reelSavesTable, reelsTable, storiesTable,
} from "@workspace/db";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { cleanReelCaption, decodeReelCursor, encodeReelCursor, reelAssetProblem, reelLocation } from "../lib/reel-cursor";
import { visibleReelCondition } from "../lib/reels-visibility";
import { removeUnreferencedProfileMedia } from "../lib/profileMediaCleanup";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { ProfileVideoValidationError, transcodeReelVideo } from "../lib/profileVideoTranscoder";
import { processSafeReel, reelIsApproved } from "../lib/reel-safety";
import { ReelSafetyError } from "../lib/reel-safety-policy";

const router: IRouter = Router();
router.use("/vibeswipe/reels", requireAuth);

const PAGE_SIZE = 6;
const reelStorage = new ObjectStorageService();

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
    id: reelsTable.id, userId: reelsTable.userId, mediaId: reelsTable.mediaId, caption: reelsTable.caption,
    durationSeconds: reelsTable.durationSeconds, createdAt: reelsTable.createdAt,
    name: profilesTable.name, age: profilesTable.age, showAge: profilesTable.showAge, city: profilesTable.city,
    state: profilesTable.state, country: profilesTable.country, isVerified: profilesTable.isVerified, photos: profilesTable.photos,
    likeCount: sql<number>`(SELECT count(*)::int FROM ${reelLikesTable} WHERE ${reelLikesTable.reelId} = ${reelsTable.id})`,
    commentCount: sql<number>`(SELECT count(*)::int FROM ${reelCommentsTable} WHERE ${reelCommentsTable.reelId} = ${reelsTable.id})`,
    likedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${reelLikesTable} WHERE ${reelLikesTable.reelId} = ${reelsTable.id} AND ${reelLikesTable.userId} = ${viewerId})`,
    savedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${reelSavesTable} WHERE ${reelSavesTable.reelId} = ${reelsTable.id} AND ${reelSavesTable.userId} = ${viewerId})`,
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
    id: row.id, creatorId: row.userId, creatorName: row.name, creatorAge: row.showAge ? row.age : null,
    creatorLocation: reelLocation([row.city, row.state, row.country]), creatorVerified: row.isVerified,
    creatorPhoto: row.photos[0] ?? null, videoReference: `media:${row.mediaId}`, caption: row.caption,
    durationSeconds: row.durationSeconds, likeCount: Number(row.likeCount), commentCount: Number(row.commentCount),
    likedByMe: Boolean(row.likedByMe), savedByMe: Boolean(row.savedByMe), isOwner: row.userId === viewerId, createdAt: row.createdAt,
  };
}

async function findVisibleReel(viewerId: string, reelId: string) {
  const [row] = await selectReels(viewerId, eq(reelsTable.id, reelId), 1);
  return row;
}

async function engagement(viewerId: string, reelId: string) {
  const row = await findVisibleReel(viewerId, reelId);
  return row ? { likedByMe: Boolean(row.likedByMe), savedByMe: Boolean(row.savedByMe), likeCount: Number(row.likeCount), commentCount: Number(row.commentCount) } : null;
}

function afterCursor(cursorText: string | undefined, column: typeof reelsTable.createdAt | typeof reelSavesTable.createdAt): SQL | undefined | false {
  if (!cursorText) return undefined;
  const cursor = decodeReelCursor(cursorText);
  if (!cursor) return false;
  return sql`(${column}, ${reelsTable.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`;
}

router.get("/vibeswipe/reels", async (req, res): Promise<void> => {
  const query = GetReelsFeedQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const where = afterCursor(query.data.cursor, reelsTable.createdAt);
  if (where === false) { res.status(400).json({ error: "Invalid Reels page." }); return; }
  const viewerId = uid(req);
  const limit = query.data.limit ?? PAGE_SIZE;
  const rows = await selectReels(viewerId, where, limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  res.json(GetReelsFeedResponse.parse({
    items: page.map((row) => project(row, viewerId)),
    nextCursor: rows.length > limit && last ? encodeReelCursor(last.createdAt, last.id) : null,
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
  if (!body.success) { res.status(400).json({ error: "Choose a processed video and a caption under 300 characters." }); return; }
  const userId = uid(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, body.data.mediaId)).limit(1);
  const problem = reelAssetProblem(asset, userId);
  if (problem) { res.status(asset && asset.ownerId === userId && !asset.matchId ? 400 : 403).json({ error: problem }); return; }
  if (!(await reelIsApproved(asset!))) { res.status(422).json({ error: "This video has not passed its safety check. Process the video before posting." }); return; }
  const [story] = await db.select({ id: storiesTable.id }).from(storiesTable)
    .where(eq(storiesTable.mediaUrl, `media:${body.data.mediaId}`)).limit(1);
  if (story) { res.status(409).json({ error: "This video is already used by a story." }); return; }
  const [created] = await db.insert(reelsTable).values({
    userId, mediaId: body.data.mediaId, caption: cleanReelCaption(body.data.caption),
    durationSeconds: asset!.durationSeconds, createdAt: new Date(),
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

router.delete("/vibeswipe/reels/:reelId", async (req, res): Promise<void> => {
  const params = DeleteReelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
  const userId = uid(req);
  const [deleted] = await db.delete(reelsTable)
    .where(and(eq(reelsTable.id, params.data.reelId), eq(reelsTable.userId, userId)))
    .returning({ mediaId: reelsTable.mediaId });
  if (!deleted) { res.status(404).json({ error: "Reel not found." }); return; }
  try { await removeUnreferencedProfileMedia(deleted.mediaId, userId); }
  catch (error) { req.log.error({ err: error, mediaId: deleted.mediaId }, "Could not remove deleted Reel video"); }
  res.status(204).end();
});

for (const kind of ["like", "save"] as const) {
  const table = kind === "like" ? reelLikesTable : reelSavesTable;
  router.put(`/vibeswipe/reels/:reelId/${kind}`, async (req, res): Promise<void> => {
    const params = LikeReelParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid Reel." }); return; }
    const userId = uid(req);
    if (!(await findVisibleReel(userId, params.data.reelId))) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
    await db.insert(table).values({ reelId: params.data.reelId, userId, createdAt: new Date() }).onConflictDoNothing();
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
    content: reelCommentsTable.content, createdAt: reelCommentsTable.createdAt, name: profilesTable.name, photos: profilesTable.photos,
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
    id: row.id, reelId: row.reelId, authorId: row.authorId, authorName: row.name, authorPhoto: row.photos[0] ?? null,
    content: row.content, canDelete: row.authorId === viewerId || reel.userId === viewerId, createdAt: row.createdAt,
  }))));
});

router.post("/vibeswipe/reels/:reelId/comments", async (req, res): Promise<void> => {
  const params = CreateReelCommentParams.safeParse(req.params);
  const body = CreateReelCommentBody.safeParse(req.body);
  const content = body.success ? body.data.content.trim() : "";
  if (!params.success || !content) { res.status(400).json({ error: "Write a comment up to 500 characters." }); return; }
  const userId = uid(req);
  const reel = await findVisibleReel(userId, params.data.reelId);
  if (!reel) { res.status(404).json({ error: "This Reel is no longer available." }); return; }
  const [comment] = await db.insert(reelCommentsTable).values({ reelId: reel.id, userId, content, createdAt: new Date() }).returning();
  const [me] = await db.select({ name: profilesTable.name, photos: profilesTable.photos }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  res.status(201).json(CreateReelCommentResponse.parse({
    id: comment!.id, reelId: reel.id, authorId: userId, authorName: me?.name ?? "You", authorPhoto: me?.photos[0] ?? null,
    content, canDelete: true, createdAt: comment!.createdAt,
  }));
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
