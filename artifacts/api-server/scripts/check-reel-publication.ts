/** Real DB + private storage integration check. Creates and removes only its own fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, pool, profilesTable, mediaAssetsTable, reelsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ObjectStorageService } from "../src/lib/objectStorage";
import { processSafeReel, reelIsApproved } from "../src/lib/reel-safety";
import { visibleReelCondition } from "../src/lib/reels-visibility";
import { ReelSafetyError } from "../src/lib/reel-safety-policy";

const owner = `reel-safety-test-${randomUUID()}`;
const rawPath = `/objects/uploads/${randomUUID()}`;
const files = new Set([rawPath]);
const storage = new ObjectStorageService();
const directory = await mkdtemp(join(tmpdir(), "reel-publish-selftest-"));
try {
  const file = join(directory, "safe.mp4");
  const generated = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=240x320:r=1:d=185", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", file]);
  assert.equal(generated.status, 0, generated.stderr?.toString());
  await db.insert(profilesTable).values({ id: owner, name: "Safety test fixture", age: 30, gender: "Man", lookingFor: "Everyone", isDemo: true, incognito: true });
  await storage.storePrivateFile(rawPath, file, owner, "video/mp4");
  const [asset] = await db.insert(mediaAssetsTable).values({ ownerId: owner, objectPath: rawPath, mediaType: "video", contentType: "video/mp4" }).returning();
  const [reel] = await db.insert(reelsTable).values({ userId: owner, mediaId: asset.id, caption: "Automatic safety integration fixture" }).returning();
  const visible = (viewer: string) => db.select({ id: reelsTable.id }).from(reelsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
    .where(and(eq(reelsTable.id, reel.id), visibleReelCondition(viewer)));
  assert.equal(await reelIsApproved(asset), false);
  assert.equal((await visible(owner)).length, 0, "Even the author cannot publish an unchecked Reel");
  const result = await processSafeReel(asset);
  assert.ok(result.duration >= 184, "Keep the complete 3-minute-plus video");
  const [checked] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, asset.id));
  files.add(checked.objectPath);
  assert.notEqual(checked.objectPath, rawPath, "Publish a separate immutable checked copy");
  assert.equal(await reelIsApproved(checked), true);
  assert.equal(await reelIsApproved({ ...checked, objectPath: rawPath }), false, "An old writable path cannot reuse approval");
  assert.equal((await visible(owner)).length, 1);
  assert.deepEqual(await processSafeReel(checked), result, "Retries reuse approval without checking a changed URL");
  assert.deepEqual(await processSafeReel(asset), result, "A stale upload snapshot cannot invalidate another server's completed approval");
  const stored = await storage.getObjectEntityFile(checked.objectPath);
  const [metadata] = await stored.getMetadata();
  assert.ok(Number(metadata.size) > 0, "Checked copy can be read from private storage");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Public visibility is tested in this transaction only; fixture stays incognito to everyone else.
    await client.query("UPDATE vibeswipe_profiles SET incognito=false WHERE id=$1", [owner]);
    const query = visible("another-safety-test-member").toSQL();
    assert.equal((await client.query(query.sql, query.params)).rowCount, 1);
    await client.query("UPDATE vibeswipe_reel_safety SET status='rejected' WHERE media_id=$1", [asset.id]);
    assert.equal((await client.query(query.sql, query.params)).rowCount, 0);
    await client.query("UPDATE vibeswipe_reel_safety SET status='error' WHERE media_id=$1", [asset.id]);
    assert.equal((await client.query(query.sql, query.params)).rowCount, 0);
    await client.query("ROLLBACK");
  } finally { await client.query("ROLLBACK").catch(() => undefined); client.release(); }
  await pool.query("UPDATE vibeswipe_reel_safety SET status='rejected' WHERE media_id=$1", [asset.id]);
  await assert.rejects(processSafeReel(checked), error => error instanceof ReelSafetyError && error.status === 422);
  assert.equal(await reelIsApproved(checked), false);
  console.log(JSON.stringify({ passed: true, fullLengthSeconds: result.duration, uncheckedHidden: true, approvedVisible: true, rejectedHidden: true, failuresHidden: true, sealedPrivateCopyReadable: true }));
} finally {
  const assets = await db.select({ path: mediaAssetsTable.objectPath }).from(mediaAssetsTable).where(eq(mediaAssetsTable.ownerId, owner));
  for (const asset of assets) files.add(asset.path);
  await db.delete(profilesTable).where(eq(profilesTable.id, owner));
  await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.ownerId, owner));
  for (const path of files) await storage.deleteObjectEntity(path).catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
  await pool.end();
}
