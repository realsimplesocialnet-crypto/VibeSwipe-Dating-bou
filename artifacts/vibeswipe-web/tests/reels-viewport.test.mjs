import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { reelSlideIndex, reelsViewportFrame } from "../src/lib/reels-viewport.ts";

test("iPhone keyboard pan keeps the expanded comments and composer in the visible viewport", () => {
  const frame = reelsViewportFrame(360, 210, 844, true);
  assert.equal(frame.top, 210);
  assert.equal(frame.height, 360);
  assert.equal(frame.keyboardOpen, true);
  assert.equal(frame.commentsHeight, 223);
  assert.equal(frame.height - frame.commentsHeight, 137);
  assert.equal(frame.top + frame.height, 570);
});

test("the wide comment panel leaves a visible, tappable portion of the video on phones", () => {
  for (const height of [240, 320, 390, 560, 844, 1024]) {
    const frame = reelsViewportFrame(height, 0, 844, true);
    assert.ok(frame.commentsHeight <= height * 0.72 + 0.5);
    assert.ok(frame.height - frame.commentsHeight >= height * 0.28 - 0.5);
    assert.ok(frame.commentsHeight <= 560);
  }
});

test("keyboard-open comments override the desktop minimum sheet height", () => {
  const css = readFileSync(new URL("../src/components/reels/reels.css", import.meta.url), "utf8");
  const frame = reelsViewportFrame(240, 0, 844, true);
  assert.equal(frame.keyboardOpen, true);
  assert.equal(frame.commentsHeight, 160);
  assert.equal(frame.height - frame.commentsHeight, 80);
  assert.match(css, /\.reels-root\[data-keyboard-open="true"\] > \.reel-comments\s*\{[^}]*min-height:\s*0[^}]*max-height:\s*72%/);
});

test("closing the keyboard restores the full viewer and expanded comment pane", () => {
  const frame = reelsViewportFrame(844, 0, 844, false);
  assert.equal(frame.keyboardOpen, false);
  assert.equal(frame.top, 0);
  assert.equal(frame.commentsHeight, 523);
  assert.equal(frame.height - frame.commentsHeight, 321);
});

test("expanded comments retain a usable video area at common phone sizes", () => {
  for (const height of [667, 740, 780, 844, 896]) {
    const frame = reelsViewportFrame(height, 0, height, false);
    assert.ok(frame.height - frame.commentsHeight >= 253, `video area too small at ${height}px`);
  }
});

test("loading placeholders and invalid slide indexes cannot remove the active video's source", () => {
  for (const value of [undefined, "", "NaN", "-1", "1.5", "3", "Infinity"]) {
    assert.equal(reelSlideIndex(value, 3), null);
  }
  assert.equal(reelSlideIndex("0", 3), 0);
  assert.equal(reelSlideIndex("2", 3), 2);
  assert.equal(reelSlideIndex("0", 0), null);
});

test("negative visual viewport offsets cannot pull the full-bleed viewer offscreen", () => {
  const frame = reelsViewportFrame(844, -12, 844, false);
  assert.equal(frame.top, 0);
  assert.equal(frame.height, 844);
});

test("Reels navigation uses the same compact icon and label sizing as other tabs", () => {
  const reelsCss = readFileSync(new URL("../src/components/reels/reels.css", import.meta.url), "utf8");
  const appCss = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(appCss, /\.mobile-nav \.mnav-item[^}]*min-height:56px[^}]*font-size:10px/);
  assert.match(reelsCss, /\.reels-mobile-nav \.mnav-item \{ min-height: 56px;[^}]*font-size: 10px;/);
  assert.match(reelsCss, /\.reels-mobile-nav \.mnav-icon \{ height: 24px; width: 24px; \}/);
  assert.doesNotMatch(reelsCss, /\.reels-mobile-nav \.mnav-item \{[^}]*font-size: 11px/);
});
