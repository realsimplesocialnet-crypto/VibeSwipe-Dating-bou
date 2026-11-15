import { db, mediaAssetsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { FaceVerificationError, matchAdditionalProfilePhoto } from "./luxand";
import { ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();
const MAX_BYTES = 15 * 1024 * 1024;
const referencePattern = /^media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownedPhoto(userId: string, reference: string) {
  if (!referencePattern.test(reference)) throw new FaceVerificationError(400, "Upload your own profile photo first.");
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, reference.slice(6)), eq(mediaAssetsTable.ownerId, userId),
    eq(mediaAssetsTable.mediaType, "image"), isNull(mediaAssetsTable.matchId),
  )).limit(1);
  if (!asset) throw new FaceVerificationError(400, "Profile photos must belong to you.");
  return asset;
}

async function readPhoto(objectPath: string) {
  const file = await storage.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  if (!Number(metadata.size) || Number(metadata.size) > MAX_BYTES) throw new FaceVerificationError(422, "Choose an image smaller than 15 MB.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of file.createReadStream()) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BYTES) throw new FaceVerificationError(422, "Choose an image smaller than 15 MB.");
    chunks.push(bytes);
  }
  return { bytes: Buffer.concat(chunks), metadata };
}

/** Returns an immutable, owner-bound photo reference checked against this exact main photo. */
export async function checkAdditionalPhoto(userId: string, reference: string, verifiedMain: string | null): Promise<string> {
  const candidate = await ownedPhoto(userId, reference);
  if (!verifiedMain || reference === verifiedMain) return reference;
  try {
    const file = await storage.getObjectEntityFile(candidate.objectPath);
    const [metadata] = await file.getMetadata();
    // Only server-created sealed objects can carry trusted match evidence.
    if (candidate.objectPath.startsWith("/objects/verified-profile/") && metadata.metadata?.verifiedAgainst === verifiedMain) return reference;
    const main = await ownedPhoto(userId, verifiedMain);
    const [anchor, extra] = await Promise.all([readPhoto(main.objectPath), readPhoto(candidate.objectPath)]);
    await matchAdditionalProfilePhoto(anchor.bytes, extra.bytes, main.contentType, candidate.contentType);
    const sealedPath = await storage.storeVerifiedProfilePhoto(extra.bytes, userId, candidate.contentType, verifiedMain);
    try {
      const [sealed] = await db.insert(mediaAssetsTable).values({
        ownerId: userId, objectPath: sealedPath, mediaType: "image", contentType: candidate.contentType,
      }).returning({ id: mediaAssetsTable.id });
      return `media:${sealed.id}`;
    } catch (error) {
      await storage.deleteObjectEntity(sealedPath).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof FaceVerificationError) throw error;
    // Storage/provider failures must never silently accept the picture.
    throw new FaceVerificationError(503, "Photo checking could not be completed. Please try again.");
  }
}
