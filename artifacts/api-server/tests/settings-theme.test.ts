import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("Notification Settings use the selected app theme instead of forcing light colors", () => {
  const settings = source("artifacts/vibeswipe-web/src/components/settings/settings-pages.tsx");
  const themeSync = source("artifacts/vibeswipe-web/src/App.tsx");

  assert.match(settings, /className="notification-settings min-h-\[calc\(100dvh-66px\)\] bg-background text-foreground"/);
  assert.match(settings, /card-notification-settings" className="rounded-\[26px\] border border-border bg-card/);
  assert.match(settings, /bg-accent text-primary/);
  assert.match(settings, /checked\?'bg-primary':'bg-muted'/);
  assert.doesNotMatch(settings, /bg-\[#fdeef2\]|bg-\[#fffafb\]|dark:bg-transparent/);
  assert.match(themeSync, /document\.documentElement\.dataset\.theme = lightMode \? "light" : "dark"/);
});
