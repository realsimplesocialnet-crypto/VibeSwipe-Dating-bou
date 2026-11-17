import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("own and public web profiles emphasize follower counts over their labels", () => {
  const styles = source("artifacts/vibeswipe-web/src/components/social-hub.css");
  assert.match(styles, /\.sh-profile-stat strong \{ font-size:22px/);
  assert.match(styles, /\.sh-profile-stat span \{[^}]*font-size:11px/);
  assert.match(styles, /\.sh-profile-social-compact \.sh-profile-stat \{[^}]*flex-direction:column/);
  assert.match(styles, /\.sh-profile-social-compact \.sh-profile-stat strong \{ font-size:20px/);
});

test("native own and public profiles use large count text with smaller labels", () => {
  const component = source("artifacts/vibeswipe/components/ProfileFollow.tsx");
  assert.match(component, /statValue: \{ fontSize: 22, lineHeight: 25, fontWeight: "900" \}/);
  assert.match(component, /statLabel: \{ fontSize: 11, fontWeight: "600" \}/);
});
