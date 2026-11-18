import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mixReelsByCreator } from "../src/lib/reels-feed-order.ts";

const feedSource = readFileSync(new URL("../src/pages/reels-feed.tsx", import.meta.url), "utf8");

test("general Reels batches rotate creators without dropping or reordering a creator's posts", () => {
  const input = [
    { id: "a1", creatorId: "a" },
    { id: "a2", creatorId: "a" },
    { id: "a3", creatorId: "a" },
    { id: "b1", creatorId: "b" },
    { id: "c1", creatorId: "c" },
    { id: "b2", creatorId: "b" },
  ];
  const mixed = mixReelsByCreator(input);
  assert.deepEqual(mixed.map((reel) => reel.id), ["a1", "b1", "c1", "a2", "b2", "a3"]);
  assert.deepEqual(new Set(mixed.map((reel) => reel.id)), new Set(input.map((reel) => reel.id)));
  for (const creatorId of ["a", "b", "c"]) {
    assert.deepEqual(
      mixed.filter((reel) => reel.creatorId === creatorId).map((reel) => reel.id),
      input.filter((reel) => reel.creatorId === creatorId).map((reel) => reel.id),
    );
  }
});

test("a batch starts with a different creator when possible and profile Reels stay in profile order", () => {
  const next = mixReelsByCreator([
    { id: "a1", creatorId: "a" },
    { id: "a2", creatorId: "a" },
    { id: "b1", creatorId: "b" },
  ], "a");
  assert.equal(next[0].creatorId, "b");
  assert.match(feedSource, /const pageItems = profileId\s*\?\s*page\.items\s*:\s*mixReelsByCreator/);
});
