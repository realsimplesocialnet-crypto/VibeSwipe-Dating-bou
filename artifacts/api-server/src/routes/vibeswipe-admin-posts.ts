import { clerkClient, getAuth } from "@clerk/express";
import {
  GetAdminPostsQueryParams,
  GetAdminPostsResponse,
  RemoveAdminPostBody,
  RemoveAdminPostParams,
  RemoveAdminPostResponse,
} from "@workspace/api-zod";
import {
  adminAuditTable, db, mediaAssetsTable, profilesTable, reelSafetyTable, reelsTable, storiesTable,
} from "@workspace/db";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { createAdminGuard } from "../lib/admin-access";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storage = new ObjectStorageService();

router.use("/vibeswipe/admin/posts", createAdminGuard({
  userId: req => getAuth(req).userId,
  loadUser: id => clerkClient.users.getUser(id),
  email: () => process.env.VIBESWIPE_ADMIN_EMAIL ?? "",
}));

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

function safetyStatus(status: string | null, fallback: "published" | "processing") {
  if (status === "rejected") return "blocked" as const;
  if (status === "checking") return "processing" as const;
  if (status === "error") return "unavailable" as const;
  if (status === "approved") return "published" as const;
  return fallback;
}

async function safePhoto(reference: string[] | null | undefined, ownerId: string): Promise<string | null> {
  const first = reference?.[0];
  if (!first?.startsWith("media:")) return null;
  const mediaId = first.slice(6);
  if (!UUID.test(mediaId)) return null;
  const [asset] = await db.select({ id: mediaAssetsTable.id }).from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, mediaId),
    eq(mediaAssetsTable.ownerId, ownerId),
    eq(mediaAssetsTable.mediaType, "image"),
    isNull(mediaAssetsTable.matchId),
  )).limit(1);
  return asset ? `media:${asset.id}` : null;
}

router.get("/vibeswipe/admin/posts", async (req, res): Promise<void> => {
  const query = GetAdminPostsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Choose a valid post kind and page." }); return; }
  const { page, q, userId, kind } = query.data;
  const offset = (page - 1) * PAGE_SIZE;
  const pattern = q ? likePattern(q) : null;
  const reelConditions = [
    ...(userId ? [eq(reelsTable.userId, userId)] : []),
    ...(pattern ? [or(
      ilike(reelsTable.caption, pattern),
      ilike(profilesTable.name, pattern),
      ilike(reelsTable.userId, pattern),
      sql`${reelsTable.id}::text ILIKE ${pattern}`,
    )!] : []),
  ];
  const storyConditions = [
    ...(userId ? [eq(storiesTable.userId, userId)] : []),
    ...(pattern ? [or(
      ilike(storiesTable.caption, pattern),
      ilike(profilesTable.name, pattern),
      ilike(storiesTable.userId, pattern),
      sql`${storiesTable.id}::text ILIKE ${pattern}`,
    )!] : []),
  ];
  const [reelTotal, storyTotal] = await Promise.all([
    kind === "story" ? Promise.resolve({ total: 0 }) : db.select({ total: count() }).from(reelsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
      .where(reelConditions.length ? and(...reelConditions) : undefined).then(rows => rows[0]),
    kind === "reel" ? Promise.resolve({ total: 0 }) : db.select({ total: count() }).from(storiesTable)
      .leftJoin(profilesTable, eq(profilesTable.id, storiesTable.userId))
      .where(storyConditions.length ? and(...storyConditions) : undefined).then(rows => rows[0]),
  ]);
  const total = (reelTotal?.total ?? 0) + (storyTotal?.total ?? 0);

  const [reelRows, storyRows] = await Promise.all([
    kind === "story" ? Promise.resolve([]) : db.select({
      id: reelsTable.id, authorId: reelsTable.userId, authorName: profilesTable.name, authorPhotos: profilesTable.photos,
      caption: reelsTable.caption, createdAt: reelsTable.createdAt, mediaId: mediaAssetsTable.id,
      safety: reelSafetyTable.status, mediaType: mediaAssetsTable.mediaType,
    }).from(reelsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
      .leftJoin(mediaAssetsTable, and(
        eq(mediaAssetsTable.id, reelsTable.mediaId), eq(mediaAssetsTable.ownerId, reelsTable.userId), isNull(mediaAssetsTable.matchId),
      ))
      .leftJoin(reelSafetyTable, eq(reelSafetyTable.mediaId, reelsTable.mediaId))
      .where(reelConditions.length ? and(...reelConditions) : undefined)
      .orderBy(desc(reelsTable.createdAt), desc(reelsTable.id)).limit(offset + PAGE_SIZE),
    kind === "reel" ? Promise.resolve([]) : db.select({
      id: storiesTable.id, authorId: storiesTable.userId, authorName: profilesTable.name, authorPhotos: profilesTable.photos,
      caption: storiesTable.caption, createdAt: storiesTable.createdAt, expiresAt: storiesTable.expiresAt,
      mediaReference: storiesTable.mediaUrl, mediaId: mediaAssetsTable.id, safety: reelSafetyTable.status,
      mediaType: storiesTable.mediaType,
    }).from(storiesTable)
      .leftJoin(profilesTable, eq(profilesTable.id, storiesTable.userId))
      .leftJoin(mediaAssetsTable, and(
        sql`${storiesTable.mediaUrl} = 'media:' || ${mediaAssetsTable.id}::text`,
        eq(mediaAssetsTable.ownerId, storiesTable.userId), isNull(mediaAssetsTable.matchId),
      ))
      .leftJoin(reelSafetyTable, eq(reelSafetyTable.mediaId, mediaAssetsTable.id))
      .where(storyConditions.length ? and(...storyConditions) : undefined)
      .orderBy(desc(storiesTable.createdAt), desc(storiesTable.id)).limit(offset + PAGE_SIZE),
  ]);
  const merged = [
    ...reelRows.map(row => ({
      id: row.id, kind: "reel" as const, authorId: row.authorId, authorName: row.authorName ?? "Deleted user",
      authorPhotos: row.authorPhotos, caption: row.caption, createdAt: row.createdAt, expiresAt: null,
      mediaReference: row.mediaId ? `media:${row.mediaId}` : null,
      mediaType: row.mediaId ? row.mediaType : null,
      status: row.mediaId ? safetyStatus(row.safety, "processing") : "deleted" as const,
    })),
    ...storyRows.map(row => {
      const expired = row.expiresAt.getTime() <= Date.now();
      return {
        id: row.id, kind: "story" as const, authorId: row.authorId, authorName: row.authorName ?? "Deleted user",
        authorPhotos: row.authorPhotos, caption: row.caption, createdAt: row.createdAt, expiresAt: row.expiresAt,
        mediaReference: row.mediaId ? `media:${row.mediaId}` : null,
        mediaType: row.mediaId ? row.mediaType : null,
        status: row.mediaReference?.startsWith("media:") && !row.mediaId ? "deleted" as const : expired ? "expired" as const : safetyStatus(row.safety, "published"),
      };
    }),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(offset, offset + PAGE_SIZE);

  const posts = await Promise.all(merged.map(async post => ({
    id: post.id,
    kind: post.kind,
    authorId: post.authorId,
    authorName: post.authorName,
    authorPhoto: await safePhoto(post.authorPhotos, post.authorId),
    caption: post.caption,
    mediaUrl: post.mediaReference,
    thumbnailUrl: null,
    mediaType: post.mediaType,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    expiresAt: post.expiresAt?.toISOString() ?? null,
  })));
  res.json(GetAdminPostsResponse.parse({ page, pageSize: PAGE_SIZE, total, posts }));
});

router.get("/vibeswipe/admin/posts/media/:mediaId", async (req, res): Promise<void> => {
  const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0] : req.params.mediaId;
  if (!UUID.test(mediaId)) { res.status(400).json({ error: "Invalid media id." }); return; }
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, mediaId), isNull(mediaAssetsTable.matchId),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "Post media not found." }); return; }
  const [reel] = await db.select({ id: reelsTable.id }).from(reelsTable).where(and(
    eq(reelsTable.mediaId, mediaId), eq(reelsTable.userId, asset.ownerId),
  )).limit(1);
  const [story] = await db.select({ id: storiesTable.id }).from(storiesTable).where(and(
    eq(storiesTable.mediaUrl, `media:${mediaId}`), eq(storiesTable.userId, asset.ownerId),
  )).limit(1);
  if (!reel && !story) { res.status(404).json({ error: "Post media not found." }); return; }
  try {
    const file = await storage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    await db.insert(adminAuditTable).values({ actorId: getAuth(req).userId!, action: "inspect_post_media", targetId: mediaId });
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", metadata.contentType ?? asset.contentType ?? "application/octet-stream");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    file.createReadStream().on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    }).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Post media not found." }); return; }
    throw error;
  }
});

router.post("/vibeswipe/admin/posts/:kind/:id/remove", async (req, res): Promise<void> => {
  const params = RemoveAdminPostParams.safeParse(req.params);
  const body = RemoveAdminPostBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.confirmation !== "REMOVE") {
    res.status(400).json({ error: 'Confirm removal by entering "REMOVE".' }); return;
  }
  const { kind, id } = params.data;
  const actorId = getAuth(req).userId!;
  const removed = await db.transaction(async tx => {
    const target = kind === "reel"
      ? await tx.select({ id: reelsTable.id }).from(reelsTable).where(eq(reelsTable.id, id)).for("update").limit(1)
      : await tx.select({ id: storiesTable.id }).from(storiesTable).where(eq(storiesTable.id, id)).for("update").limit(1);
    if (!target.length) return false;
    if (kind === "reel") await tx.delete(reelsTable).where(eq(reelsTable.id, id));
    else await tx.delete(storiesTable).where(eq(storiesTable.id, id));
    await tx.insert(adminAuditTable).values({ actorId, action: `remove_${kind}`, targetId: id });
    return true;
  });
  if (!removed) { res.status(404).json({ error: "Post not found." }); return; }
  res.json(RemoveAdminPostResponse.parse({ message: `${kind === "reel" ? "Reel" : "Story"} removed and recorded in the administrator audit log.` }));
});

export default router;
