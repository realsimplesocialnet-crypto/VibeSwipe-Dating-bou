import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");

test("swipe card fills both dimensions of its responsive slot rather than shrinking to an aspect ratio", () => {
  const rule = css.match(/\.discover-card-slot > article \{([^}]+)\}/)?.[1];
  assert.ok(rule);
  assert.match(rule, /height: 100%/);
  assert.match(rule, /width: 100%/);
  assert.match(rule, /aspect-ratio: auto/);
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
  for (const direction of ["pass", "like", "super"]) assert.ok(css.includes(`article[data-swipe="${direction}"]`));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(component, /key=\{profile\.id\}/);
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
test("reaction must save before advancing, failures retain the same profile, and double taps are locked", () => {
  const swipe = component.slice(component.indexOf("async function swipe("), component.indexOf("async function undoLastSwipe("));
  assert.ok(swipe.indexOf("await Promise.all") < swipe.indexOf("setIndex"));
  assert.match(swipe, /if \(!profile \|\| swipeLock\.current/);
  assert.match(swipe, /finally \{\s*setSwipeMotion\(null\);\s*swipeLock\.current = false/);
  assert.doesNotMatch(swipe, /value - 1/);
});
