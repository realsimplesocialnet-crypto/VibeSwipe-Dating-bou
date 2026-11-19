import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/components/reels/reels.css", import.meta.url), "utf8");
const slide = readFileSync(new URL("../src/components/reels/reel-slide.tsx", import.meta.url), "utf8");

test("Reels leave breathing room between action counts and the next button", () => {
  assert.match(css, /\.reel-rail \{ gap: 7px; \}/);
  assert.match(css, /\.reel-rail \.reel-action-button \{[^}]*height: 62px; gap: 6px;/);
  assert.match(slide, /ReelAvatar reference=\{reel\.creatorPhoto\} name=\{reel\.creatorName\} size=\{34\}/);
});
