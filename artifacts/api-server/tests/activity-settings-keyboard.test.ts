import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { notificationPreferenceEnabled } from "../src/lib/vibeswipeReaction.ts";

const helpers = build({
  stdin: { contents: `
    export {unreadActivityIds,patchActivityReads} from "./lib/api-client-react/src/activity-seen.ts";
    export {chatViewportFrame} from "./artifacts/vibeswipe-web/src/lib/chat-viewport.ts";
  `, resolveDir: new URL("../../../", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "esm", treeShaking: true,
}).then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`));

function fixture() {
  return {
    notifications: [
      { id: "view-1", type: "profile_view", readAt: null },
      { id: "view-2", type: "profile_view", readAt: null },
      { id: "like", type: "new_like", readAt: null },
      { id: "super", type: "new_super_like", readAt: null },
      { id: "match", type: "new_match", readAt: null },
      { id: "message", type: "new_message", readAt: null },
      { id: "old", type: "profile_view", readAt: "already-read" },
    ],
    unreadCounts: { views: 2, likes: 2, matches: 1, messages: 1 },
  };
}

test("opening each category clears only its unread IDs, retaining history and messages", async () => {
  const { unreadActivityIds, patchActivityReads } = await helpers;
  for (const category of ["views", "likes", "matches"]) {
    const data = fixture();
    const ids = unreadActivityIds(data, category);
    const updated = patchActivityReads(data, ids, "read-now");
    assert.equal(updated.unreadCounts[category], 0);
    assert.equal(updated.notifications.length, data.notifications.length);
    assert.equal(updated.notifications.find(n => n.id === "message").readAt, null);
    assert.equal(updated.unreadCounts.messages, 1);
    assert.equal(updated.notifications.find(n => n.id === "old").readAt, "already-read");
    assert.equal(data.notifications[0].readAt, null, "cache snapshots must not be mutated");
    assert.deepEqual(patchActivityReads(updated, ids, "read-again"), updated, "repeated opens are idempotent");
  }
  assert.deepEqual(unreadActivityIds(fixture(), "likes"), ["like", "super"]);
});

test("a new event arriving after the captured read IDs stays new", async () => {
  const { unreadActivityIds, patchActivityReads } = await helpers;
  const data = fixture();
  const ids = unreadActivityIds(data, "views");
  data.notifications.push({ id: "new-view", type: "profile_view", readAt: null });
  data.unreadCounts.views++;
  const updated = patchActivityReads(data, ids, "read-now");
  assert.equal(updated.unreadCounts.views, 1);
  assert.equal(updated.notifications.find(n => n.id === "new-view").readAt, null);
});

test("failed acknowledgement restores only this request, not a later confirmed read", async () => {
  const { patchActivityReads } = await helpers;
  const optimistic = patchActivityReads(fixture(), ["view-1", "view-2"], "request-one");
  optimistic.notifications.find(n => n.id === "view-1").readAt = "server-confirmed";
  const restored = patchActivityReads(optimistic, ["view-1", "view-2"], "request-one", true);
  assert.equal(restored.unreadCounts.views, 1);
  assert.equal(restored.notifications.find(n => n.id === "view-1").readAt, "server-confirmed");
  assert.equal(restored.notifications.find(n => n.id === "view-2").readAt, null);
});

test("Activity follows the selected light theme while retaining activity-type colors", async () => {
  const css = await readFile(new URL("../../../artifacts/vibeswipe-web/src/components/social-hub.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /html\[data-theme="light"\] \.social-hub\.activity-screen\s*\{\s*background:#090c12/);
  assert.match(css, /html\[data-theme="light"\] \.social-hub\.activity-screen \.activity-metric-card \{[^}]*background:#fffdfe/);
  assert.match(css, /html\[data-theme="light"\] \.social-hub\.activity-screen \.activity-feed-row \{[^}]*color:#2a2328/);
  const web = await readFile(new URL("../../../artifacts/vibeswipe-web/src/components/social-hub.tsx", import.meta.url), "utf8");
  assert.match(web, /color: '#3b82f6'/);
  assert.match(web, /color: '#16a394'/);
  assert.match(web, /color: '#8b5cf6'/);
});

test("Likes and New matches settings operate independently, preserving legacy opt-outs", () => {
  const base = { notifyMatches: false, notifyLikes: true, notifyMessages: true, notifyProfileViews: true };
  assert.equal(notificationPreferenceEnabled("new_like", base), true);
  assert.equal(notificationPreferenceEnabled("new_super_like", base), true);
  assert.equal(notificationPreferenceEnabled("new_match", base), false);
  const opposite = { ...base, notifyLikes: false, notifyMatches: true };
  assert.equal(notificationPreferenceEnabled("new_like", opposite), false);
  assert.equal(notificationPreferenceEnabled("new_super_like", opposite), false);
  assert.equal(notificationPreferenceEnabled("new_match", opposite), true);
  assert.equal(notificationPreferenceEnabled("new_like", { ...base, notifyLikes: null }), false);
  assert.equal(notificationPreferenceEnabled("new_message", { ...base, notifyMessages: false }), false);
  assert.equal(notificationPreferenceEnabled("profile_view", { ...base, notifyProfileViews: false }), false);
});

test("iPhone panned viewport and Android resized viewport anchor the composer above the keyboard", async () => {
  const { chatViewportFrame } = await helpers;
  const iphone = chatViewportFrame(400, 225, 800, true);
  assert.equal(iphone.keyboardOpen, true);
  const installBanner = 56;
  assert.equal((iphone.top + installBanner) + (iphone.height - installBanner), 625);
  assert.equal(chatViewportFrame(360, 0, 760, true).keyboardOpen, true);
  assert.equal(chatViewportFrame(760, 0, 800, false).keyboardOpen, false);
  assert.equal(chatViewportFrame(740, 0, 800, true).keyboardOpen, false, "browser toolbar changes are not a keyboard");
});

test("read endpoint is recipient scoped; keyboard scrolling stays inside chat with no keyboard bottom inset", async () => {
  const root = new URL("../../../", import.meta.url);
  const [routes, web, native, social] = await Promise.all([
    readFile(new URL("artifacts/api-server/src/routes/vibeswipe-realtime.ts", root), "utf8"),
    readFile(new URL("artifacts/vibeswipe-web/src/App.tsx", root), "utf8"),
    readFile(new URL("artifacts/vibeswipe/app/chat/[matchId].tsx", root), "utf8"),
    readFile(new URL("artifacts/vibeswipe/components/SocialHub.tsx", root), "utf8"),
  ]);
  const bulk = routes.slice(routes.indexOf('router.put("/vibeswipe/notifications/read"'), routes.indexOf('router.put("/vibeswipe/notifications/:notificationId/read"'));
  assert.match(bulk, /eq\(vibeSwipeNotificationsTable.recipientId,\s*currentUserId\(req\)\)/);
  assert.match(bulk, /inArray\(vibeSwipeNotificationsTable.id,\s*body.data.notificationIds\)/);
  assert.match(web, /viewport\?\.addEventListener\('scroll',resize\)/);
  assert.match(web, /chatViewport.keyboardOpen\?0:/);
  assert.doesNotMatch(web, /bottom.current\?\.scrollIntoView/);
  assert.match(native, /marginBottom: keyboardVisible \? 0/);
  assert.match(social, /active: focused && foreground/);
});
