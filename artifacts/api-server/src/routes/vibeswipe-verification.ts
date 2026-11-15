import { getAuth } from "@clerk/express";
import {
  CompleteFaceVerificationParams, CompleteFaceVerificationResponse,
  GetFaceVerificationStatusResponse, StartFaceVerificationBody, StartFaceVerificationResponse,
} from "@workspace/api-zod";
import { db, faceVerificationSessionsTable as sessions, mediaAssetsTable, profilesTable } from "@workspace/db";
import { and, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import express, { Router, type IRouter, type ErrorRequestHandler } from "express";
import { requireAuth } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { FaceVerificationError, isCameraJpeg, verifyLiveProfilePhoto } from "../lib/luxand";

const router: IRouter = Router();
const storage = new ObjectStorageService();
router.use(requireAuth);
router.use("/vibeswipe/verification", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const canVerifyPhoto = (reference?: string) => /^media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference ?? "");

router.get("/vibeswipe/verification", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, getAuth(req).userId!)).limit(1);
  if (!profile) { res.status(404).json({ error: "Complete your profile first." }); return; }
  const [latest] = await db.select().from(sessions).where(and(
    eq(sessions.userId, profile.id), inArray(sessions.status, ["awaiting_review", "approved", "rejected", "cancelled"]),
  )).orderBy(desc(sessions.createdAt)).limit(1);
  const reviewStatus = latest?.status === "approved" && !profile.isVerified ? "none" : latest?.status ?? "none";
  res.json(GetFaceVerificationStatusResponse.parse({
    available: Boolean(process.env.LUXAND_API_TOKEN) && !profile.deactivated && !profile.adminSuspended,
    verified: profile.isVerified,
    hasPhoto: canVerifyPhoto(profile.photos[0]),
    reviewStatus,
    rejectionReason: latest?.status === "rejected" || latest?.status === "cancelled" ? latest.rejectionReason : null,
  }));
});

router.post("/vibeswipe/verification/sessions", async (req, res): Promise<void> => {
  const body = StartFaceVerificationBody.safeParse(req.body);
  if (!body.success || body.data.consent !== true || !canVerifyPhoto(body.data.photoReference)) {
    res.status(400).json({ error: "Choose your verification photo and consent to sending it with a live selfie to Luxand.cloud." }); return;
  }
  if (!process.env.LUXAND_API_TOKEN) {
    res.status(503).json({ error: "Face verification is not available yet. Please try again later." }); return;
  }
  const userId = getAuth(req).userId!;
  const result = await db.transaction(async tx => {
    // Serializes session creation for this account, including across instances.
    const [profile] = await tx.select().from(profilesTable).where(eq(profilesTable.id, userId)).for("update").limit(1);
    if (!profile) return { error: "Upload and save your profile photo first.", status: 400 } as const;
    if (profile.deactivated || profile.adminSuspended || profile.isDemo) return { error: "This account cannot verify.", status: 409 } as const;
    if (profile.isVerified) return { error: "Your profile is already verified.", status: 409 } as const;
    const [waiting] = await tx.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.status, "awaiting_review"))).limit(1);
    if (waiting) return { error: "Your photo is already awaiting administrator approval.", status: 409 } as const;
    const [photo] = await tx.select({ id: mediaAssetsTable.id }).from(mediaAssetsTable).where(and(
      eq(mediaAssetsTable.id, body.data.photoReference.slice(6)), eq(mediaAssetsTable.ownerId, userId),
      eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
    )).limit(1);
    if (!photo) return { error: "Upload your own verification photo first. Chat attachments cannot be used.", status: 400 } as const;
    const [usage] = await tx.select({ total: count() }).from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.createdAt, new Date(Date.now() - 3_600_000))));
    if (usage.total >= 5) return { error: "You have used five verification attempts this hour. Please try again later.", status: 429 } as const;
    const [session] = await tx.insert(sessions).values({
      userId, mainPhoto: profile.photos[0] ?? "", referencePhoto: body.data.photoReference, expiresAt: new Date(Date.now() + 5 * 60_000),
    }).returning();
    return { session } as const;
  });
  if (result.status !== undefined) {
    if (result.status === 429) res.setHeader("Retry-After", "3600");
    res.status(result.status).json({ error: result.error }); return;
  }
  res.status(201).json(StartFaceVerificationResponse.parse({ sessionId: result.session.id, expiresAt: result.session.expiresAt }));
});

router.post("/vibeswipe/verification/sessions/:sessionId",
  express.raw({ type: "image/jpeg", limit: "5mb" }),
  async (req, res): Promise<void> => {
    const parsed = CompleteFaceVerificationParams.safeParse(req.params);
    if (!parsed.success || !Buffer.isBuffer(req.body) || !isCameraJpeg(req.body)) {
      res.status(400).json({ error: "Take a fresh camera selfie in JPEG format, up to 5 MB." }); return;
    }
    const userId = getAuth(req).userId!;
    // A compare-and-set makes a session single-use even under concurrent/replayed requests.
    const [session] = await db.update(sessions).set({ status: "processing" }).where(and(
      eq(sessions.id, parsed.data.sessionId), eq(sessions.userId, userId),
      eq(sessions.status, "pending"), gt(sessions.expiresAt, new Date()),
    )).returning();
    if (!session) { res.status(409).json({ error: "This verification session expired or was already used. Please start again." }); return; }
    let verifiedPhotoPath: string | null = null;
    let committed = false;
    try {
      const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
      if (!profile || profile.deactivated || profile.adminSuspended || (profile.photos[0] ?? "") !== session.mainPhoto) {
        throw new FaceVerificationError(409, "Your account or main photo changed. Please start verification again.");
      }
      if (!session.referencePhoto) throw new FaceVerificationError(409, "Choose a verification photo and start again.");
      // Only the current account's explicitly selected stored photo is accepted.
      // No client-supplied URL is fetched and no caller can choose another person's photo.
      const [asset] = await db.select().from(mediaAssetsTable).where(and(
        eq(mediaAssetsTable.id, session.referencePhoto.slice(6)), eq(mediaAssetsTable.ownerId, userId),
        eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
      )).limit(1);
      if (!asset) throw new FaceVerificationError(409, "Upload your verification photo again before verifying.");
      if (!["image/jpeg", "image/png", "image/bmp"].includes(asset.contentType)) {
        throw new FaceVerificationError(422, "Use a JPG or PNG verification photo, then start again.");
      }
      const file = await storage.getObjectEntityFile(asset.objectPath);
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) > 10 * 1024 * 1024) throw new FaceVerificationError(422, "Your main profile photo is too large. Upload a smaller photo and try again.");
      let total = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of file.createReadStream()) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > 10 * 1024 * 1024) throw new FaceVerificationError(422, "Your main profile photo is too large. Upload a smaller photo and try again.");
        chunks.push(bytes);
      }
      const checkedPhoto = Buffer.concat(chunks);
      await verifyLiveProfilePhoto(req.body, checkedPhoto, asset.contentType);
      // Signed upload URLs can remain valid briefly. A new server-only object and
      // reference prevent overwriting the verified photo through an old upload URL.
      const sealedPhotoPath = await storage.storeVerifiedProfilePhoto(checkedPhoto, userId, asset.contentType);
      verifiedPhotoPath = sealedPhotoPath;
      await db.transaction(async tx => {
        const [current] = await tx.select().from(profilesTable).where(eq(profilesTable.id, userId)).for("update").limit(1);
        if (!current || current.deactivated || current.adminSuspended || current.isVerified || (current.photos[0] ?? "") !== session.mainPhoto) {
          throw new FaceVerificationError(409, "Your account or main photo changed. Please start verification again.");
        }
        const [active] = await tx.select().from(sessions).where(eq(sessions.id, session.id)).for("update").limit(1);
        if (active?.status !== "processing") throw new FaceVerificationError(409, "This verification was cancelled. Please start again.");
        const [waiting] = await tx.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.status, "awaiting_review"))).limit(1);
        if (waiting) throw new FaceVerificationError(409, "A request is already awaiting administrator approval.");
        const [sealedAsset] = await tx.insert(mediaAssetsTable).values({
          ownerId: userId, objectPath: sealedPhotoPath, mediaType: "image", contentType: asset.contentType,
        }).returning({ id: mediaAssetsTable.id });
        // Passing camera checks never changes the public photo or grants a badge.
        await tx.update(sessions).set({ status: "awaiting_review", sealedPhoto: `media:${sealedAsset.id}`, checkedAt: new Date() }).where(eq(sessions.id, session.id));
      });
      committed = true;
    } catch (error) {
      await db.update(sessions).set({ status: "failed" }).where(and(eq(sessions.id, session.id), eq(sessions.status, "processing")));
      if (error instanceof FaceVerificationError) {
        res.status(error.status).json({ error: error.message }); return;
      }
      // Never log the selfie, profile photo, provider response, or token.
      req.log.warn("Face verification could not complete");
      res.status(503).json({ error: "Verification could not complete. Please try again." });
      return;
    } finally {
      if (verifiedPhotoPath && !committed) {
        await storage.deleteObjectEntity(verifiedPhotoPath).catch(() => {
          req.log.warn("Could not remove an uncommitted verification photo");
        });
      }
    }
    res.json(CompleteFaceVerificationResponse.parse({ verified: false, reviewStatus: "awaiting_review" }));
  },
);
const uploadError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") { res.status(413).json({ error: "Your selfie must be smaller than 5 MB." }); return; }
  next(error);
};
router.use(uploadError);
export default router;
