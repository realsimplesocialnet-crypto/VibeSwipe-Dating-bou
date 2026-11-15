import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadServiceWorker({ cacheEntries = new Map(), fetcher = async () => new Response(), timers = {} } = {}) {
  const source = await readFile(
    new URL("../public/service-worker.js", import.meta.url),
    "utf8",
  );
  const listeners = new Map();
  const shownNotifications = [];
  const navigated = [];
  const focused = [];
  const postedMessages = [];
  let skippedWaiting = false;
  const cache = {
    async put(key, value) { cacheEntries.set(typeof key === "string" ? key : key.url, value); },
    async match(key) { return cacheEntries.get(typeof key === "string" ? key : key.url)?.clone(); },
  };
  const windowClient = {
    url: "https://myage.beauty/",
    postMessage(message) { postedMessages.push(message); },
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
    async skipWaiting() { skippedWaiting = true; },
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
    caches: { async open() { return cache; }, async match(key) { return cache.match(key); } },
    fetch: fetcher,
    Response,
    AbortController,
    setTimeout: timers.setTimeout ?? setTimeout,
    clearTimeout: timers.clearTimeout ?? clearTimeout,
  });
  return { listeners, shownNotifications, navigated, focused, postedMessages, cacheEntries, didSkipWaiting: () => skippedWaiting };
}

test("message push shows sender and preview in a notification", async () => {
  const { listeners, shownNotifications, postedMessages } = await loadServiceWorker();
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
  assert.equal(postedMessages[0].type, "myage:new-message");
  assert.equal(postedMessages[0].matchId, "match-1");
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

test("one failed optional icon does not prevent service-worker installation", async () => {
  const worker = await loadServiceWorker({
    fetcher: async (request) => {
      if (String(request).endsWith("myage-icon-512-v7.png")) throw new Error("offline icon");
      return new Response("public recovery content");
    },
  });
  let pending;
  worker.listeners.get("install")({ waitUntil(value) { pending = value; } });
  await pending;
  assert.equal(worker.didSkipWaiting(), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/offline.html"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/"), false);
});

for (const cause of ["offline", "server error", "timeout"]) {
  test(`navigation shows a dependency-free recovery page on ${cause}`, async () => {
    let abortTimer;
    let cleared = false;
    const worker = await loadServiceWorker({
      cacheEntries: new Map([["https://myage.beauty/offline.html", new Response("Reconnect to Myage")]]),
      fetcher: async (_request, options) => {
        if (cause === "offline") throw new Error("network down");
        if (cause === "server error") return new Response("bad gateway", { status: 502 });
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      },
      timers: {
        setTimeout(callback) { abortTimer = callback; return 1; },
        clearTimeout() { cleared = true; },
      },
    });
    let response;
    worker.listeners.get("fetch")({
      request: { method: "GET", mode: "navigate", url: "https://myage.beauty/chat/match-1" },
      respondWith(value) { response = value; },
    });
    if (cause === "timeout") abortTimer();
    assert.equal(await (await response).text(), "Reconnect to Myage");
    assert.equal(cleared, true);
  });
}

test("private API, auth and uploaded media never enter the worker cache", async () => {
  const worker = await loadServiceWorker();
  for (const path of ["/api/vibeswipe/media/123", "/storage/private/photo.png", "/__clerk/client.json"]) {
    let intercepted = false;
    worker.listeners.get("fetch")({
      request: { method: "GET", mode: "navigate", url: `https://myage.beauty${path}` },
      respondWith() { intercepted = true; },
    });
    assert.equal(intercepted, false, path);
  }
});
