import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("own and public web profiles emphasize follower counts over their labels", () => {
  const styles = source("artifacts/vibeswipe-web/src/components/social-hub.css");
  assert.match(styles, /\.sh-profile-stat strong \{[^}]*font-size:22px/);
  assert.match(styles, /\.sh-profile-stat span \{[^}]*font-size:12px[^}]*font-weight:800/);
  assert.match(styles, /\.sh-profile-social-compact \.sh-profile-stat \{[^}]*flex-direction:column/);
  assert.match(styles, /\.sh-profile-social-compact \.sh-profile-stat strong \{ font-size:20px/);
  assert.match(styles, /html\[data-theme="light"\] \.sh-profile-stat \{[^}]*background:#fffafd/);
  assert.match(styles, /html\[data-theme="light"\] \.sh-profile-stat span \{ color:#62565d/);
});

test("native own and public profiles use large count text with smaller labels", () => {
  const component = source("artifacts/vibeswipe/components/ProfileFollow.tsx");
  assert.match(component, /statValue: \{ fontSize: 22, lineHeight: 25, fontWeight: "900" \}/);
  assert.match(component, /statLabel: \{ fontSize: 12, fontWeight: "800" \}/);
});

test("public profile follow-back labels use the refreshed follow relationship", () => {
  const web = source("artifacts/vibeswipe-web/src/components/social-hub.tsx");
  const native = source("artifacts/vibeswipe/components/ProfileFollow.tsx");
  for (const component of [web, native]) {
    assert.match(component, /followsYou \? ["']Follow back["'] : ["']Follow["']/);
    assert.match(component, /refetchOnWindowFocus: true/);
    assert.match(component, /refetchOnReconnect: true/);
    assert.match(component, /staleTime: ?60_000/);
  }
});
