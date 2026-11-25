import { getAuth } from "@clerk/express";
import {
  GetAdminVerificationRequestsQueryParams, GetAdminVerificationRequestsResponse,
  GetAdminVerificationPhotoParams,
} from "@workspace/api-zod";
import { db, profilesTable, mediaAssetsTable, faceVerificationSessionsTable as sessions } from "@workspace/db";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { createAdminGuard } from "../lib/admin-access";
import { getAppClerkClient } from "../lib/clerk-client";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
router.use("/vibeswipe/admin/verification-requests", createAdminGuard({
  userId: req => getAuth(req).userId,
  loadUser: id => getAppClerkClient().users.getUser(id),
  email: () => process.env.VIBESWIPE_ADMIN_EMAIL ?? "",
}));
router.use("/vibeswipe/admin/verification-requests", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

// Read-only history: verification is decided by server checks, never by an administrator.
router.get("/vibeswipe/admin/verification-requests", async (req, res): Promise<void> => {
  const query = GetAdminVerificationRequestsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Choose a valid verification status and page." }); return; }
  const page = Math.min(query.data.page ?? 1, 100_000);
  const status = query.data.status ?? "awaiting_review";
  const where = eq(sessions.status, status);
  const [total] = await db.select({ total: count() }).from(sessions).where(where);
  const rows = await db.select({
    request: sessions, name: profilesTable.name, age: profilesTable.age, assetId: mediaAssetsTable.id,
  }).from(sessions).innerJoin(profilesTable, eq(profilesTable.id, sessions.userId))
    .leftJoin(mediaAssetsTable, and(
      sql`${sessions.sealedPhoto} = 'media:' || ${mediaAssetsTable.id}::text`,
      eq(mediaAssetsTable.ownerId, sessions.userId), isNull(mediaAssetsTable.matchId),
    )).where(where).orderBy(desc(sessions.createdAt)).limit(25).offset((page - 1) * 25);
  res.json(GetAdminVerificationRequestsResponse.parse({
    page, pageSize: 25, total: total.total,
    requests: rows.map(({ request, name, age, assetId }) => ({
      id: request.id, userId: request.userId, name, age, status: request.status,
      submittedAt: request.checkedAt ?? request.createdAt, reviewedAt: request.reviewedAt,
      rejectionReason: request.rejectionReason, photoAvailable: !!assetId,
    })),
  }));
});

router.get("/vibeswipe/admin/verification-requests/:requestId/photo", async (req, res): Promise<void> => {
  const params = GetAdminVerificationPhotoParams.safeParse(req.params);
  if (!params.success) { res.status(404).json({ error: "Photo not found." }); return; }
  const [request] = await db.select().from(sessions).where(eq(sessions.id, params.data.requestId)).limit(1);
  if (!request?.sealedPhoto) { res.status(404).json({ error: "Photo not found." }); return; }
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, request.sealedPhoto.slice(6)), eq(mediaAssetsTable.ownerId, request.userId),
    eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "This verification photo is no longer available." }); return; }
  try {
    const file = await storage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 10 * 1024 * 1024) throw new Error("Photo too large");
    const [bytes] = await file.download();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(asset.contentType).send(bytes);
  } catch {
    res.status(404).json({ error: "The verification photo could not be loaded. Please refresh." });
  }
});

// Older open tabs must not retain a working manual approval or rejection action.
router.post("/vibeswipe/admin/verification-requests/:requestId/decision", (_req, res): void => {
  res.status(410).json({ error: "Manual verification decisions are disabled. Verification is automatic; refresh this page." });
});
export default router;
