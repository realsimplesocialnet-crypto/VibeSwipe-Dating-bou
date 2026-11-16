import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Likes screens use charcoal and gold, with a clear empty state and profile entry", () => {
  const colors = read("../constants/colors.ts");
  const likes = read("../components/SocialHub.tsx");
  assert.match(colors, /premiumBackground: "#0F0F12"/);
  assert.match(colors, /premiumCard: "#1A1A1E"/);
  assert.match(colors, /premiumAccent: "#C4A574"/);
  assert.match(likes, /No new likes yet\./);
  assert.match(likes, /Keep swiping!/);
  assert.match(likes, /returnTo: "likes"/);
});

test("profile opened from Likes shows a working Like Back action and returns to Likes", () => {
  const profile = read("../app/profile/[profileId].tsx");
  const ownProfile = read("../app/(tabs)/profile.tsx");
  const tabs = read("../app/(tabs)/_layout.tsx");
  assert.match(profile, /returnTo === "likes"/);
  assert.match(profile, /"Like Back"/);
  assert.match(profile, /react\("like"\)/);
  assert.match(profile, /public-profile-hero/);
  assert.match(ownProfile, /usePremiumColors/);
  assert.match(ownProfile, /user\.isVerified/);
  assert.match(tabs, /tintColor=\{colors\.premiumAccent\}/);
  assert.match(tabs, /tabBarActiveTintColor: colors\.premiumAccent/);
});
