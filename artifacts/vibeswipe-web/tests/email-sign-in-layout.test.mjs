import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const css = read("../src/index.css");
const document = read("../index.html");
const native = read("../../vibeswipe/app/(auth)/sign-in.tsx");

test("web email sign-in keeps Clerk's email flow while omitting social buttons and divider", () => {
  for (const element of ["socialButtons", "socialButtonsBlockButton", "socialButtonsIconButton", "dividerRow"]) {
    assert.ok(app.includes(`${element}: { display: 'none' as const }`), element);
  }
  assert.match(app, /<SignIn routing="path" path=\{pathFor\('\/sign-in'\)\} signUpUrl=\{pathFor\('\/sign-up'\)\}/);
});
test("login branding stays in normal flow below the safe area, not over the iPhone clock", () => {
  const route = app.slice(app.indexOf("function SignInRoute()"), app.indexOf("function App()"));
  assert.match(route, /auth-sign-in/);
  assert.match(route, /data-testid="header-sign-in-brand"><Brand\/><\/header>/);
  assert.doesNotMatch(route, /fixed|top-6/);
  assert.match(css, /\.auth-sign-in \{[^}]*padding-top:calc\(env\(safe-area-inset-top,0px\) \+ 16px\);[^}]*safe-area-inset-bottom/s);
});
test("Clerk state classes gate the actual sign-in and app screens", () => {
  const sync = app.slice(app.indexOf("function ClerkAuthStateSync"), app.indexOf("function ProfileNavigationPrefetcher"));
  const signIn = app.slice(app.indexOf("function SignInRoute()"), app.indexOf("function App()"));
  assert.match(sync, /useUser\(\)/);
  assert.match(sync, /classList\.toggle\('is-authed'/);
  assert.match(sync, /classList\.toggle\('is-guest'/);
  assert.match(sync, /classList\.toggle\('is-auth-loading'/);
  assert.doesNotMatch(sync, /localStorage|sessionStorage|auth_token/);
  assert.match(signIn, /if\(isSignedIn\)return <Redirect to="\/discover"\/>/);
  assert.match(document, /html\.is-authed \.auth-sign-in/);
  assert.match(document, /html\.is-guest \.app-shell/);
  assert.match(document, /html\.is-auth-loading \.app-shell/);
});
test("the prepaint auth marker is the first head script and does not read a stored token", () => {
  const head = document.slice(document.indexOf("<head>"), document.indexOf("</head>"));
  const inlineScript = head.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1] ?? "";
  assert.ok(inlineScript.length > 0);
  assert.ok(head.indexOf("<script>") < head.indexOf('src="%BASE_URL%pwa-install.js'));
  assert.match(inlineScript, /classList\.add\("is-auth-loading"\)/);
  assert.match(inlineScript, /isPublicLegalPage/);
  assert.doesNotMatch(inlineScript, /localStorage|sessionStorage|auth_token/);
});
test("mobile sign-in retains email/password, account creation and safe-area spacing without Google", () => {
  assert.doesNotMatch(native, /useSSO|oauth_google|Continue with Google|google-sign-in|googleSignIn/);
  assert.match(native, /signIn\.password\(\{ emailAddress, password \}\)/);
  assert.match(native, /signIn\.finalize\(/);
  assert.match(native, /autoComplete="current-password"/);
  assert.match(native, /href="\/\(auth\)\/sign-up"/);
  assert.match(native, /useSafeAreaInsets\(\)/);
  assert.match(native, /insets\.top\) \+ 16/);
});
