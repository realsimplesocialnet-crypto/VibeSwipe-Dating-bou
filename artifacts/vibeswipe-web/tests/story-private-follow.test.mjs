import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const storyUi = read("../src/components/stories/stories-ui.tsx");
const socialHub = read("../src/components/social-hub.tsx");
const storyApi = read("../../api-server/src/routes/vibeswipe-stories.ts");
const mediaApi = read("../../api-server/src/routes/vibeswipe.ts");
const followRule = read("../../api-server/src/lib/vibeswipeStories.ts");

test("profiles open stories only after both accounts follow each other", () => {
  assert.match(app, /followSummary\.data\?\.isFollowing&&followSummary\.data\?\.followsYou/);
  assert.match(app, /<ProfileStoryAvatar profile=\{profile\} storyGroup=\{profileStory\}\/>/);
  assert.match(app, /storyFeed\.data\?\.mutualFollows\.find\(group=>group\.poster\.id===profile\.id\)/);
});

test("story view stays on the profile and supports pink follow, like, and share actions", () => {
  assert.match(storyUi, /<StoryViewer active=\{active\} onClose=\{\(\) => setActive\(null\)\} \/>/);
  assert.match(storyUi, /window\.history\.pushState\(\{ myageStoryViewer: true \}, "", window\.location\.href\)/);
  assert.match(storyUi, /window\.history\.back\(\)/);
  assert.match(storyUi, /handlePopState/);
  assert.match(storyUi, /data-testid="button-story-follow"[^>]+bg-primary/);
  assert.match(storyUi, /data-testid="button-story-share"/);
  assert.match(storyUi, /data-testid="button-like-story"/);
  assert.match(storyUi, /if \(!current \|\| !active\?\.profileId \|\| likeStory\.isPending/);
});

test("story lists, likes, views, and media reads enforce unblocked mutual follows", () => {
  assert.match(followRule, /hasUnblockedMutualFollowBetween/);
  assert.match(followRule, /vibeSwipeFollowsTable\.followerId/);
  assert.match(followRule, /blocksTable\.blockerId/);
  assert.match(storyApi, /mutualFollows/);
  assert.match(storyApi, /hasUnblockedMutualFollowBetween/);
  assert.match(mediaApi, /hasUnblockedMutualFollowBetween/);
  assert.match(mediaApi, /Follow each other to reply to a story/);
});

test("new follower rows show Follow back using the app's pink", () => {
  assert.match(socialHub, /aria-label="New followers"/);
  assert.match(socialHub, /ProfileFollowNotificationAction profileId=\{n\.actor\.id\}/);
  assert.match(read("../src/components/social-hub.css"), /background:#F34E9A/);
});
