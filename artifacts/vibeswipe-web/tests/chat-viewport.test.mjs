import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chatViewportFrame } from "../src/lib/chat-viewport.ts";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const directChat = readFileSync(new URL("../src/pages/direct-chat.tsx", import.meta.url), "utf8");
const nativeChat = readFileSync(new URL("../../vibeswipe/app/chat/[matchId].tsx", import.meta.url), "utf8");
const nativeDirectChat = readFileSync(new URL("../../vibeswipe/app/direct-chat/[conversationId].tsx", import.meta.url), "utf8");

test("chat frame tracks iPhone's visible viewport and keyboard pan", () => {
  const frame = chatViewportFrame(420, 24, 844, true);
  assert.deepEqual(frame, { height: 444, top: 0, keyboardOpen: true });
});

test("chat viewport geometry ignores fractional pixel movement", () => {
  const frame = chatViewportFrame(419.6, 23.7, 844, true);
  assert.deepEqual(frame, { height: 444, top: 0, keyboardOpen: true });
});

test("chat keyboard animation coalesces viewport events and defers bottom scrolling", () => {
  const handler = app.slice(app.indexOf("let measureFrame=0;"), app.indexOf("},[scrollToLatest]);"));
  assert.match(handler, /if\(measureFrame\)return/);
  assert.match(handler, /setTimeout\(\(\)=>\{[\s\S]*?requestAnimationFrame\(scrollToLatest\)/);
  assert.doesNotMatch(handler, /if\(editing\)requestAnimationFrame\(scrollToLatest\)/);
});

test("both web chat screens stay anchored while iOS pans its visual viewport", () => {
  assert.match(app, /chatSurfaceRef=useRef<HTMLDivElement>/);
  assert.match(app, /surface\.style\.height=`calc\(\$\{frame\.height\}px/);
  assert.match(app, /composer\.style\.paddingBottom=frame\.keyboardOpen/);
  assert.doesNotMatch(app, /setChatViewport/);
  assert.match(directChat, /chatViewportFrame\(height, viewport\?\.offsetTop/);
  assert.match(directChat, /surface\.style\.height = `calc\(\$\{frame\.height\}px/);
  assert.match(directChat, /fixed inset-x-0/);
  assert.match(directChat, /composer\.style\.paddingBottom = frame\.keyboardOpen/);
  assert.doesNotMatch(directChat, /setChatViewport/);
  assert.doesNotMatch(directChat, /scrollIntoView/);
});

test("native chats avoid applying keyboard insets twice", () => {
  for (const source of [nativeChat, nativeDirectChat]) {
    assert.match(source, /automaticallyAdjustKeyboardInsets=\{false\}/);
    assert.match(source, /contentInsetAdjustmentBehavior="never"/);
    assert.doesNotMatch(source, /useKeyboardState/);
  }
  assert.match(nativeChat, /keyboardVerticalOffset=\{Platform\.OS === "ios" \? -insets\.bottom : 0\}/);
  assert.match(nativeDirectChat, /keyboardVerticalOffset=\{Platform\.OS === "ios" \? -insets\.bottom : 0\}/);
  assert.match(nativeChat, /marginBottom: Math\.max\(insets\.bottom, 8\)/);
  assert.match(nativeDirectChat, /paddingBottom: Math\.max\(insets\.bottom, 8\)/);
});
