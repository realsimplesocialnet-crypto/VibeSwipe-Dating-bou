import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../../vibeswipe-web/src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../vibeswipe-web/src/index.css", import.meta.url), "utf8");

test("public profile uses the app shell safe area without adding a second top inset", () => {
  assert.match(styles, /\.app-shell:not\(\.discover-shell\):not\(\.profile-shell\) \{ padding-top:env\(safe-area-inset-top,0px\); \}/);
  assert.match(app, /data-testid="public-profile-page"/);
  assert.match(app, /className="page-in pp-main mx-auto w-full px-4 pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\] pt-2 md:px-6"/);
  assert.doesNotMatch(app, /pt-\[max\(env\(safe-area-inset-top\),0\.5rem\)\]/);
});
