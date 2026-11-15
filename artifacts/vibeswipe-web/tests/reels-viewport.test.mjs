import assert from "node:assert/strict";
import test from "node:test";
import { reelSlideIndex, reelsViewportFrame } from "../src/lib/reels-viewport.ts";

test("iPhone keyboard pan keeps both Reel and comment input within the visible viewport", () => {
  const frame = reelsViewportFrame(360, 210, 844, true);
  assert.equal(frame.top, 210);
  assert.equal(frame.height, 360);
  assert.equal(frame.keyboardOpen, true);
  assert.equal(frame.commentsHeight, 144);
  assert.equal(frame.height - frame.commentsHeight, 216);
  assert.equal(frame.top + frame.height, 570);
});

test("comments never take most of the video area, even on a small keyboard viewport", () => {
  for (const height of [240, 320, 390, 560, 844, 1024]) {
    const frame = reelsViewportFrame(height, 0, 844, true);
    assert.ok(frame.commentsHeight <= height * 0.4 + 0.5);
    assert.ok(frame.height - frame.commentsHeight >= height * 0.6 - 0.5);
    assert.ok(frame.commentsHeight <= 300);
  }
});

test("closing the keyboard restores the full viewer and bounded comment pane", () => {
  const frame = reelsViewportFrame(844, 0, 844, false);
  assert.equal(frame.keyboardOpen, false);
  assert.equal(frame.top, 0);
  assert.equal(frame.commentsHeight, 300);
  assert.equal(frame.height - frame.commentsHeight, 544);
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
