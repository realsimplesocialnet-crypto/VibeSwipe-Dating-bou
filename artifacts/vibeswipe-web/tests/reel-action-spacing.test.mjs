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
  assert.match(slide, /fill=\{filled \? stroke : "#fff"\}/);
  assert.match(native, /fill=\{filled \? stroke : "#fff"\}/);
  assert.match(slide, /name === "share" && <path[^]*fill="#fff"/);
  assert.match(native, /name === "share" \? <Path[^]*fill="#fff"/);
  assert.match(slide, /name === "share"[^]*M3\.5 19\.5c2\.5-6\.8 7\.1-10\.4 14\.3-10\.4/);
  assert.match(native, /name === "share" \?[^]*M3\.5 19\.5c2\.5-6\.8 7\.1-10\.4 14\.3-10\.4/);
  assert.doesNotMatch(slide, /m22 2-7 20-4-9-9-4 20-7/);
});
