import assert from "node:assert/strict";
import test from "node:test";
import { planNewFollowNotification } from "../src/lib/vibeswipeFollowPolicy.ts";

test("a new follow sends one notice to the followed member", () => {
  assert.deepEqual(planNewFollowNotification({
    followerId: "matty",
    followedId: "lily",
    inserted: true,
  }), {
    recipientId: "lily",
    actorId: "matty",
    type: "new_follow",
  });
});

test("an idempotent follow does not send another notice", () => {
  assert.equal(planNewFollowNotification({
    followerId: "matty",
    followedId: "lily",
    inserted: false,
  }), null);
});

test("self-follow cannot create a follow notice", () => {
  assert.equal(planNewFollowNotification({
    followerId: "matty",
    followedId: "matty",
    inserted: true,
  }), null);
});

test("mutual follows send follow notices, not dating-match effects", () => {
  const mattyFollowsLily = planNewFollowNotification({
    followerId: "matty",
    followedId: "lily",
    inserted: true,
  });
  const lilyFollowsMatty = planNewFollowNotification({
    followerId: "lily",
    followedId: "matty",
    inserted: true,
  });
  assert.deepEqual([mattyFollowsLily?.type, lilyFollowsMatty?.type], ["new_follow", "new_follow"]);
  assert.equal("createMatch" in (mattyFollowsLily ?? {}), false);
});
