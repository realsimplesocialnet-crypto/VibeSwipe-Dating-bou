import assert from "node:assert/strict";
import test from "node:test";
import { patchActivityReads } from "./activity-state.ts";

const notification = (id, type) => ({ id, type, actor: { id: "actor" }, matchId: null, messageId: null, reelId: null, commentId: null, createdAt: "2026-11-19T10:00:00.000Z", readAt: null });
const counts = () => ({ matches: 1, messages: 0, views: 1, likes: 1, reels: 0, follows: 1 });

test("marking an activity notification read decrements its matching unread counter", () => {
  const source = {
    notifications: [
      notification("match", "new_match"),
      notification("like", "new_like"),
      notification("view", "profile_view"),
      notification("follow", "new_follow"),
    ],
    unreadCounts: counts(),
  };
  const next = patchActivityReads(source, ["follow"], "read-at");
  assert.equal(next.unreadCounts.follows, 0);
  assert.equal(next.unreadCounts.matches, 1);
  assert.equal(next.notifications.find((item) => item.id === "follow").readAt, "read-at");
});

test("opening every supported activity type reaches zero and failed reads can be undone", () => {
  const source = {
    notifications: [
      notification("match", "new_match"),
      notification("like", "new_super_like"),
      notification("view", "profile_view"),
      notification("follow", "new_follow"),
    ],
    unreadCounts: counts(),
  };
  const all = patchActivityReads(source, ["match", "like", "view", "follow"], "read-at");
  assert.deepEqual(all.unreadCounts, { matches: 0, messages: 0, views: 0, likes: 0, reels: 0, follows: 0 });
  const restored = patchActivityReads(all, ["follow"], "read-at", true);
  assert.equal(restored.unreadCounts.follows, 1);
  assert.equal(restored.unreadCounts.likes, 0);
});
