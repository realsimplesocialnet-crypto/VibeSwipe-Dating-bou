import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const css = read("../src/index.css");
const search = read("../src/components/member-search-page.tsx");

test("mobile tabs sit lower while retaining safe-area clearance and measured content reservation", () => {
  const nav = app.match(/<nav ref=\{mobileNavRef\}[^>]+>/)?.[0] ?? "";
  assert.match(nav, /fixed inset-x-0 bottom-0/);
  assert.doesNotMatch(nav, /pb-\[/);
  assert.match(nav, /aria-label="Primary"/);
  assert.doesNotMatch(nav, /border-t|rounded-full|bottom-[1-9]/);
  assert.match(css, /height:calc\(72px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /padding:5px 10px max\(env\(safe-area-inset-bottom, 0px\), 8px\)/);
  assert.match(css, /background:rgb\(10 9 13 \/ .97\) !important/);
  assert.match(app, /getBoundingClientRect\(\)\.height/);
  assert.match(css, /padding-bottom: var\(--mobile-nav-height/);
});

test("resuming the installed app refreshes tab sizing before the first tap", () => {
  assert.match(app, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(app, /window\.addEventListener\('pageshow', syncAfterResume\)/);
  assert.match(app, /window\.visualViewport/);
  assert.match(app, /\[0, 120, 360\]\.map\(\(delay\) => window\.setTimeout\(scheduleMeasure, delay\)\)/);
});

test("member search uses the shell's iPhone safe-area inset only once", () => {
  assert.match(css, /\.app-shell:not\(\.discover-shell\):not\(\.profile-shell\) \{ padding-top:env\(safe-area-inset-top,0px\); \}/);
  assert.match(search, /className="page-in[^"]*pt-3/);
  assert.doesNotMatch(search, /pt-\[max\(env\(safe-area-inset-top\)/);
});

test("all five buttons share equal widths and clear, unclipped labels", () => {
  const rule = css.match(/\.mobile-nav \.mnav-item \{([^}]+)\}/)?.[1] ?? "";
  assert.match(rule, /min-height:56px/);
  assert.match(rule, /flex:1 1 0/);
  assert.match(rule, /min-width:0/);
  assert.match(rule, /font-size:10px/);
  assert.match(rule, /line-height:1.25/);
  assert.match(css, /height:22px; width:22px; stroke-width:1\.9/);
  assert.match(css, /\.mnav-label \{[^}]*white-space:nowrap/);
  const labels = app.split("const navItems = [")[1].split("];")[0];
  assert.deepEqual([...labels.matchAll(/label: '([^']+)'/g)].map(m => m[1]),
    ["Discover", "Reels", "Chats", "Activity"]);
  assert.match(app, /data-testid="mobile-nav-profile"[^>]*className=\{`mnav-item/);
});

test("selected icons have a contained pink highlight and accessible focus/motion states", () => {
  assert.match(css, /\.mnav-icon \{[^}]*isolation:isolate/);
  assert.match(css, /\.mnav-icon::before \{[^}]*rgb\(243 78 154 \/ .2\)/);
  assert.match(css, /\.mnav-item\.is-active \.mnav-icon::before \{ opacity:1/);
  assert.match(css, /\.mnav-item\.is-active \{ color:#f34e9a !important; font-weight:750/);
  assert.match(css, /\.mnav-item\.is-active \.mnav-label \{ color:#fff; opacity:1/);
  assert.match(css, /\.mnav-item:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*\.mnav-item/);
  assert.equal((app.match(/aria-current=\{/g) ?? []).length >= 2, true);
});
