import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cleanReelCaption, decodeReelCursor, encodeReelCursor, reelAssetProblem, reelLocation } from "../src/lib/reel-cursor.ts";
import { reelSearchTerms } from "../src/lib/reel-search.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const reels = read("../src/routes/vibeswipe-reels.ts");
const visibility = read("../src/lib/reels-visibility.ts");
const schema = read("../src/lib/reels-schema.ts");
const media = read("../src/routes/vibeswipe.ts");
const cleanup = read("../src/lib/profileMediaCleanup.ts");
const reelTable = read("../../../lib/db/src/schema/vibeswipe-reels.ts");
const apiSpec = read("../../../lib/api-spec/openapi.yaml");
const shareSheet = read("../../vibeswipe-web/src/components/reels/reel-share-sheet.tsx");
const reelSlide = read("../../vibeswipe-web/src/components/reels/reel-slide.tsx");
const nativeChat = read("../../vibeswipe/app/chat/[matchId].tsx");
const nativeReel = read("../../vibeswipe/app/reels/[reelId].tsx");

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

test("Reel search extracts useful terms from topics and place names", () => {
  assert.deepEqual(reelSearchTerms("police in Port Harcourt"), ["police", "port", "harcourt"]);
  assert.deepEqual(reelSearchTerms("what is my future job?"), ["future", "job"]);
  assert.deepEqual(reelSearchTerms("東京 police"), ["東京", "police"]);
  assert.match(reels, /to_tsvector\('english', coalesce\(\$\{reelsTable\.caption\}, ''\)\)/);
  assert.match(reels, /creatorLocation/);
  assert.match(reels, /profilesTable\.city/);
  assert.match(reels, /profilesTable\.state/);
  assert.match(reels, /profilesTable\.country/);
  for (const field of ["city", "state", "country"]) {
    assert.match(schema, new RegExp(`vibeswipe_profiles_${field}_search_idx`));
  }
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

test("Reel playback counts persist, return immediately, and exclude creator self-views", () => {
  assert.match(reels, /router\.post\("\/vibeswipe\/reels\/:reelId\/views"/);
  assert.match(reels, /if \(reel\.userId === viewerId\)/);
  assert.match(reelTable, /export const reelViewsTable = pgTable\("vibeswipe_reel_views"/);
  assert.match(reelTable, /primaryKey\(\{ name: "vibeswipe_reel_views_pk", columns: \[t\.reelId, t\.viewerId\] \}\)/);
  assert.match(reelTable, /viewerId: text\("viewer_id"\)\.notNull\(\)\.references\(\(\) => profilesTable\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(reels, /\.insert\(reelViewsTable\)\s*\.values\(\{ reelId: params\.data\.reelId, viewerId \}\)\s*\.onConflictDoNothing\(\)/);
  assert.match(reels, /viewCount: sql<number>`\(SELECT count\(\*\)::int FROM \$\{reelViewsTable\} WHERE \$\{reelViewsTable\.reelId\} = \$\{reelsTable\.id\}\)`/);
  assert.match(reels, /count\(\*\)::int[\s\S]*?\.from\(reelViewsTable\)\.where\(eq\(reelViewsTable\.reelId, params\.data\.reelId\)\)/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0/);
});

test("Reel shares count one persisted interaction per account and preserve the old aggregate", () => {
  assert.match(apiSpec, /\/vibeswipe\/reels\/\{reelId\}\/shares:/);
  assert.match(apiSpec, /shareCount: \{ type: integer, minimum: 0 \}/);
  assert.match(reelTable, /shareCount: integer\("share_count"\)\.notNull\(\)\.default\(0\)/);
  assert.match(reelTable, /export const reelSharesTable = pgTable\("vibeswipe_reel_shares"/);
  assert.match(reelTable, /primaryKey\(\{ name: "vibeswipe_reel_shares_pk", columns: \[t\.reelId, t\.userId\] \}\)/);
  assert.match(reels, /router\.post\("\/vibeswipe\/reels\/:reelId\/shares"/);
  assert.match(reels, /\.insert\(reelSharesTable\)[\s\S]*?\.onConflictDoNothing\(\)/);
  assert.match(reels, /shareCount: sql<number>`\$\{reelsTable\.shareCount\} \+ \(SELECT count\(\*\)::int FROM \$\{reelSharesTable\}/);
  assert.match(reels, /shareCount: Number\(updated\.shareCount\)/);
  assert.match(reels, /shareCount: Number\(row\.shareCount\)/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vibeswipe_reel_shares/);
});

test("like and save endpoints return counts from unique persisted rows", () => {
  assert.match(reelTable, /vibeswipe_reel_likes_pk[\s\S]*columns: \[t\.reelId, t\.userId\]/);
  assert.match(reelTable, /vibeswipe_reel_saves_pk[\s\S]*columns: \[t\.reelId, t\.userId\]/);
  assert.match(reels, /saveCount: sql<number>`\(SELECT count\(\*\)::int FROM \$\{reelSavesTable\}/);
  assert.match(reels, /saveCount: Number\(row\.saveCount\)/);
  assert.match(reels, /saveCount: Number\(row\.saveCount\), shareCount: Number\(row\.shareCount\)/);
  assert.match(apiSpec, /saveCount: \{ type: integer, minimum: 0 \}/);
  assert.match(apiSpec, /required: \[likedByMe, savedByMe, likeCount, commentCount, saveCount, shareCount\]/);
});

test("comments remain repeatable per account and Reel counts include the full comment total", () => {
  assert.match(reelTable, /export const reelCommentsTable = pgTable\("vibeswipe_reel_comments", \{\s+id: uuid\("id"\)\.defaultRandom\(\)\.primaryKey\(\)/);
  assert.doesNotMatch(reelTable.match(/export const reelCommentsTable = pgTable\([\s\S]*?\n\}\);/)?.[0] ?? "", /unique|primaryKey\(\{[^}]*userId/);
  assert.match(reels, /commentCount: sql<number>`\(SELECT count\(\*\)::int FROM \$\{reelCommentsTable\}/);
  assert.match(reels, /tx\.insert\(reelCommentsTable\)\.values/);
});

test("the share sheet counts only completed shares and displays the updated total", () => {
  assert.match(shareSheet, /useRecordReelShare/);
  assert.match(shareSheet, /await navigator\.share/);
  assert.match(shareSheet, /await navigator\.clipboard\.writeText/);
  assert.match(shareSheet, /await send\.mutateAsync/);
  assert.equal((shareSheet.match(/void trackShare\(\)/g) ?? []).length, 2);
  const copyAction = shareSheet.match(/async function copy\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(copyAction, /trackShare/);
  assert.match(shareSheet, /onClose\(\);\s*void trackShare\(\)\.catch/);
  assert.match(shareSheet, /filter\(\(match\) => !match\.blockedByMe && !match\.blockedMe\)/);
  assert.match(reelSlide, /text-share-count-\$\{reel\.id\}/);
  assert.match(nativeChat, /pathname: "\/reels\/\[reelId\]"/);
  assert.match(nativeChat, /returnTo: `\/chat\/\$\{matchId\}`/);
  assert.match(nativeReel, /testID="button-share-reel"/);
  assert.match(nativeReel, /testID="button-share-to-apps"/);
  assert.match(nativeReel, /await Share\.share\(/);
  assert.match(nativeReel, /result\.action !== Share\.sharedAction/);
  assert.match(nativeReel, /Linking\.openURL\(targetUrl\)/);
  assert.match(nativeReel, /button-share-reel-\$\{target\}/);
  assert.match(nativeReel, /void recordShare\.mutateAsync/);
  assert.match(nativeReel, /filter\(\(match\) => !match\.blockedByMe && !match\.blockedMe\)/);
  assert.match(nativeReel, /Shared a Reel: \/reels\/\$\{reel\.id\}/);
});
