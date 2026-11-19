import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("privacy controls are persisted in the profile schema", () => {
  const profiles = source("lib/db/src/schema/vibeswipe.ts");
  for (const field of ["privateAccount", "whoCanComment", "whoCanMessage", "allowDownloads", "likedVideoAudience"]) {
    assert.match(profiles, new RegExp(`${field}:`), field);
  }
  const reels = source("lib/db/src/schema/vibeswipe-reels.ts");
  assert.match(reels, /audience: text\("audience"\)/);
  assert.match(reels, /vibeswipe_reel_not_interested/);
  assert.match(source("lib/db/src/schema/vibeswipe-social.ts"), /vibeswipe_follow_requests/);
});

test("server helpers enforce private profiles, follow-only settings and blocks", () => {
  const privacy = source("artifacts/api-server/src/lib/profile-privacy.ts");
  assert.match(privacy, /canViewUserProfile/);
  assert.match(privacy, /privateAccount: profilesTable\.privateAccount/);
  assert.match(privacy, /if \(await isBlockedBetween\(viewerId, ownerId\)\) return false/);
  assert.match(privacy, /canViewLikedVideos/);
  assert.match(privacy, /canStartChat/);
  assert.match(privacy, /canCommentOnReel/);
});

test("private follow requests, direct chat, Reel audiences and downloads have server routes", () => {
  const social = source("artifacts/api-server/src/routes/vibeswipe-social.ts");
  assert.match(social, /\/vibeswipe\/follow-requests/);
  assert.match(social, /\/vibeswipe\/follow-requests\/:requesterId\/approve/);
  assert.match(social, /\/vibeswipe\/follow-requests\/:requesterId\/decline/);
  const direct = source("artifacts/api-server/src/routes/vibeswipe-direct-chats.ts");
  assert.match(direct, /\/vibeswipe\/direct-chats/);
  assert.match(direct, /\/vibeswipe\/direct-chat-messages/);
  assert.match(direct, /canStartChat/);
  const reels = source("artifacts/api-server/src/routes/vibeswipe-reels.ts");
  assert.match(reels, /\/vibeswipe\/profile-liked-reels/);
  assert.match(reels, /\/vibeswipe\/reels\/:reelId\/download/);
  assert.match(reels, /\/vibeswipe\/reels\/:reelId\/not-interested/);
  assert.match(reels, /canCommentOnReel/);
});

test("web and Expo settings expose the same persisted privacy choices", () => {
  const web = source("artifacts/vibeswipe-web/src/components/settings/settings-pages.tsx");
  const native = source("artifacts/vibeswipe/app/settings.tsx");
  for (const app of [web, native]) {
    for (const label of ["Everyone", "Followers only", "No one", "Only me", "Private account", "Allow downloads"]) {
      assert.ok(app.includes(label), `${label} is present`);
    }
  }
  assert.match(source("artifacts/vibeswipe-web/src/pages/reel-composer.tsx"), /Public|Friends/);
});

test("Reels menu and profile lists use server privacy controls", () => {
  const webFeed = source("artifacts/vibeswipe-web/src/pages/reels-feed.tsx");
  const nativeReel = source("artifacts/vibeswipe/app/reels/[reelId].tsx");
  for (const app of [webFeed, nativeReel]) {
    assert.match(app, /Not interested/);
    assert.match(app, /canDownload/);
  }
  assert.match(source("artifacts/vibeswipe-web/src/components/profile-reels-section.tsx"), /ProfileLikedReelsSection/);
  assert.match(source("artifacts/vibeswipe/components/ProfileReelsSection.tsx"), /ProfileLikedReelsSection/);
  assert.doesNotMatch(webFeed, /creatorAge/);
  assert.doesNotMatch(nativeReel, /creatorAge/);
});
