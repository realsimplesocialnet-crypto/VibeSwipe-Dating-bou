import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("web signup can go back during photo upload or switch to an existing account", () => {
  const web = source("artifacts/vibeswipe-web/src/App.tsx");
  assert.match(web, /data-testid="button-onboarding-back"[^>]*className/);
  assert.match(web, /disabled=\{step===0\|\|saveProfile\.isPending\}/);
  assert.doesNotMatch(web, /disabled=\{step===0\|\|uploading/);
  assert.match(web, /data-testid="button-onboarding-sign-in"/);
  assert.match(web, /signOut\(\{redirectUrl:/);
  assert.match(web, /window\.dispatchEvent\(new Event\('onboarding-sign-in'\)\)/);
});

test("installed signup offers Log in and phone Back returns through profile steps", () => {
  const native = source("artifacts/vibeswipe/components/OnboardingWizard.tsx");
  assert.match(native, /testID="onboarding-sign-in"/);
  assert.match(native, /await signOut\(\)/);
  assert.match(native, /router\.replace\("\/\(auth\)\/sign-in"\)/);
  assert.match(native, /hardwareBackPress/);
  assert.match(native, /function previous\(\) \{\s*if \(step <= 0\) return;\s*if \(autosaveTimer\.current\) clearTimeout\(autosaveTimer\.current\);\s*setStep/);
  assert.match(native, /testID="profile-step-back"[\s\S]*?disabled=\{isSaving\}/);
});
