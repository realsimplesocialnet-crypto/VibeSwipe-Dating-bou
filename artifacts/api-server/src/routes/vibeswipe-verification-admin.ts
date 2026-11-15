import { clerkClient, getAuth } from "@clerk/express";
import {
  GetAdminVerificationRequestsQueryParams, GetAdminVerificationRequestsResponse,
  GetAdminVerificationPhotoParams, ReviewFaceVerificationParams, ReviewFaceVerificationBody,
  ReviewFaceVerificationResponse,
} from "@workspace/api-zod";
import { db, profilesTable, mediaAssetsTable, faceVerificationSessionsTable as sessions, adminAuditTable } from "@workspace/db";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { createAdminGuard } from "../lib/admin-access";
import { canApproveVerification, promoteVerificationPhoto } from "../lib/face-verification-policy";
import { FaceVerificationError } from "../lib/luxand";
import { checkAdditionalPhoto } from "../lib/additional-photo-check";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
router.use("/vibeswipe/admin/verification-requests", createAdminGuard({
  userId: req => getAuth(req).userId,
  loadUser: id => clerkClient.users.getUser(id),
  email: () => process.env.VIBESWIPE_ADMIN_EMAIL ?? "",
}));

router.get("/vibeswipe/admin/verification-requests", async (req, res): Promise<void> => {
  const query = GetAdminVerificationRequestsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Choose a valid review status and page." }); return; }
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
  if (!asset) { res.status(404).json({ error: "This review photo is no longer available." }); return; }
  try {
    const file = await storage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 10 * 1024 * 1024) throw new Error("Photo too large");
    const [bytes] = await file.download();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(asset.contentType).send(bytes);
  } catch {
    res.status(404).json({ error: "The review photo could not be loaded. Please refresh." });
  }
});

router.post("/vibeswipe/admin/verification-requests/:requestId/decision", async (req, res): Promise<void> => {
  const params = ReviewFaceVerificationParams.safeParse(req.params);
  const body = ReviewFaceVerificationBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.confirmed) {
    res.status(400).json({ error: "Confirm whether to approve or reject this request." }); return;
  }
  const [request] = await db.select().from(sessions).where(eq(sessions.id, params.data.requestId)).limit(1);
  if (!request) { res.status(404).json({ error: "Verification request not found." }); return; }
  const actorId = getAuth(req).userId!;
  try {
    let gallerySnapshot: string[] | null = null;
    let checkedPhotos: string[] | null = null;
    if (body.data.decision === "approve") {
      if (request.status !== "awaiting_review" || !request.sealedPhoto || !request.referencePhoto) {
        throw new FaceVerificationError(409, "This request is no longer awaiting review.");
      }
      const [member] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.userId)).limit(1);
      if (!member) throw new FaceVerificationError(404, "Member not found.");
      gallerySnapshot = member.photos;
      checkedPhotos = [];
      // Do not grant a badge while unchecked pre-existing or recently added
      // gallery photos can still show a different person beside the main photo.
      for (const photo of promoteVerificationPhoto(member.photos, request.referencePhoto, request.sealedPhoto)) {
        checkedPhotos.push(await checkAdditionalPhoto(member.id, photo, request.sealedPhoto));
      }
    }
    const status = await db.transaction(async tx => {
      // All verification writers lock the profile first, then the session.
      const [profile] = await tx.select().from(profilesTable).where(eq(profilesTable.id, request.userId)).for("update").limit(1);
      const [current] = await tx.select().from(sessions).where(eq(sessions.id, request.id)).for("update").limit(1);
      if (!profile || !current) throw new FaceVerificationError(404, "This account or request no longer exists.");
      if (current.status !== "awaiting_review") throw new FaceVerificationError(409, "This request has already been decided or cancelled. Refresh the queue.");
      const approve = body.data.decision === "approve";
      if (approve) {
        if (!canApproveVerification({
          status: current.status, checked: !!current.checkedAt, sealedPhoto: current.sealedPhoto,
          expectedMainPhoto: current.mainPhoto, currentMainPhoto: profile.photos[0], suspended: profile.adminSuspended,
          deactivated: profile.deactivated, demo: profile.isDemo, alreadyVerified: profile.isVerified, createdAt: current.createdAt,
        })) throw new FaceVerificationError(409, "The account, main photo, or request changed. Ask the member to submit verification again.");
        const [asset] = await tx.select().from(mediaAssetsTable).where(and(
          eq(mediaAssetsTable.id, current.sealedPhoto!.slice(6)), eq(mediaAssetsTable.ownerId, profile.id),
          eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
        )).limit(1);
        if (!asset || !current.referencePhoto) throw new FaceVerificationError(409, "The checked photo is unavailable. The member must verify again.");
        if (!checkedPhotos || JSON.stringify(profile.photos) !== JSON.stringify(gallerySnapshot)) {
          throw new FaceVerificationError(409, "The gallery changed while photos were checked. Refresh and review again.");
        }
        await tx.update(profilesTable).set({
          isVerified: true, photos: checkedPhotos, updatedAt: new Date(),
        }).where(eq(profilesTable.id, profile.id));
      }
      const result = approve ? "approved" as const : "rejected" as const;
      await tx.update(sessions).set({
        status: result, reviewedAt: new Date(), reviewedBy: actorId,
        rejectionReason: approve ? null : body.data.reason?.trim() || "Your photo was not approved. Please choose a clear photo of yourself and try again.",
      }).where(eq(sessions.id, current.id));
      await tx.insert(adminAuditTable).values({ actorId, action: approve ? "verify" : "reject_verification", targetId: profile.id });
      return result;
    });
    res.json(ReviewFaceVerificationResponse.parse({
      status, message: status === "approved" ? "Approved. The checked photo is now the main profile photo and the blue tick is visible." : "Rejected. The member can see your reason and submit a new request.",
    }));
  } catch (error) {
    if (error instanceof FaceVerificationError) { res.status(error.status).json({ error: error.message }); return; }
    req.log.warn("Verification review could not be saved");
    res.status(503).json({ error: "The decision could not be saved. Refresh before trying again." });
  }
});
export default router;
