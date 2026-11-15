import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const css = read("../src/index.css");

test("premium styling keeps the same bottom anchor, safe area and measured content reservation", () => {
  const nav = app.match(/<nav ref=\{mobileNavRef\}[^>]+>/)?.[0] ?? "";
  assert.match(nav, /fixed inset-x-0 bottom-0/);
  assert.match(nav, /pb-\[max\(env\(safe-area-inset-bottom\),8px\)\]/);
  assert.match(nav, /aria-label="Primary"/);
  assert.doesNotMatch(nav, /border-t|rounded-full|bottom-[1-9]/);
  assert.match(app, /offsetHeight/);
  assert.match(css, /padding-bottom: var\(--mobile-nav-height/);
});

test("all five buttons share the original 50px height and equal widths with no label wrapping", () => {
  const rule = css.match(/\.mobile-nav \.mnav-item \{([^}]+)\}/)?.[1] ?? "";
  assert.match(rule, /min-height:50px/);
  assert.match(rule, /flex:1 1 0/);
  assert.match(rule, /min-width:0/);
  assert.match(rule, /font-size:10px/);
  assert.match(rule, /line-height:1.5/);
  assert.match(css, /\.mnav-label \{[^}]*white-space:nowrap/);
  const labels = app.split("const navItems = [")[1].split("];")[0];
  assert.deepEqual([...labels.matchAll(/label: '([^']+)'/g)].map(m => m[1]),
    ["Discover", "Reels", "Messages", "Activity"]);
  assert.match(app, /data-testid="mobile-nav-profile"[^>]*className=\{`mnav-item/);
});

test("selected icons have a contained pink highlight and accessible focus/motion states", () => {
  assert.match(css, /\.mnav-icon \{[^}]*isolation:isolate/);
  assert.match(css, /\.mnav-icon::before \{[^}]*var\(--primary\)/);
  assert.match(css, /\.mnav-item\.is-active \.mnav-icon::before \{ opacity:1/);
  assert.match(css, /\.mnav-item:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*\.mnav-item/);
  assert.equal((app.match(/aria-current=\{/g) ?? []).length >= 2, true);
});
