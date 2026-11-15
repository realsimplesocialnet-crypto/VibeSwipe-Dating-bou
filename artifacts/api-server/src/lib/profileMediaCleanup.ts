import { evictMediaPreview } from "./mediaPreview";
import {
  db,
  mediaAssetsTable,
  messagesTable,
  profileSetupDraftsTable,
  profilesTable,
  faceVerificationSessionsTable,
  reelsTable,
} from "@workspace/db";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const PROFILE_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;
const objectStorage = new ObjectStorageService();

async function deleteIfUnreferenced(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  mediaId: string,
  olderThan?: Date,
  expectedOwnerId?: string,
): Promise<boolean> {
  const [asset] = await tx
    .select()
    .from(mediaAssetsTable)
    .where(
      and(
        eq(mediaAssetsTable.id, mediaId),
        isNull(mediaAssetsTable.matchId),
        olderThan ? lt(mediaAssetsTable.createdAt, olderThan) : undefined,
        expectedOwnerId ? eq(mediaAssetsTable.ownerId, expectedOwnerId) : undefined,
      ),
    )
    .for("update")
    .limit(1);

  if (!asset) return false;

  const mediaReference = `media:${asset.id}`;
  // Queue photos are private, not public gallery references. Keep them until
  // review ends; active capture attempts also retain their selected source.
  const [verificationReference] = await tx.select({ id: faceVerificationSessionsTable.id })
    .from(faceVerificationSessionsTable).where(or(
      and(eq(faceVerificationSessionsTable.sealedPhoto, mediaReference), eq(faceVerificationSessionsTable.status, "awaiting_review")),
      and(eq(faceVerificationSessionsTable.referencePhoto, mediaReference),
        inArray(faceVerificationSessionsTable.status, ["pending", "processing"]),
        gt(faceVerificationSessionsTable.expiresAt, new Date())),
    )).limit(1);
  if (verificationReference) return false;
  const [profileReference] = await tx
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(
      or(
        eq(profilesTable.videoUrl, mediaReference),
        sql`${profilesTable.photos} @> ARRAY[${mediaReference}]::text[]`,
      ),
    )
    .limit(1);
  if (profileReference) return false;

  const [draftReference] = await tx
    .select({ userId: profileSetupDraftsTable.userId })
    .from(profileSetupDraftsTable)
    .where(
      sql`${profileSetupDraftsTable.data}::text LIKE ${`%${mediaReference}%`}`,
    )
    .limit(1);
  if (draftReference) return false;

  const [messageReference] = await tx
    .select({ id: messagesTable.id })
    .from(messagesTable)
    .where(eq(messagesTable.mediaReference, mediaReference))
    .limit(1);
  if (messageReference) return false;

  const [reelReference] = await tx
    .select({ id: reelsTable.id })
    .from(reelsTable)
    .where(eq(reelsTable.mediaId, asset.id))
    .limit(1);
  if (reelReference) return false;

  await objectStorage.deleteObjectEntity(asset.objectPath);
  evictMediaPreview(asset.id);
  await tx.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, asset.id));
  return true;
}

export async function removeUnreferencedProfileMedia(
  mediaId: string,
  expectedOwnerId?: string,
): Promise<boolean> {
  return db.transaction((tx) => deleteIfUnreferenced(tx, mediaId, undefined, expectedOwnerId));
}

export async function cleanupAbandonedProfileMedia(): Promise<number> {
  const olderThan = new Date(Date.now() - PROFILE_UPLOAD_MAX_AGE_MS);
  let deleted = 0;
  let cursor: { createdAt: Date; id: string } | undefined;

  while (true) {
    const candidates = await db
      .select({
        id: mediaAssetsTable.id,
        createdAt: mediaAssetsTable.createdAt,
      })
      .from(mediaAssetsTable)
      .where(
        and(
          isNull(mediaAssetsTable.matchId),
          lt(mediaAssetsTable.createdAt, olderThan),
          cursor
            ? or(
                gt(mediaAssetsTable.createdAt, cursor.createdAt),
                and(
                  eq(mediaAssetsTable.createdAt, cursor.createdAt),
                  gt(mediaAssetsTable.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(mediaAssetsTable.createdAt), asc(mediaAssetsTable.id))
      .limit(CLEANUP_BATCH_SIZE);
    if (candidates.length === 0) break;

    for (const candidate of candidates) {
      try {
        if (
          await db.transaction((tx) =>
            deleteIfUnreferenced(tx, candidate.id, olderThan),
          )
        ) {
          deleted += 1;
        }
      } catch (error) {
        // Keep the row so a later cleanup pass can retry the object deletion.
        logger.error(
          { err: error, mediaId: candidate.id },
          "Could not clean up abandoned profile media",
        );
      }
    }

    const lastCandidate = candidates[candidates.length - 1];
    cursor = { createdAt: lastCandidate.createdAt, id: lastCandidate.id };
    if (candidates.length < CLEANUP_BATCH_SIZE) break;
  }
  return deleted;
}
