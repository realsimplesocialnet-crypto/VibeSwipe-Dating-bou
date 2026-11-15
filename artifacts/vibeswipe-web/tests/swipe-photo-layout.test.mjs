import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const web = await readFile(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");
const native = await readFile(new URL("../../vibeswipe/app/(tabs)/index.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

test("swipe photo fills a stable allocated frame without fixed portrait sizing", () => {
  const card = web.match(/<article\b[^>]*className="([^"]+)"/)?.[1] ?? "";
  assert.match(card, /h-full min-h-0 w-full min-w-0/);
  assert.match(card, /relative isolate/);
  assert.match(card, /overflow-hidden/);
  assert.doesNotMatch(card, /dvh|aspect-\[|max-h-/);
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

test("Discover locks document scrolling and reserves real navigation space", () => {
  assert.match(css, /html:has\(\.discover-deck\)[^{]*\{[^}]*overflow: hidden;[^}]*overscroll-behavior: none/s);
  assert.match(css, /\.discover-shell:has\(\.discover-deck\) \{[^}]*position: fixed;[^}]*height: calc\(100dvh - var\(--install-banner-height, 0px\)\);/s);
  assert.match(css, /\.discover-shell:has\(\.discover-deck\) > main \{[^}]*min-height: 0;[^}]*padding-bottom: 0;[^}]*overflow: hidden;/s);
  assert.match(css, /\.discover-shell:has\(\.discover-deck\) > nav \{ position: relative; bottom: auto; flex-shrink: 0; \}/);
  assert.match(web, /discover-deck mx-auto flex h-full min-h-0/);
});

test("photo fits the remaining slot without moving behind Stories or covering actions", () => {
  assert.match(css, /\.discover-card-slot \{[^}]*flex: 1;[^}]*min-height: 0;/s);
  assert.match(css, /\.discover-card-slot > article \{[^}]*height: 100%;[^}]*width: 100%;[^}]*aspect-ratio: auto;[^}]*touch-action: none;/s);
  assert.match(css, /\.discover-deck > \.discover-actions \{ flex-shrink: 0;/);
  assert.match(web, /<\/article>\s*<\/div>\s*<div className="discover-actions/);
  for (const [width, height] of [[320,568],[390,844],[412,915],[430,932],[768,1024],[1440,900]]) {
    for (const banner of [0,64,100]) {
      const slotWidth = Math.min(680, width - (width >= 1024 ? 248 : 0)) - (width >= 640 ? 48 : 32);
      const slotHeight = Math.max(0, height - banner - 228 - 88 - 68);
      const photoHeight = slotHeight;
      const photoWidth = slotWidth;
      assert.ok(photoHeight <= slotHeight);
      assert.ok(photoWidth <= slotWidth + .001);
      assert.ok(photoHeight + 228 + 88 + 68 + banner <= height + .001);
    }
  }
});
