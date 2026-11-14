import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const web = await readFile(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");
const native = await readFile(new URL("../../vibeswipe/app/(tabs)/index.tsx", import.meta.url), "utf8");

test("swipe photo reserves a stable portrait frame instead of resizing with browser chrome", () => {
  const card = web.match(/<article\s+className="([^"]+)"/)?.[1] ?? "";
  assert.match(card, /aspect-\[4\/5\]/);
  assert.match(card, /relative isolate/);
  assert.match(card, /overflow-hidden/);
  assert.doesNotMatch(card, /dvh|min-h-|max-h-/);
  assert.match(web, /ProfilePhoto key=\{profile.id\}.*object-cover object-top/);
});

test("own avatar is grouped into Stories when a card is shown; empty Discover stays unchanged", () => {
  assert.match(web, /!profile && <StoriesRow mode="own"/);
  assert.match(web, /StoriesRow mode=\{profile \? "all" : "matches"\}/);
  assert.match(web, /profile\.name/);
  assert.match(web, /profile\.age !== null/);
  assert.match(web, /profile\.interests\[0\]/);
});

test("native swipe photo uses the same fixed ratio, authenticated source, and top-center positioning", () => {
  assert.match(native, /photoHero: \{ width: "100%", aspectRatio: 4 \/ 5, overflow: "hidden" \}/);
  assert.match(native, /PositionedImage key=\{profile.id\} source=\{heroSource\}.*contentFit="cover" contentPosition="top"/);
  assert.match(native, /const poster = profileImageSource\(profile.photos\[0\], token\)/);
  assert.doesNotMatch(native, /const heroHeight =/);
});
