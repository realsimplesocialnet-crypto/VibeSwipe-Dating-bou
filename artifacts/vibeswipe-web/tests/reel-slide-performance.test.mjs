import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../src/components/reels/reel-slide.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../../vibeswipe/app/reels/[reelId].tsx", import.meta.url), "utf8");

test("web photo Reels preload the next two images before a swipe", () => {
  assert.match(web, /neighborIndexes = \[slideIndex - 1, slideIndex \+ 1, slideIndex \+ 2\]/);
  assert.match(web, /const image = new window\.Image\(\)/);
  assert.match(web, /loading="eager" decoding="async" fetchPriority=\{active \? "high" : "auto"\}/);
});

test("native photo Reels cache adjacent authenticated images", () => {
  assert.match(native, /CachedImage\.prefetch\(neighbors, \{[\s\S]*cachePolicy: "memory-disk",[\s\S]*Authorization: `Bearer \$\{token\}`/);
  assert.match(native, /cachePolicy="memory-disk"/);
  assert.match(native, /priority=\{position === slideIndex \? "high" : "normal"\}/);
});
