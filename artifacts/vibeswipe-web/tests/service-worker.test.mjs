import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadServiceWorker() {
  const source = await readFile(
    new URL("../public/service-worker.js", import.meta.url),
    "utf8",
  );
  const listeners = new Map();
  const shownNotifications = [];
  const navigated = [];
  const focused = [];
  const windowClient = {
    url: "https://myage.beauty/",
    async navigate(url) {
      navigated.push(url);
      return windowClient;
    },
    async focus() {
      focused.push(true);
      return windowClient;
    },
  };
  const self = {
    registration: {
      scope: "https://myage.beauty/",
      async showNotification(title, options) {
        shownNotifications.push({ title, options });
      },
    },
    clients: {
      async matchAll() {
        return [windowClient];
      },
      async openWindow(url) {
        navigated.push(url);
      },
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
  };
  vm.runInNewContext(source, {
    self,
    URL,
    caches: {},
    fetch: async () => new Response(),
    Response,
  });
  return { listeners, shownNotifications, navigated, focused };
}

test("message push shows sender and preview in a notification", async () => {
  const { listeners, shownNotifications } = await loadServiceWorker();
  let pending;
  listeners.get("push")({
    data: {
      json: () => ({
        title: "Ada",
        body: "Hello from the chat",
        data: { matchId: "match-1", url: "chat/match-1" },
      }),
    },
    waitUntil(value) {
      pending = value;
    },
  });
  await pending;

  assert.equal(shownNotifications[0].title, "Ada");
  assert.equal(shownNotifications[0].options.body, "Hello from the chat");
  assert.equal(shownNotifications[0].options.data.matchId, "match-1");
});

test("tapping a message notification opens its chat in the installed app", async () => {
  const { listeners, navigated, focused } = await loadServiceWorker();
  let pending;
  listeners.get("notificationclick")({
    notification: {
      data: { url: "chat/match-1" },
      close() {},
    },
    waitUntil(value) {
      pending = value;
    },
  });
  await pending;

  assert.deepEqual(navigated, ["https://myage.beauty/chat/match-1"]);
  assert.equal(focused.length, 1);
});

test("notification links cannot navigate outside the Myage app origin", async () => {
  const { listeners, navigated } = await loadServiceWorker();
  let pending;
  listeners.get("notificationclick")({
    notification: { data: { url: "https://example.com/fake" }, close() {} },
    waitUntil(value) {
      pending = value;
    },
  });
  await pending;

  assert.deepEqual(navigated, ["https://myage.beauty/"]);
});
