import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const css = read("../src/components/onboarding-video.css");

test("all thirteen setup steps share safe-area spacing below the iPhone clock", () => {
  assert.match(app, /function OnboardingRoute\(\).*profile-setup-shell.*<OnboardingGate\/>/);
  assert.match(css, /\.profile-setup-shell \{[^}]*padding-top: env\(safe-area-inset-top, 0px\);[^}]*safe-area-inset-bottom/s);
  assert.match(css, /\.profile-setup-shell > \.page-in \{ padding-top: 20px;/);
});
test("setup avoids forced keyboard opening and retains reachable normal-flow actions", () => {
  assert.doesNotMatch(app, /<input autoFocus data-testid="input-onboarding-(first|last)-name"/);
  assert.match(css, /\.profile-setup-shell textarea,[\s\S]*font-size: 16px;/);
  assert.match(app, /profile-setup-controls/);
  assert.match(app, /data-testid="button-onboarding-back" className="min-h-11/);
  assert.match(app, /data-testid="button-onboarding-next" className="inline-flex min-h-11/);
  assert.doesNotMatch(css, /\.profile-setup-shell \{[^}]*(?:height: 100dvh|overflow: hidden)/s);
});
test("email signup and profile-first headers also stay below the safe area", () => {
  assert.match(css, /\.auth-sign-up-brand \{[^}]*top: calc\(env\(safe-area-inset-top, 0px\) \+ 16px\)/s);
  assert.match(css, /\.auth-sign-up \{[^}]*safe-area-inset-top[^}]*safe-area-inset-bottom/s);
  const signup = read("../src/components/profile-first-signup.tsx");
  assert.match(signup, /pt-\[calc\(env\(safe-area-inset-top,0px\)\+20px\)\]/);
});
