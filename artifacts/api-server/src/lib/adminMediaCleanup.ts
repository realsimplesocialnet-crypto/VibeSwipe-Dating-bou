import {
  adminMediaDeletionTable,
  db,
  mediaAssetsTable,
  messagesTable,
  profilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();

/**
 * Retry durable admin media deletions. A path is retained whenever the object
 * is still referenced by a profile or another message, so shared media is not
 * removed as a side effect of moderation.
 */
export async function cleanupAdminMediaDeletions(): Promise<number> {
  const queue = await db.select().from(adminMediaDeletionTable).limit(100);
  let deleted = 0;
  for (const queued of queue) {
    const [asset] = await db.select().from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.objectPath, queued.objectPath)).limit(1);
    const mediaId = queued.mediaId ?? asset?.id;
    const profiles = await db.select({
      photos: profilesTable.photos,
      videoUrl: profilesTable.videoUrl,
    }).from(profilesTable);
    const directProfileUse = profiles.some((profile) =>
      profile.photos.includes(queued.objectPath) || profile.videoUrl === queued.objectPath ||
      (mediaId && profile.photos.includes(`media:${mediaId}`)));
    if (directProfileUse) continue;
    if (mediaId) {
      const remainingMessages = await db.select({ id: messagesTable.id }).from(messagesTable)
        .where(eq(messagesTable.mediaReference, `media:${mediaId}`)).limit(1);
      if (remainingMessages.length) continue;
    }
    await storage.deleteObjectEntity(queued.objectPath);
    await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.objectPath, queued.objectPath));
    await db.delete(adminMediaDeletionTable).where(eq(adminMediaDeletionTable.objectPath, queued.objectPath));
    deleted += 1;
  }
  return deleted;
}
