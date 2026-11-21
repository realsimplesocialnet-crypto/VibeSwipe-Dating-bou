import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("web composer requires a per-Reel download choice for video and photo posts", () => {
  const composer = read("../src/pages/reel-composer.tsx");
  assert.match(composer, /select-reel-download-permission/);
  assert.match(composer, /No downloads/);
  assert.match(composer, /allowDownloads === null/);
  assert.equal((composer.match(/allowDownloads,\s*\.\.\.\(/g) ?? []).length, 2);
});

test("share sheet only offers downloads when the Reel allows it", () => {
  const sheet = read("../src/components/reels/reel-share-sheet.tsx");
  assert.match(sheet, /reel\.canDownload && <button/);
  assert.match(sheet, /data-testid="button-download-reel"/);
  assert.match(sheet, /onDownload\(\)/);
  const feed = read("../src/pages/reels-feed.tsx");
  assert.match(feed, /activeReel\.canDownload && <button/);
  assert.doesNotMatch(feed, /activeReel\.canDownload && activeReel\.mediaType === "video"/);
});

test("native composer and Reel share sheet support the same download choice", () => {
  const composer = read("../../vibeswipe/app/reels/new.tsx");
  assert.match(composer, /Allow people to download this Reel\?/);
  assert.match(composer, /allowDownloads,/);
  const reel = read("../../vibeswipe/app/reels/[reelId].tsx");
  assert.match(reel, /button-download-reel-from-share/);
  assert.match(reel, /reelQuery\.data\?\.canDownload \? <Pressable/);
});
