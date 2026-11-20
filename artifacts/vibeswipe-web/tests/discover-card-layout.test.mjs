import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../src/components/discover-swipe-card.tsx", import.meta.url), "utf8");

test("swipe card fills both dimensions of its responsive slot rather than shrinking to an aspect ratio", () => {
  const rule = css.match(/\.discover-card-layer > article \{([^}]+)\}/)?.[1];
  assert.ok(rule);
  assert.match(rule, /height: 100%/);
  assert.match(rule, /width: 100%/);
  assert.match(rule, /touch-action: none/);
  assert.match(rule, /will-change: transform/);
  assert.doesNotMatch(component, /aspect-\[4\/5\]|max-w-\[560px\]/);
});
test("actions reserve space outside the photo and fit narrow mobile widths", () => {
  const rule = css.match(/\.discover-deck > \.discover-actions \{([^}]+)\}/)?.[1];
  assert.match(rule, /flex-shrink: 0/);
  assert.match(rule, /padding: 12px 0/);
  assert.match(rule, /gap: clamp/);
  assert.ok(component.indexOf("</article>") < component.indexOf('aria-label="Profile actions"'));
});
test("installed iPhone Discover fills the fixed viewport instead of trusting a stale dynamic height", () => {
  const shell = css.match(/\.discover-shell:has\(\.discover-deck\) \{([^}]+)\}/)?.[1];
  assert.match(shell, /position: fixed/);
  assert.match(shell, /bottom: 0/);
  assert.match(shell, /height: auto/);
  assert.match(shell, /min-height: 0/);
  assert.doesNotMatch(shell, /100dvh/);
  assert.doesNotMatch(css, /\.discover-shell:has\(\.discover-deck\) > nav \{ position: relative/);
  assert.doesNotMatch(css, /html:has\(\.discover-deck\) body \{ position: fixed/);
  assert.match(css, /padding-bottom: var\(--mobile-nav-height/);
});
test("swipe animations support pass, like, super like and reduced motion", () => {
  for (const action of ['"pass"', '"like"', '"super"']) assert.ok(card.includes(action));
  assert.match(component, /<AnimatePresence initial=\{false\} custom=\{swipeExits\}>/);
  assert.match(card, /type: "spring", stiffness: 720/);
  assert.match(card, /duration: 0\.16/);
  assert.match(card, /useMotionValue/);
  assert.match(card, /dragElastic=\{0\.035\}/);
  assert.match(card, /dragMomentum=\{false\}/);
  assert.match(card, /dragSnapToOrigin=\{false\}/);
  assert.match(card, /bounceStiffness: 980/);
  assert.match(card, /bounceDamping: 26/);
  assert.match(card, /power: 0\.35/);
  assert.match(card, /timeConstant: 100/);
  assert.match(card, /stiffness: 980/);
  assert.match(card, /damping: 26/);
  assert.match(card, /restDelta: 0\.5/);
});
test("Discover keeps rounded surfaces without bright outlines or a line above the tabs", () => {
  assert.doesNotMatch(component, /rounded-\[28px\] border border-border\/40/);
  assert.doesNotMatch(component, /rounded-\[30px\] border border-white\/10/);
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const nav = app.match(/<nav ref=\{mobileNavRef\}[^>]+>/)?.[0] ?? "";
  assert.match(nav, /fixed inset-x-0 bottom-0/);
  assert.doesNotMatch(nav, /border-t|border-border/);
  assert.match(app, /getBoundingClientRect\(\)\.height/);
  assert.match(app, /ResizeObserver\(measure\)/);
});
test("swipes advance immediately while server reactions run in a serialized background queue", () => {
  const swipe = component.slice(component.indexOf("const swipe = useCallback("), component.indexOf("const openProfile"));
  assert.ok(swipe.indexOf("setIndexRef.current(nextIndex)") < swipe.indexOf("const submit = async () =>"));
  assert.doesNotMatch(swipe.slice(0, swipe.indexOf("const submit = async () =>")), /await/);
  assert.match(swipe, /if \(!current \|\| current\.id !== profileId \|\| swipeLock\.current/);
  assert.match(swipe, /pendingLikeCountRef\.current >= likesRemaining/);
});

test("Discover memoizes cards, uses pointer drag physics, and keeps three cards mounted ahead", () => {
  assert.match(card, /export const DiscoverSwipeCard = memo/);
  assert.match(card, /drag=\{active \? "x" : false\}/);
  assert.match(card, /SWIPE_OFFSET_PX = 72/);
  assert.match(card, /SWIPE_VELOCITY_PX_PER_SECOND = 450/);
  assert.match(component, /reducedMotion \? 0 : 170/);
  assert.match(card, /onTap=\{\(\) => \{ if \(active\) onOpen\(profile\.id\); \}\}/);
  assert.match(component, /profiles\.slice\(index, index \+ 4\)/);
  assert.match(component, /memory <= 2 \? 3 : 5/);
  assert.match(component, /const openProfile = useCallback/);
});
