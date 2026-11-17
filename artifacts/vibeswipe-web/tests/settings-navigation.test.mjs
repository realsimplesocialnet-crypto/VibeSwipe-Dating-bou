import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { settingsBackTarget } from "../src/lib/settings-navigation.ts";

const origin = "https://app.example.test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Settings returns to the entry screen, with Profile as the direct-entry fallback", () => {
  for (const entry of ["/profile", "/discover", "/matches", "/messages", "/notifications"]) {
    assert.equal(settingsBackTarget(entry, "/settings", origin), entry);
  }
  assert.equal(settingsBackTarget(null, "/settings", origin), "/profile");
});
test("nested settings and verification retain the original return journey", () => {
  const settings = "/settings?returnTo=%2Fprofile";
  assert.equal(settingsBackTarget(settings, "/settings/privacy", origin), settings);
  assert.equal(settingsBackTarget(settings, "/verify-profile", origin), settings);
  assert.equal(settingsBackTarget("/profile", "/settings", origin), "/profile");
  assert.equal(settingsBackTarget(null, "/settings/privacy", origin), "/settings");
});
test("self-links, nested Settings loops and external redirects cannot trap Back", () => {
  for (const entry of ["/settings", "/settings/", "/settings?returnTo=%2Fsettings", "/settings/privacy", "//outside.test", "https://outside.test/profile", "javascript:alert(1)", "https://name:pass@app.example.test/profile"]) {
    assert.equal(settingsBackTarget(entry, "/settings", origin), "/profile", entry);
  }
  assert.equal(settingsBackTarget("/settings/privacy", "/settings/privacy", origin), "/settings");
});
test("Settings hides paused face verification and keeps its safe-area back controls", () => {
  const settings = read("../src/components/settings/settings-pages.tsx");
  const css = read("../src/index.css");
  assert.match(settings, /pt-\[calc\(env\(safe-area-inset-top,0px\)\+16px\)\]/);
  assert.match(css, /\.app-shell:not\(\.discover-shell\):not\(\.profile-shell\):has\(\.settings-frame\) \{ padding-top:0; \}/);
  assert.match(settings, /href=\{returnTo\} replace[^>]*min-h-11/);
  assert.doesNotMatch(settings, /link-settings-face-verification|Face verification/);
  const app = read("../src/App.tsx");
  assert.match(app, /function FaceVerificationRoute\(\)\{return <Redirect to="\/settings"\/>\}/);
  assert.match(app, /Route path="\/verify-profile" component=\{FaceVerificationRoute\}/);
  const native = read("../../vibeswipe/app/settings.tsx");
  assert.doesNotMatch(native, /Face verification|verify-profile/);
  const nativeRoute = read("../../vibeswipe/app/verify-profile.tsx");
  assert.match(nativeRoute, /FACE_VERIFICATION_ENABLED = false/);
  assert.match(nativeRoute, /Redirect href="\/settings"/);
  assert.match(native, /useSafeAreaInsets\(\)/);
  assert.match(native, /insets\.top\) \+ 12/);
  assert.match(native, /router\.canGoBack\(\) \? router\.back\(\) : router\.replace\("\/\(tabs\)\/profile"\)/);
  assert.match(native, /back: \{ width: 44, height: 44/);
});
