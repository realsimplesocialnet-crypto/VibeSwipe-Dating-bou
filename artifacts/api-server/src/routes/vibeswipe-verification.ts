import { getAuth } from "@clerk/express";
import {
  CompleteFaceVerificationParams, CompleteFaceVerificationResponse,
  GetFaceVerificationStatusResponse, StartFaceVerificationBody, StartFaceVerificationResponse,
} from "@workspace/api-zod";
import { db, faceVerificationSessionsTable as sessions, mediaAssetsTable, profilesTable } from "@workspace/db";
import { and, count, eq, gt, isNull } from "drizzle-orm";
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
const canVerifyPhoto = (reference?: string) => /^media:[0-9a-f-]{36}$/i.test(reference ?? "");

router.get("/vibeswipe/verification", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, getAuth(req).userId!)).limit(1);
  if (!profile) { res.status(404).json({ error: "Complete your profile first." }); return; }
  res.json(GetFaceVerificationStatusResponse.parse({
    available: Boolean(process.env.LUXAND_API_TOKEN) && !profile.deactivated && !profile.adminSuspended,
    verified: profile.isVerified,
    hasPhoto: canVerifyPhoto(profile.photos[0]),
  }));
});

router.post("/vibeswipe/verification/sessions", async (req, res): Promise<void> => {
  const body = StartFaceVerificationBody.safeParse(req.body);
  if (!body.success || body.data.consent !== true) {
    res.status(400).json({ error: "Please consent to sending your selfie and main photo to Luxand.cloud for face verification." }); return;
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
    if (!canVerifyPhoto(profile.photos[0])) return { error: "Upload and save a clear main profile photo first.", status: 400 } as const;
    const [usage] = await tx.select({ total: count() }).from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.createdAt, new Date(Date.now() - 3_600_000))));
    if (usage.total >= 5) return { error: "You have used five verification attempts this hour. Please try again later.", status: 429 } as const;
    const [session] = await tx.insert(sessions).values({
      userId, mainPhoto: profile.photos[0], expiresAt: new Date(Date.now() + 5 * 60_000),
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
      if (!profile || profile.deactivated || profile.adminSuspended || profile.photos[0] !== session.mainPhoto) {
        throw new FaceVerificationError(409, "Your account or main photo changed. Please start verification again.");
      }
      // Only the current account's stored main photo is accepted as the reference.
      // No client-supplied URL is fetched and no caller can choose another person's photo.
      const [asset] = await db.select().from(mediaAssetsTable).where(and(
        eq(mediaAssetsTable.id, session.mainPhoto.slice(6)), eq(mediaAssetsTable.ownerId, userId),
        eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
      )).limit(1);
      if (!asset) throw new FaceVerificationError(409, "Save your main profile photo again before verifying.");
      if (!["image/jpeg", "image/png", "image/bmp"].includes(asset.contentType)) {
        throw new FaceVerificationError(422, "Use a JPG or PNG main profile photo, then start verification again.");
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
        if (!current || current.deactivated || current.adminSuspended || current.photos[0] !== session.mainPhoto) {
          throw new FaceVerificationError(409, "Your account or main photo changed. Please start verification again.");
        }
        const [sealedAsset] = await tx.insert(mediaAssetsTable).values({
          ownerId: userId, objectPath: sealedPhotoPath, mediaType: "image", contentType: asset.contentType,
        }).returning({ id: mediaAssetsTable.id });
        await tx.update(profilesTable).set({
          isVerified: true, photos: [`media:${sealedAsset.id}`, ...current.photos.slice(1)], updatedAt: new Date(),
        }).where(eq(profilesTable.id, userId));
        await tx.update(sessions).set({ status: "passed" }).where(eq(sessions.id, session.id));
      });
      committed = true;
    } catch (error) {
      await db.update(sessions).set({ status: "failed" }).where(eq(sessions.id, session.id));
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
    res.json(CompleteFaceVerificationResponse.parse({ verified: true }));
  },
);
const uploadError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") { res.status(413).json({ error: "Your selfie must be smaller than 5 MB." }); return; }
  next(error);
};
router.use(uploadError);
export default router;
