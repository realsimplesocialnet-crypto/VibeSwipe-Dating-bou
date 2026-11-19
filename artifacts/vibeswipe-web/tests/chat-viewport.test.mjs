import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chatViewportFrame } from "../src/lib/chat-viewport.ts";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("chat frame tracks iPhone's visible viewport and keyboard pan", () => {
  const frame = chatViewportFrame(420, 24, 844, true);
  assert.deepEqual(frame, { height: 420, top: 24, keyboardOpen: true });
});

test("chat viewport geometry ignores fractional pixel movement", () => {
  const frame = chatViewportFrame(419.6, 23.7, 844, true);
  assert.deepEqual(frame, { height: 420, top: 24, keyboardOpen: true });
});

test("chat keyboard animation coalesces viewport events and defers bottom scrolling", () => {
  const handler = app.slice(app.indexOf("let measureFrame=0;"), app.indexOf("},[scrollToLatest]);"));
  assert.match(handler, /if\(measureFrame\)return/);
  assert.match(handler, /setTimeout\(\(\)=>\{[\s\S]*?requestAnimationFrame\(scrollToLatest\)/);
  assert.doesNotMatch(handler, /if\(editing\)requestAnimationFrame\(scrollToLatest\)/);
});
