import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const quietSpinner = await readFile(new URL("../src/components/ui/quiet-spinner.tsx", import.meta.url), "utf8");
const welcomeVideo = await readFile(new URL("../src/components/onboarding-video-background.tsx", import.meta.url), "utf8");
const welcomeVideoCss = await readFile(new URL("../src/components/onboarding-video.css", import.meta.url), "utf8");
const profileSignup = await readFile(new URL("../src/components/profile-first-signup.tsx", import.meta.url), "utf8");
const router = await readFile(new URL("../src/lib/router-compat.tsx", import.meta.url), "utf8");
const profileCache = await readFile(new URL("../src/lib/my-profile-cache.ts", import.meta.url), "utf8");

test("public welcome appears while Clerk restores the session", () => {
  assert.match(app, /function Gate\(\{ children \}:[\s\S]*?if \(!isLoaded\) return <AppOpening \/>/);
  assert.match(app, /function HomeRedirect\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <InstalledWelcome\/>/);
  assert.match(app, /function WelcomeRoute\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <InstalledWelcome\/>/);
});

test("startup uses a skeleton and silently retries routine fetch failures", () => {
  assert.match(app, /data-testid="status-app-startup"><RouteSkeleton label="Opening VibeSwipes"/);
  assert.doesNotMatch(app, /Opening MYAGEBEAUTY|Still loading\. Check your connection|button-app-startup-retry/);
  assert.match(quietSpinner, /retryNow\(\)/);
  assert.match(quietSpinner, /Math\.min\(2000 \* 2 \*\* retryAttempt, 30_000\)/);
});

test("React Router keeps primary tabs mounted and uses in-app navigation", () => {
  assert.match(router, /BrowserRouter/);
  assert.match(router, /useNavigate/);
  assert.match(router, /new Set\(\["\/discover", "\/messages", "\/profile", "\/settings"\]\)/);
  assert.match(router, /hidden=\{!isActive\}/);
  assert.match(router, /<Routes location=\{tabLocation\}>/);
});

test("profile cache is Clerk-account scoped, expires, and never stores a session token", () => {
  assert.match(app, /readCachedMyProfile\(user\.id\)/);
  assert.match(app, /initialDataUpdatedAt:cachedProfile\?\.savedAt/);
  assert.match(profileCache, /cached\.userId !== userId/);
  assert.match(profileCache, /PROFILE_CACHE_TTL_MS/);
  assert.match(profileCache, /localStorage\.setItem/);
  assert.doesNotMatch(profileCache, /sessionToken|accessToken|refreshToken/);
});

test("large feature-only modules are deferred until their routes or controls open", () => {
  for (const name of [
    "InstalledWelcome", "OnboardingVideoBackground", "OnboardingCountryStep",
    "HobbyMultiSelect", "OccupationSelect", "ProfileReelsSection", "ChatsListPage", "ProfilePage",
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

test("full-screen animation remains visible through signup and profile setup", () => {
  assert.match(welcomeVideoCss, /\.onboarding-cinema\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
  assert.match(welcomeVideoCss, /\.onboarding-video-form\s*\{[^}]*background:\s*transparent !important;/s);
  assert.match(welcomeVideoCss, /\.onboarding-video-form \.onboarding-cinema\s*\{\s*z-index:\s*-1;/);
  assert.match(welcomeVideoCss, /rgba\(15,15,18,\.42\)/);
  assert.match(welcomeVideoCss, /rgba\(15,15,18,\.34\)/);
  assert.doesNotMatch(welcomeVideoCss, /linear-gradient\([^;]*#0f0f12\s+100%\)/);
  assert.match(app, /className="onboarding-video-form auth-sign-up[^"]*"><OnboardingVideoBackground form\/>/);
  assert.match(app, /className="onboarding-video-form profile-setup-shell[^"]*"><OnboardingVideoBackground form\/>/);
  assert.match(profileSignup, /function Frame\(\{ children \}:[\s\S]*?<OnboardingVideoBackground form\/>/);
});
