import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const welcome = read("../src/components/installed-welcome.tsx");
const onboarding = read("../src/components/onboarding-video-background.tsx");

test("website and Home Screen visitors enter through the same welcome and account routes", () => {
  assert.match(app, /<Route path="\/" component=\{HomeRedirect\}/);
  assert.match(app, /<Route path="\/welcome" component=\{WelcomeRoute\}/);
  const entry = app.match(/function HomeRedirect\(\)[^\n]+/)?.[0] ?? "";
  const sharedWelcome = app.match(/function WelcomeRoute\(\)[^\n]+/)?.[0] ?? "";
  assert.match(entry, /Redirect to=\{isSignedIn\?['"]\/discover['"]:['"]\/welcome['"]\}/);
  assert.match(sharedWelcome, /isSignedIn\?<Redirect to="\/discover"\/>:<InstalledWelcome\/>/);
  assert.match(welcome, /href="\/sign-up" data-testid="button-app-create-account"/);
  assert.match(welcome, /href="\/sign-in" data-testid="button-app-sign-in"/);
});

test("core app screens do not require installation or branch into a limited website", () => {
  assert.doesNotMatch(app, /useStandaloneMode|isStandaloneApp|navigator\.standalone|display-mode:/);
  for (const route of ["Discover", "Chats", "Reels", "Profile", "Settings"]) {
    const wrapper = app.match(new RegExp(`function ${route}Route\\(\\)[^\\n]+`))?.[0] ?? "";
    assert.match(wrapper, /<ShellPage>/, `${route} uses the shared authenticated app shell`);
  }
  assert.doesNotMatch(welcome, /useStandaloneMode|isStandaloneApp|navigator\.standalone|beforeinstallprompt/);
});

test("welcome and app shell contain no install or APK download controls", () => {
  assert.doesNotMatch(app, /InstallAction|MobileInstallBanner|ConsumerInstallBanner/);
  const pushSettings = read("../src/components/WebPushSettings.tsx");
  assert.doesNotMatch(pushSettings, /InstallAction/);
  assert.doesNotMatch(app, /PwaInstallBanner/);
  assert.doesNotMatch(welcome, /Download Android App|Install options|apkDownloadUrl|shouldShowAndroidApkDownload|link-download-android-apk/);
  assert.match(app, /<Route path="\/sign-up\/\*\?" component=\{BrandedSignUp\}/);
});

test("welcome screen reuses the original photo-based onboarding animation", () => {
  assert.match(onboarding, /api\/vibeswipe\/onboarding-art\/\$\{asset === "loop" \? "loop-v1\.mp4" : "poster-v1\.webp"\}/);
  assert.match(onboarding, /onboardingAsset\("loop"\)/);
  assert.match(onboarding, /onboardingAsset\("poster"\)/);
  assert.doesNotMatch(onboarding, /myage-onboarding-(?:loop|poster)/);
});
