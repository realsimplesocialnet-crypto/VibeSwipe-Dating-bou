import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("home and protected routes render a startup screen while Clerk restores the session", () => {
  assert.match(app, /function Gate\(\{ children \}:[\s\S]*?if \(!isLoaded\) return <AppOpening \/>/);
  assert.match(app, /function HomeRedirect\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <AppOpening\/>/);
  assert.match(app, /function WelcomeRoute\(\)\{const \{isLoaded,isSignedIn\}=useUser\(\);if\(!isLoaded\)return <AppOpening\/>/);
});

test("a stalled startup offers a retry instead of leaving an empty screen", () => {
  assert.match(app, /setTimeout\(\(\) => setSlow\(true\), 10_000\)/);
  assert.match(app, /data-testid="button-app-startup-retry"/);
  assert.match(app, /window\.location\.reload\(\)/);
});
