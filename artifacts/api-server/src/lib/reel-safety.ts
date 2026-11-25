import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { pool } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { transcodeReelVideo, type TranscodedProfileVideo } from "./profileVideoTranscoder";
import { checkReelImage, checkReelVideo } from "./reel-safety-checker";
import { ReelSafetyError, REEL_SAFETY_VERSION } from "./reel-safety-policy";
import { AsyncSemaphore } from "./async-semaphore";
import { logger } from "./logger";
import { uploadedMediaFileMatches } from "./media-file-validation";

const storage = new ObjectStorageService();
const safetyCheckSlots = new AsyncSemaphore(2);
type Asset = { id: string; ownerId: string; objectPath: string; contentType?: string };
type Receipt = { status: string; checked_path: string; result: TranscodedProfileVideo | null };

export async function reelIsApproved(asset: Asset): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM vibeswipe_reel_safety
    WHERE media_id=$1 AND status='approved' AND version=$2 AND checked_path=$3`, [asset.id, REEL_SAFETY_VERSION, asset.objectPath]);
  return result.rowCount === 1;
}

export async function processSafeReel(asset: Asset): Promise<TranscodedProfileVideo> {
  const releaseSlot = await safetyCheckSlots.acquire();
  const client = await pool.connect().catch(error => { releaseSlot(); throw error; });
  let locked = false;
  let sealed: string | undefined;
  let recorded = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(637219, hashtext($1)) AS locked", [asset.id]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) throw new ReelSafetyError("This video is already being checked. Please try again shortly.");
    // A different server may have sealed the upload while this request waited.
    // Refresh under the per-media lock before touching its approval receipt.
    const latest = await client.query<Asset>(`SELECT id,owner_id AS "ownerId",object_path AS "objectPath",content_type AS "contentType"
      FROM vibeswipe_media_assets WHERE id=$1`, [asset.id]);
    if (!latest.rows[0]) throw new ReelSafetyError("This video upload is no longer available.", 404);
    if (latest.rows[0].ownerId !== asset.ownerId) throw new ReelSafetyError("This upload is not owned by your account.", 403);
    asset = latest.rows[0];
    const previous = await client.query<Receipt>(`SELECT status,checked_path,result FROM vibeswipe_reel_safety WHERE media_id=$1 AND version=$2`, [asset.id, REEL_SAFETY_VERSION]);
    const receipt = previous.rows[0];
    if (receipt?.checked_path === asset.objectPath) {
      if (receipt.status === "approved" && receipt.result) return receipt.result;
      if (receipt.status === "rejected") throw new ReelSafetyError("This video did not pass the safety check. Please upload a different video.", 422);
    }
    await client.query(`INSERT INTO vibeswipe_reel_safety(media_id,status,version,checked_path,checked_at)
      VALUES($1,'checking',$2,$3,now()) ON CONFLICT(media_id) DO UPDATE SET
      status='checking',version=$2,checked_path=$3,checked_at=now(),result=NULL`, [asset.id, REEL_SAFETY_VERSION, asset.objectPath]);
    recorded = true;
    const file = await storage.getObjectEntityFile(asset.objectPath);
    if (!asset.contentType || !await uploadedMediaFileMatches(file, "video", asset.contentType)) {
      throw new ReelSafetyError("This upload does not match an MP4 or MOV video.", 415);
    }
    const video = await transcodeReelVideo(file, async (path, result) => {
      const report = await checkReelVideo(path, result.duration);
      sealed = `/objects/checked-reels/${randomUUID()}`;
      await storage.storePrivateFile(sealed, path, asset.ownerId, "video/mp4");
      await client.query("BEGIN");
      try {
        const changed = await client.query(`UPDATE vibeswipe_media_assets SET object_path=$1,content_type='video/mp4',duration_seconds=$2
          WHERE id=$3 AND owner_id=$4 AND object_path=$5 RETURNING id`, [sealed, result.duration, asset.id, asset.ownerId, asset.objectPath]);
        if (changed.rowCount !== 1) throw new Error("Reel upload changed during safety checking");
        await client.query(`UPDATE vibeswipe_reel_safety SET status='approved',checked_path=$1,result=$2,checked_at=now() WHERE media_id=$3`,
          [sealed, JSON.stringify(result), asset.id]);
        await client.query("COMMIT");
        logger.info({ mediaId: asset.id, frames: report.sampledFrames, uniqueFrames: report.uniqueFrames }, "Reel passed automatic safety checks");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    });
    sealed = undefined; // The checked copy is now referenced by the asset.
    // Expiring client upload URLs still target the old, no-longer-used object.
    await storage.deleteObjectEntity(asset.objectPath).catch(error => logger.warn({ err: error, mediaId: asset.id }, "Could not remove original checked Reel upload"));
    return video;
  } catch (error) {
    if (sealed) {
      // A lost COMMIT response is ambiguous: never delete a possibly committed
      // video. Retaining an orphan privately is safer than losing a user's post.
      const referenced = await pool.query("SELECT 1 FROM vibeswipe_media_assets WHERE object_path=$1", [sealed])
        .then(result => result.rowCount !== 0).catch(() => true);
      if (!referenced) await storage.deleteObjectEntity(sealed).catch(() => undefined);
    }
    if (recorded) await client.query(`UPDATE vibeswipe_reel_safety SET status=$1,checked_at=now() WHERE media_id=$2 AND status='checking'`,
      [error instanceof ReelSafetyError && error.status === 422 ? "rejected" : "error", asset.id]).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(637219, hashtext($1))", [asset.id]).catch(() => undefined);
    client.release();
    releaseSlot();
  }
}

function normalizeSlideImage(source: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-v", "error", "-nostdin", "-threads", "1", "-i", source, "-frames:v", "1",
      "-vf", "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease",
      "-threads", "1", "-q:v", "3", output,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", data => { errors = `${errors}${data}`.slice(-2000); });
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Reel slide conversion failed: ${errors}`));
    });
  });
}

/** Normalize, safety-check, and seal a photo before it can be used in a public Reel. */
export async function processSafeReelImage(asset: Asset): Promise<void> {
  const releaseSlot = await safetyCheckSlots.acquire();
  const client = await pool.connect().catch(error => { releaseSlot(); throw error; });
  let locked = false;
  let sealed: string | undefined;
  let recorded = false;
  let tempDirectory: string | undefined;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(637219, hashtext($1)) AS locked", [asset.id]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) throw new ReelSafetyError("This Reel photo is already being checked. Please try again shortly.");
    const latest = await client.query<Asset>(`SELECT id,owner_id AS "ownerId",object_path AS "objectPath",content_type AS "contentType"
      FROM vibeswipe_media_assets WHERE id=$1`, [asset.id]);
    if (!latest.rows[0]) throw new ReelSafetyError("This photo upload is no longer available.", 404);
    if (latest.rows[0].ownerId !== asset.ownerId) throw new ReelSafetyError("This upload is not owned by your account.", 403);
    asset = latest.rows[0];
    const previous = await client.query<Receipt>(`SELECT status,checked_path,result FROM vibeswipe_reel_safety WHERE media_id=$1 AND version=$2`, [asset.id, REEL_SAFETY_VERSION]);
    const receipt = previous.rows[0];
    if (receipt?.checked_path === asset.objectPath && receipt.status === "approved") return;
    if (receipt?.checked_path === asset.objectPath && receipt.status === "rejected") {
      throw new ReelSafetyError("This photo did not pass the safety check. Please upload a different photo.", 422);
    }

    await client.query(`INSERT INTO vibeswipe_reel_safety(media_id,status,version,checked_path,checked_at)
      VALUES($1,'checking',$2,$3,now()) ON CONFLICT(media_id) DO UPDATE SET
      status='checking',version=$2,checked_path=$3,checked_at=now(),result=NULL`, [asset.id, REEL_SAFETY_VERSION, asset.objectPath]);
    recorded = true;
    tempDirectory = await mkdtemp(join(tmpdir(), "myage-reel-slide-"));
    const sourcePath = join(tempDirectory, "source");
    const normalizedPath = join(tempDirectory, "slide.jpg");
    const original = await storage.getObjectEntityFile(asset.objectPath);
    if (!asset.contentType || !await uploadedMediaFileMatches(original, "image", asset.contentType)) {
      throw new ReelSafetyError("This upload does not match a supported photo.", 415);
    }
    await pipeline(original.createReadStream(), createWriteStream(sourcePath));
    await normalizeSlideImage(sourcePath, normalizedPath);
    const report = await checkReelImage(normalizedPath);
    sealed = `/objects/checked-reel-slides/${randomUUID()}`;
    await storage.storePrivateFile(sealed, normalizedPath, asset.ownerId, "image/jpeg");
    await client.query("BEGIN");
    try {
      const changed = await client.query(`UPDATE vibeswipe_media_assets SET object_path=$1,content_type='image/jpeg'
        WHERE id=$2 AND owner_id=$3 AND object_path=$4 RETURNING id`,
      [sealed, asset.id, asset.ownerId, asset.objectPath]);
      if (changed.rowCount !== 1) throw new Error("Reel photo upload changed during safety checking");
      await client.query(`UPDATE vibeswipe_reel_safety SET status='approved',checked_path=$1,result=$2,checked_at=now() WHERE media_id=$3`,
        [sealed, JSON.stringify(report), asset.id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    sealed = undefined;
    await storage.deleteObjectEntity(asset.objectPath).catch(error => logger.warn({ err: error, mediaId: asset.id }, "Could not remove original checked Reel slide"));
  } catch (error) {
    if (sealed) {
      const referenced = await pool.query("SELECT 1 FROM vibeswipe_media_assets WHERE object_path=$1", [sealed])
        .then(result => result.rowCount !== 0).catch(() => true);
      if (!referenced) await storage.deleteObjectEntity(sealed).catch(() => undefined);
    }
    if (recorded) await client.query(`UPDATE vibeswipe_reel_safety SET status=$1,checked_at=now() WHERE media_id=$2 AND status='checking'`,
      [error instanceof ReelSafetyError && error.status === 422 ? "rejected" : "error", asset.id]).catch(() => undefined);
    throw error;
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    if (locked) await client.query("SELECT pg_advisory_unlock(637219, hashtext($1))", [asset.id]).catch(() => undefined);
    client.release();
    releaseSlot();
  }
}

let backfillRunning = false;
export async function checkExistingReels(): Promise<void> {
  if (backfillRunning || safetyCheckSlots.busy) return;
  backfillRunning = true;
  try {
    const rows = await pool.query<{ id: string; ownerId: string; objectPath: string; contentType: string }>(`
      SELECT m.id,m.owner_id AS "ownerId",m.object_path AS "objectPath",m.content_type AS "contentType"
      FROM vibeswipe_reels r JOIN vibeswipe_media_assets m ON m.id=r.media_id
      LEFT JOIN vibeswipe_reel_safety s ON s.media_id=m.id
      WHERE s.media_id IS NULL OR s.version<>$1 OR s.checked_path<>m.object_path
        OR (s.status IN ('error','checking') AND s.checked_at<now()-interval '15 minutes')
      ORDER BY r.created_at LIMIT 3`, [REEL_SAFETY_VERSION]);
    for (const asset of rows.rows) {
      try { await processSafeReel(asset); }
      catch (error) { logger.warn({ err: error, mediaId: asset.id }, "Existing Reel remains unpublished after safety check"); }
    }
  } catch (error) { logger.error({ err: error }, "Could not run existing Reel safety checks"); }
  finally { backfillRunning = false; }
}
