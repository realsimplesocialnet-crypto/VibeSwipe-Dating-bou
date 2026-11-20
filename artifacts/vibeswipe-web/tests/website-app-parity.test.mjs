import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const welcome = read("../src/components/installed-welcome.tsx");

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

test("install controls appear only in the uninstalled Android or mobile browser flow", () => {
  assert.doesNotMatch(app, /InstallAction|MobileInstallBanner|ConsumerInstallBanner/);
  const pushSettings = read("../src/components/WebPushSettings.tsx");
  assert.doesNotMatch(pushSettings, /InstallAction/);
  assert.match(app, /<PwaInstallBanner\/>/);
  assert.match(welcome, /shouldShowAndroidApkDownload\(navigator\.userAgent, isCurrentAndroidWebView\(\), install\.installed \|\| install\.checkingInstalled\)/);
  assert.match(welcome, /href=\{apkDownloadUrl\} download="MYAGEBEAUTY\.apk"/);
  assert.match(read("../src/components/pwa-install-banner.tsx"), /shouldShowPwaInstallBanner/);
  assert.match(app, /<Route path="\/sign-up\/\*\?" component=\{BrandedSignUp\}/);
});
