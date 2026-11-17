import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const root = new URL("../../../", import.meta.url);
const text = (file: string) => readFile(new URL(file, root), "utf8");

test("background worker shows repeated message alerts and refreshes open conversations", async () => {
  const source = await text("artifacts/vibeswipe-web/public/service-worker.js");
  const handlers = new Map<string, (event: unknown) => void>();
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const received: unknown[] = [];
  runInNewContext(source, {
    URL,
    self: {
      registration: {
        scope: "https://example.test/app/",
        showNotification: async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }); },
      },
      addEventListener: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback),
      clients: { matchAll: async () => [{ postMessage: (data: unknown) => received.push(data) }] },
    },
  });
  for (const body of ["Hello", "Are you there?"]) {
    let done: Promise<unknown> | undefined;
    handlers.get("push")!({
      data: { json: () => ({ title: "A match", body, data: { matchId: "match-one", url: "chat/match-one" } }) },
      waitUntil: (promise: Promise<unknown>) => { done = promise; },
    });
    await done;
  }
  assert.equal(shown.length, 2);
  assert.equal(shown[1].options.body, "Are you there?");
  assert.equal(shown[1].options.renotify, true);
  assert.equal(shown[1].options.silent, false);
  assert.equal(shown[1].options.tag, "message-match-one");
  assert.equal(received.length, 2);
  assert.equal((received[0] as { type: string }).type, "myage:new-message");
});

test("existing browser subscriptions are confirmed with the server, including after focus and reconnect", async () => {
  const source = await text("artifacts/vibeswipe-web/src/components/WebPushSettings.tsx");
  assert.doesNotMatch(source, /setEnabled\(Boolean\(subscription\)\)/);
  assert.match(source, /saveSubscription.mutateAsync\(\{ data: subscriptionInput\(subscription\) \}\)/);
  assert.match(source, /usesApplicationKey\(subscription, key\)/);
  assert.match(source, /window.addEventListener\("online", reconnect\)/);
  assert.match(source, /document.addEventListener\("visibilitychange", reconnect\)/);
  assert.match(source, /existing.unsubscribe\(\)/, "old application keys must not be silently reused");
  const app = await text("artifacts/vibeswipe-web/src/App.tsx");
  assert.match(app, /<WebPushSettings key=\{profile\.data\.id\} compact visible=\{showMainNavigation && !isReelsViewer\} accountId=\{profile\.data\.id\}/);
});

test("push respects message opt-outs and native enrollment keeps explicit device opt-outs", async () => {
  const [server, bridge, settings] = await Promise.all([
    text("artifacts/api-server/src/lib/vibeswipePush.ts"),
    text("artifacts/vibeswipe/components/PushNotificationBridge.tsx"),
    text("artifacts/vibeswipe/components/PushNotificationSettings.tsx"),
  ]);
  assert.match(server, /if \(!recipient\?\.notifyMessages\) return/);
  assert.match(bridge, /if \(await devicePushOptedOut\(accountId\)\) return/);
  assert.match(settings, /setDevicePushOptOut\(profile.data.id, true\)/);
  assert.match(settings, /setDevicePushOptOut\(profile.data.id, false\)/);
  const permissionFlow = settings.slice(settings.indexOf("async function toggleNotifications"));
  assert.ok(permissionFlow.indexOf("await prepareMessageChannel()") < permissionFlow.indexOf("Notifications.requestPermissionsAsync()"));
});
