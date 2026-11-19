import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reelSafetyExtractionTimeoutMs, reelSafetySamplingPlan } from "../src/lib/reel-safety-sampling.ts";
import { explicitScore, rejectExplicitFrame, rejectExplicitImage, ReelSafetyError } from "../src/lib/reel-safety-policy.ts";
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
test("unsafe classifications are rejected, ordinary frames pass", () => {
  assert.equal(rejectExplicitFrame([{ label: "normal", score: .95 }, { label: "nsfw", score: .05 }]), .05);
  assert.throws(() => rejectExplicitFrame([{ label: "normal", score: .2 }, { label: "nsfw", score: .8 }]), e => e instanceof ReelSafetyError && e.status === 422);
  assert.equal(rejectExplicitImage([{ label: "normal", score: .95 }, { label: "nsfw", score: .05 }]), .05);
  assert.throws(() => rejectExplicitImage([{ label: "normal", score: .2 }, { label: "nsfw", score: .8 }]), e => e instanceof ReelSafetyError && e.status === 422);
});
test("photo slides are normalized, safety-checked, and sealed before publication", () => {
  const service = read("lib/reel-safety.ts");
  const route = read("routes/vibeswipe-reels.ts");
  assert.match(service, /export async function processSafeReelImage/);
  assert.match(service, /await checkReelImage\(normalizedPath\)/);
  assert.match(service, /checked-reel-slides\/\$\{randomUUID\(\)\}/);
  assert.match(service, /status='approved',checked_path=\$1,result=\$2/);
  assert.match(route, /for \(const asset of slides\) await processSafeReelImage\(asset\)/);
  assert.match(route, /slideMediaIds/);
  assert.match(route, /\.onConflictDoNothing\(\)[\s\S]*?insertedSlides\.length !== mediaIds\.length/);
});
test("missing, invalid or incomplete AI results fail closed", () => {
  for (const result of [[], [{ label: "normal", score: 1 }], [{ label: "normal", score: NaN }, { label: "nsfw", score: .1 }], [{ label: "normal", score: .2 }, { label: "nsfw", score: .1 }]]) {
    assert.throws(() => explicitScore(result), e => e instanceof ReelSafetyError && e.status === 503);
  }
});
test("publishing cannot bypass the checked upload gate", () => {
  const routes = read("routes/vibeswipe-reels.ts");
  assert.match(routes, /await processSafeReel\(asset\)/);
  const create = routes.slice(routes.indexOf('router.post("/vibeswipe/reels"'));
  assert.ok(create.includes("reelIsApproved(asset!)"));
  assert.ok(create.indexOf("reelIsApproved(asset!)") < create.indexOf("db.insert(reelsTable)"));
  assert.match(read("lib/reels-visibility.ts"), /s\.status='approved'[\s\S]*s\.version=[\s\S]*s\.checked_path=m\.object_path/);
});
test("checked video is sealed before atomic approval, not reused from a writable upload URL", () => {
  const service = read("lib/reel-safety.ts");
  assert.ok(service.indexOf("await checkReelVideo") < service.indexOf("await storage.storePrivateFile"));
  assert.ok(service.indexOf("await storage.storePrivateFile") < service.indexOf("UPDATE vibeswipe_media_assets"));
  assert.match(service, /checked-reels\/\$\{randomUUID\(\)\}/);
  assert.match(service, /BEGIN[\s\S]*UPDATE vibeswipe_media_assets[\s\S]*status='approved'[\s\S]*COMMIT/);
  assert.match(service, /result\.rowCount !== 0\)\.catch\(\(\) => true\)/);
  assert.match(service, /if \(!referenced\) await storage\.deleteObjectEntity/);
});
test("long video safety samples stay distributed across the entire timeline", () => {
  const short = reelSafetySamplingPlan(180);
  assert.equal(short.framesPerSecond, 1);
  const threeHours = reelSafetySamplingPlan(3 * 60 * 60);
  assert.equal(threeHours.framesPerSecond, 1 / 18);
  assert.equal(threeHours.minimumFrameCount, 570);
  assert.throws(() => reelSafetySamplingPlan(0), RangeError);
  assert.ok(reelSafetyExtractionTimeoutMs(3 * 60 * 60) > 180_000);
  const checker = read("lib/reel-safety-checker.ts");
  assert.match(checker, /fps=\$\{sampling\.framesPerSecond/);
  assert.match(checker, /frames\.length < sampling\.minimumFrameCount/);
  assert.match(checker, /reelSafetyExtractionTimeoutMs\(duration\)/);
  assert.match(checker, /for \(const frame of frames\)/);
  assert.doesNotMatch(checker, /"-t"|"60"/);
  assert.match(read("index.ts"), /void checkExistingReels\(\)/);
});
