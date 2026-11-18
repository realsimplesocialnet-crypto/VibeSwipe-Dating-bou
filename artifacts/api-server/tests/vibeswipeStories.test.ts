import assert from "node:assert/strict";
import test from "node:test";
import {
  canViewStory,
  STORY_LIFETIME_MS,
  storyExpiresAt,
} from "../src/lib/vibeswipeStoryRules.ts";
import {
  MAX_STORY_VIDEO_DURATION_SECONDS,
  ProfileVideoValidationError,
  validateTranscodedProfileVideo,
} from "../src/lib/profileVideoTranscoder.ts";

test("stories expire exactly 24 hours after creation", () => {
  const createdAt = new Date("2026-11-14T12:00:00.000Z");
  const expiresAt = storyExpiresAt(createdAt);
  assert.equal(expiresAt.getTime() - createdAt.getTime(), STORY_LIFETIME_MS);
  assert.equal(expiresAt.toISOString(), "2026-11-15T12:00:00.000Z");
});

test("only the owner or an unblocked mutual follower can view a story", () => {
  assert.equal(
    canViewStory({
      viewerId: "viewer",
      ownerId: "viewer",
      hasMutualFollow: false,
    }),
    true,
  );
  assert.equal(
    canViewStory({
      viewerId: "stranger",
      ownerId: "owner",
      hasMutualFollow: false,
    }),
    false,
  );
  assert.equal(
    canViewStory({
      viewerId: "mutual-follower",
      ownerId: "owner",
      hasMutualFollow: true,
    }),
    true,
  );
  assert.equal(
    canViewStory({
      viewerId: "blocked-follower",
      ownerId: "owner",
      hasMutualFollow: false,
    }),
    false,
  );
});

test("story video validation allows at most 60 seconds", () => {
  assert.doesNotThrow(() =>
    validateTranscodedProfileVideo(
      { size: 1024, duration: 60, width: 720, height: 1280 },
      MAX_STORY_VIDEO_DURATION_SECONDS,
    ),
  );
  assert.throws(
    () =>
      validateTranscodedProfileVideo(
        { size: 1024, duration: 60.01, width: 720, height: 1280 },
        MAX_STORY_VIDEO_DURATION_SECONDS,
      ),
    ProfileVideoValidationError,
  );
});
