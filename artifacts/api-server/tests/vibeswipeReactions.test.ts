import assert from "node:assert/strict";
import test from "node:test";
import { planReactionEffects } from "../src/lib/vibeswipeReaction.ts";

const accountA = "test-account-a";
const accountB = "test-account-b";

test("a like from account A creates an Activity notification for account B", () => {
  const result = planReactionEffects({
    fromUserId: accountA,
    toUserId: accountB,
    type: "like",
    previousType: null,
    reverseType: null,
    existingMatchId: null,
    targetIsDemo: false,
    isProduction: false,
  });

  assert.equal(result.matched, false);
  assert.equal(result.createMatch, false);
  assert.deepEqual(result.notifications, [
    { recipientId: accountB, actorId: accountA, type: "new_like" },
  ]);
});

test("account B liking account A back creates one match and notifies both accounts", () => {
  const result = planReactionEffects({
    fromUserId: accountB,
    toUserId: accountA,
    type: "like",
    previousType: null,
    reverseType: "like",
    existingMatchId: null,
    targetIsDemo: false,
    isProduction: false,
  });

  assert.equal(result.matched, true);
  assert.equal(result.createMatch, true);
  assert.deepEqual(result.notifications, [
    { recipientId: accountB, actorId: accountA, type: "new_match" },
    { recipientId: accountA, actorId: accountB, type: "new_match" },
  ]);
});

test("repeating an existing like does not create duplicate like notifications", () => {
  const result = planReactionEffects({
    fromUserId: accountA,
    toUserId: accountB,
    type: "like",
    previousType: "like",
    reverseType: null,
    existingMatchId: null,
    targetIsDemo: false,
    isProduction: false,
  });

  assert.equal(result.matched, false);
  assert.deepEqual(result.notifications, []);
});

test("passing never creates a like notification or a match", () => {
  const result = planReactionEffects({
    fromUserId: accountA,
    toUserId: accountB,
    type: "pass",
    previousType: null,
    reverseType: "like",
    existingMatchId: null,
    targetIsDemo: false,
    isProduction: false,
  });

  assert.equal(result.matched, false);
  assert.equal(result.createMatch, false);
  assert.deepEqual(result.notifications, []);
});
