import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../src/index.css");
const discover = read("../src/components/discover-swipe-page.tsx");
const router = read("../src/lib/router-compat.tsx");

test("a hidden kept-alive Discover tab does not disable profile page scrolling", () => {
  assert.match(router, /hidden=\{!isActive\}[^>]*data-kept-tab=\{route\.originalPath\}/);
  assert.match(css, /html:has\(\[data-kept-tab="\/discover"\]:not\(\[hidden\]\) \.discover-deck\),\s*html:has\(\[data-kept-tab="\/discover"\]:not\(\[hidden\]\) \.discover-deck\) body/);
  assert.doesNotMatch(css, /html:has\(\.discover-deck\),\s*html:has\(\.discover-deck\) body/);
});

test("failed Discover loading shows an actionable retry instead of an endless spinner", () => {
  assert.match(discover, /data-testid="status-discover-loading"/);
  const errorBranch = discover.slice(
    discover.indexOf("if (discover.isError && !discover.data)"),
    discover.indexOf("if (!profile)", discover.indexOf("if (discover.isError && !discover.data)")),
  );
  assert.match(errorBranch, /data-testid="error-discover-load"/);
  assert.match(errorBranch, /data-testid="button-retry-discover-load"/);
  assert.doesNotMatch(errorBranch, /QuietSpinner/);
});
