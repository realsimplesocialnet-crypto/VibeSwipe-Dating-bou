import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const quietSpinner = await readFile(new URL("../src/components/ui/quiet-spinner.tsx", import.meta.url), "utf8");

test("home and protected routes render a startup screen while Clerk restores the session", () => {
  assert.match(app, /function Gate\(\{ children \}:[\s\S]*?if \(!isLoaded\) return <AppOpening \/>/);
  assert.match(app, /function HomeRedirect\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <AppOpening\/>/);
  assert.match(app, /function WelcomeRoute\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <AppOpening\/>/);
});

test("startup keeps a quiet spinner and silently retries routine fetch failures", () => {
  assert.match(app, /data-testid="status-app-startup"[^>]*>\s*<QuietSpinner size=\{28\}/);
  assert.doesNotMatch(app, /Opening Myage|Still loading\. Check your connection|button-app-startup-retry/);
  assert.match(quietSpinner, /retryNow\(\)/);
  assert.match(quietSpinner, /Math\.min\(2000 \* 2 \*\* retryAttempt, 30_000\)/);
});
