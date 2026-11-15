import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cleanReelCaption, decodeReelCursor, encodeReelCursor, reelAssetProblem, reelLocation } from "../src/lib/reel-cursor.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const reels = read("../src/routes/vibeswipe-reels.ts");
const visibility = read("../src/lib/reels-visibility.ts");
const media = read("../src/routes/vibeswipe.ts");
const cleanup = read("../src/lib/profileMediaCleanup.ts");

test("feed cursors round-trip and reject tampering", () => {
  const at = new Date("2025-03-04T05:06:07.089Z");
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(decodeReelCursor(encodeReelCursor(at, id)), { createdAt: at, id });
  assert.equal(decodeReelCursor(Buffer.from("nope|x").toString("base64url")), null);
  assert.equal(decodeReelCursor("%%%"), null);
});

test("only the caller's own processed, unattached video can be published", () => {
  const ok = { ownerId: "me", mediaType: "video", contentType: "video/mp4", durationSeconds: 12.4, matchId: null };
  assert.equal(reelAssetProblem(ok, "me"), null);
  assert.match(reelAssetProblem(ok, "someone-else")!, /not available/);
  assert.match(reelAssetProblem({ ...ok, matchId: "chat" }, "me")!, /not available/);
  assert.match(reelAssetProblem({ ...ok, mediaType: "image" }, "me")!, /videos/);
  assert.match(reelAssetProblem({ ...ok, contentType: "video/quicktime", durationSeconds: null }, "me")!, /processing/);
  assert.match(reelAssetProblem(undefined, "me")!, /not available/);
});

test("captions and locations are normalized", () => {
  assert.equal(cleanReelCaption("  hello \n  there "), "hello there");
  assert.equal(cleanReelCaption("x".repeat(400)).length, 300);
  assert.equal(reelLocation(["Lagos", "", null, "Nigeria"]), "Lagos, Nigeria");
});

test("feed visibility excludes blocks, deactivated, suspended and deleted creators", () => {
  for (const rule of ["deactivated, false", "adminSuspended, false", "incognito, false", "blocksTable", "adminDeletedUsersTable"]) {
    assert.ok(visibility.includes(rule), rule);
  }
});

test("writes are owner scoped and saves are private to the signed-in account", () => {
  assert.match(reels, /delete\(reelsTable\)\s*\.where\(and\(eq\(reelsTable\.id, params\.data\.reelId\), eq\(reelsTable\.userId, userId\)\)\)/);
  assert.match(reels, /target\.authorId !== userId && target\.ownerId !== userId/);
  assert.match(reels, /eq\(reelSavesTable\.userId, viewerId\)/);
  assert.match(reels, /router\.use\("\/vibeswipe\/reels", requireAuth\)/);
});

test("Reel videos stream only while the Reel is visible and survive upload cleanup", () => {
  assert.match(media, /!\(await canViewReelMedia\(userId, asset\.id\)\)/);
  assert.match(cleanup, /eq\(reelsTable\.mediaId, asset\.id\)/);
});
