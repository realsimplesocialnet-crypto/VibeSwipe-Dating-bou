import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const quietSpinner = await readFile(new URL("../src/components/ui/quiet-spinner.tsx", import.meta.url), "utf8");
const welcomeVideo = await readFile(new URL("../src/components/onboarding-video-background.tsx", import.meta.url), "utf8");

test("public welcome appears while Clerk restores the session", () => {
  assert.match(app, /function Gate\(\{ children \}:[\s\S]*?if \(!isLoaded\) return <AppOpening \/>/);
  assert.match(app, /function HomeRedirect\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <InstalledWelcome\/>/);
  assert.match(app, /function WelcomeRoute\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <InstalledWelcome\/>/);
});

test("startup keeps a quiet spinner and silently retries routine fetch failures", () => {
  assert.match(app, /data-testid="status-app-startup"[^>]*>\s*<QuietSpinner size=\{28\}/);
  assert.doesNotMatch(app, /Opening VIBESWIPES|Still loading\. Check your connection|button-app-startup-retry/);
  assert.match(quietSpinner, /retryNow\(\)/);
  assert.match(quietSpinner, /Math\.min\(2000 \* 2 \*\* retryAttempt, 30_000\)/);
});

test("large feature-only modules are deferred until their routes or controls open", () => {
  for (const name of [
    "InstalledWelcome", "OnboardingVideoBackground", "OnboardingCountryStep",
    "HobbyMultiSelect", "OccupationSelect", "ProfileReelsSection",
    "ChatMessageBubble", "ChatVoiceNoteRecorder", "StoryCameraPage",
  ]) assert.ok(app.includes(`const ${name} = lazy(() => import(`), `${name} is loaded lazily`);
  assert.doesNotMatch(app, /import \{ (?:InstalledWelcome|OnboardingVideoBackground|OnboardingCountryStep|ProfileReelsSection|ChatMessageBubble) \}/);
});

test("welcome animation is skipped for data-saving and two-gigabyte devices", () => {
  assert.match(welcomeVideo, /connection\?: \{ saveData\?: boolean \}/);
  assert.match(welcomeVideo, /deviceMemory\?: number/);
  assert.match(welcomeVideo, /device\.deviceMemory <= 2/);
  assert.match(welcomeVideo, /device\.connection\?\.saveData/);
});
