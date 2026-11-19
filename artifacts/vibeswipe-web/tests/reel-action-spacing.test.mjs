import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/components/reels/reels.css", import.meta.url), "utf8");
const slide = readFileSync(new URL("../src/components/reels/reel-slide.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../../vibeswipe/app/reels/[reelId].tsx", import.meta.url), "utf8");

test("Reels leave breathing room between action counts and the next button", () => {
  assert.match(css, /\.reel-rail \{ gap: 9px; \}/);
  assert.match(css, /\.reel-rail \.reel-action-button \{[^}]*height: 70px; gap: 8px;/);
  assert.doesNotMatch(css, /\.reel-action-glyph\s*\{/);
  assert.doesNotMatch(slide, /className="reel-action-glyph"/);
  assert.doesNotMatch(native, /actionIconShell/);
  assert.doesNotMatch(native, /<LinearGradient[^>]*style=\{styles\.actionIconShell\}/);
  assert.match(slide, /ReelAvatar reference=\{reel\.creatorPhoto\} name=\{reel\.creatorName\} size=\{34\}/);
  assert.match(slide, /name === "share"[^]*M4 18c2\.8-6\.9 7\.9-10\.7 15\.5-11/);
  assert.match(native, /name === "share" \?[^]*M4 18c2\.8-6\.9 7\.9-10\.7 15\.5-11/);
  assert.doesNotMatch(slide, /m22 2-7 20-4-9-9-4 20-7/);
});
