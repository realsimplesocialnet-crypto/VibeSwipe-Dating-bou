import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPreviouslySentLikeNotifications,
  planReactionEffects,
} from "../src/lib/vibeswipeReaction.ts";

const accountA = "test-account-a";
const accountB = "test-account-b";
const superInput = {
  fromUserId: accountA, toUserId: accountB, type: "super" as const,
  previousType: null, reverseType: null, existingMatchId: null,
  targetIsDemo: false, isProduction: true,
};

test("a Super Like creates a distinct notice for the recipient, not an ordinary like", () => {
  const result = planReactionEffects(superInput);
  assert.equal(result.matched, false);
  assert.deepEqual(result.notifications, [
    { recipientId: accountB, actorId: accountA, type: "new_super_like" },
  ]);
});

test("upgrading a normal like to Super Like sends the special notice once", () => {
  assert.equal(planReactionEffects({ ...superInput, previousType: "like" }).notifications[0]?.type, "new_super_like");
  assert.deepEqual(planReactionEffects({ ...superInput, previousType: "super" }).notifications, []);
});

test("a mutual Super Like produces both match notices and the special recipient notice", () => {
  const result = planReactionEffects({ ...superInput, reverseType: "like" });
  assert.equal(result.matched, true);
  assert.equal(result.createMatch, true);
  assert.deepEqual(result.notifications.map(n => n.type), ["new_match", "new_match", "new_super_like"]);
});

test("Super Likes never create notifications for demonstration accounts", () => {
  assert.deepEqual(planReactionEffects({ ...superInput, targetIsDemo: true }).notifications, []);
});

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

test("a like notification is omitted after the same pair was notified once", () => {
  const notifications = [
    { recipientId: accountB, actorId: accountA, type: "new_like" as const },
    { recipientId: accountA, actorId: accountB, type: "new_match" as const },
  ];
  assert.deepEqual(
    filterPreviouslySentLikeNotifications(notifications, true),
    [{ recipientId: accountA, actorId: accountB, type: "new_match" }],
  );
  assert.deepEqual(filterPreviouslySentLikeNotifications(notifications, false), notifications);
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
