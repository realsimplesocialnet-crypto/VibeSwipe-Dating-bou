import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("native Home is a social feed with Stories and no dating swipe deck", () => {
  const home = read("../app/(tabs)/index.tsx");
  const stories = read("../components/social/Stories.tsx");
  assert.match(home, /getSocialFeed\(\{ mode: "home"/);
  assert.match(home, /<StoriesRow/);
  assert.match(home, /<PostCard/);
  assert.doesNotMatch(home, /useGetDiscoverProfiles|reactLike|SwipeDeck/);
  assert.match(stories, /Stories/);
});

test("social profile exposes follow, message, post count, and posts without dating actions", () => {
  const profile = read("../app/profile/[profileId].tsx");
  const ownProfile = read("../app/(tabs)/profile.tsx");
  const followStats = read("../components/ProfileFollow.tsx");
  const likesRoute = read("../app/(tabs)/activity/likes.tsx");
  const activity = read("../components/SocialHub.tsx");
  const tabs = read("../app/(tabs)/_layout.tsx");
  assert.match(profile, /ProfileFollowStats/);
  assert.match(profile, /public-profile-message/);
  assert.doesNotMatch(profile, /reactLike|"Like Back"|MatchCelebration/);
  assert.match(profile, /public-profile-hero/);
  assert.match(followStats, /profile-post-count-stat/);
  assert.match(ownProfile, /ProfileFollowStats/);
  assert.match(likesRoute, /Redirect href="\/\(tabs\)\/activity"/);
  assert.match(activity, /n\.type === "reel_like"/);
  assert.match(activity, /openComments: "1"/);
  assert.match(ownProfile, /usePremiumColors/);
  assert.match(ownProfile, /user\.isVerified/);
  assert.match(tabs, /tintColor=\{colors\.premiumAccent\}/);
  assert.match(tabs, /tabBarActiveTintColor: colors\.premiumAccent/);
});
