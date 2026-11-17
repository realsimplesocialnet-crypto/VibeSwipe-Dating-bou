import test from "node:test";
import assert from "node:assert/strict";
import { totalUnreadMessages, unreadBadgeLabel } from "../../vibeswipe-web/src/lib/unread-messages.ts";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("message tab unread count totals accessible conversations and excludes blocked ones", () => {
  assert.equal(totalUnreadMessages([
    { unreadCount: 4 },
    { unreadCount: 2 },
    { unreadCount: 10, blockedByMe: true },
    { unreadCount: 5, blockedMe: true },
    { unreadCount: null },
  ]), 6);
  assert.equal(totalUnreadMessages([]), 0);
});

test("message tab badge caps display without changing the accessible total", () => {
  assert.equal(unreadBadgeLabel(9), "9");
  assert.equal(unreadBadgeLabel(99), "99");
  assert.equal(unreadBadgeLabel(125), "99+");
});

test("the pink unread badge appears on mobile and desktop Messages navigation", () => {
  const app = source("artifacts/vibeswipe-web/src/App.tsx");
  assert.match(app, /badge-mobile-unread-messages/);
  assert.match(app, /badge-sidebar-unread-messages/);
  assert.match(app, /bg-primary px-1 text-\[10px\] font-extrabold/);
  assert.match(app, /refetchInterval: 10_000/);
});
