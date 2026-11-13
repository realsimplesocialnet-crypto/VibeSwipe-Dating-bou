import assert from "node:assert/strict";
import test from "node:test";
import { getQueuedVideoProfiles } from "../lib/videoPreloadQueue.ts";

test("Discover keeps a processed MP4 media reference in its preload window", () => {
  const processedVideoReference = "media:00000000-0000-4000-8000-000000000001";
  const profiles = [
    { id: "before", videoUrl: null },
    { id: "active", videoUrl: processedVideoReference },
    { id: "next", videoUrl: "media:00000000-0000-4000-8000-000000000002" },
    { id: "after-window", videoUrl: "media:00000000-0000-4000-8000-000000000003" },
  ];

  assert.deepEqual(getQueuedVideoProfiles(profiles, 1), profiles.slice(1, 4));
});

test("Discover only preloads videos in the active profile's three-item window", () => {
  const profiles = [
    { id: "one", videoUrl: "media:video-one" },
    { id: "two", videoUrl: null },
    { id: "three", videoUrl: "media:video-three" },
    { id: "four", videoUrl: "media:video-four" },
    { id: "five", videoUrl: "media:video-five" },
  ];

  assert.deepEqual(getQueuedVideoProfiles(profiles, 1), [profiles[2], profiles[3]]);
});
