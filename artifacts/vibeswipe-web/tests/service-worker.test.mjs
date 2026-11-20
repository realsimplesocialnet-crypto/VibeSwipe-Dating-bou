import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadServiceWorker({ cacheEntries = new Map(), fetcher = async () => new Response(), timers = {}, networkType, online = true } = {}) {
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
    async delete(key) { return cacheEntries.delete(typeof key === "string" ? key : key.url); },
    async keys() { return [...cacheEntries.keys()].map((url) => new Request(url)); },
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
    navigator: { onLine: online, ...(networkType ? { connection: { type: networkType } } : {}) },
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
    Request,
    Headers,
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

test("notification links cannot navigate outside the VIBESWIPES app origin", async () => {
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
      const url = String(request);
      if (url.endsWith("vibeswipes-icon-512.png")) throw new Error("offline icon");
      if (url.endsWith("/index.html")) {
        return new Response(
          '<script src="/pwa-install.js?v=9"></script><script src="/pwa-launch.js?v=10"></script><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>',
          { headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.endsWith("/assets/app.js")) {
        return new Response(
          'import{a}from"./shared.js";const app=import("./admin.js");const deps=["assets/webview-app-entry-main.js","assets/index-main.css","assets/webview-app-entry-main.css","assets/admin.css"]',
        );
      }
      if (url.endsWith("/assets/shared.js")) {
        return new Response('import"./nested.js";');
      }
      if (url.endsWith("/assets/nested.js")) {
        return new Response("export const ready = true;");
      }
      if (url.endsWith("/assets/webview-app-entry-main.js")) {
        return new Response('import"./shared.js";const route=import("./discover.js")');
      }
      if (url.endsWith("/assets/app.css") || url.endsWith("/assets/index-main.css") || url.endsWith("/assets/webview-app-entry-main.css")) {
        return new Response("@font-face{font-family:App;src:url('/assets/app.woff2')}", {
          headers: { "Content-Type": "text/css" },
        });
      }
      if (url.endsWith("/assets/app.woff2")) {
        return new Response("font bytes", { headers: { "Content-Type": "font/woff2" } });
      }
      return new Response("public recovery content");
    },
  });
  let pending;
  worker.listeners.get("install")({ waitUntil(value) { pending = value; } });
  await pending;
  assert.equal(worker.didSkipWaiting(), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/offline.html"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/index.html"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/app.js"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/app.css"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/app.woff2"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/shared.js"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/nested.js"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/webview-app-entry-main.js"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/index-main.css"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/webview-app-entry-main.css"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/admin.js"), false);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/discover.js"), false);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/assets/admin.css"), false);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/pwa-launch.js?v=10"), true);
  assert.equal(worker.cacheEntries.has("https://myage.beauty/"), false);
});

test("service-worker install fails safely if an app entry asset cannot be cached", async () => {
  const worker = await loadServiceWorker({
    fetcher: async (request) => {
      if (String(request).endsWith("/index.html")) {
        return new Response('<script type="module" src="/assets/app.js"></script>', {
          headers: { "Content-Type": "text/html" },
        });
      }
      if (String(request).endsWith("/assets/app.js")) throw new Error("entry bundle unavailable");
      return new Response("public recovery content");
    },
  });
  let rejected = false;
  let pending;
  worker.listeners.get("install")({ waitUntil(value) { pending = value; } });
  try {
    await pending;
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true);
  assert.equal(worker.didSkipWaiting(), false);
});

for (const cause of ["offline", "server error", "timeout"]) {
  test(`navigation shows a dependency-free recovery page on ${cause}`, async () => {
    let abortTimer;
    let cleared = false;
    const worker = await loadServiceWorker({
      cacheEntries: new Map([["https://myage.beauty/offline.html", new Response("Reconnect to VIBESWIPES")]]),
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
    if (cause === "timeout") {
      await new Promise((resolve) => setImmediate(resolve));
      abortTimer();
    }
    assert.equal(await (await response).text(), "Reconnect to VIBESWIPES");
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

test("an approved public Reel is saved only on Wi-Fi and can serve byte-range playback offline", async () => {
  const mediaId = "123e4567-e89b-42d3-a456-426614174000";
  const reelId = "123e4567-e89b-42d3-a456-426614174001";
  const url = `https://myage.beauty/api/vibeswipe/media/${mediaId}`;
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const worker = await loadServiceWorker({
    networkType: "wifi",
    online: false,
    fetcher: async () => new Response(bytes, { status: 200, headers: {
      "Content-Type": "video/mp4",
      "X-Myage-Offline-Eligible": "public-reel",
    } }),
  });
  let messageResult;
  let pending;
  worker.listeners.get("message")({
    data: {
      type: "myage:cache-reel-offline",
      manual: false,
      mediaUrl: url,
      reel: {
        id: reelId, creatorId: "member", creatorName: "Alex",
        creatorLocation: "", creatorVerified: false, creatorPhoto: null,
        videoReference: `media:${mediaId}`, caption: "A Reel", durationSeconds: 6,
        likeCount: 0, commentCount: 0, createdAt: new Date().toISOString(),
      },
    },
    ports: [{ postMessage(result) { messageResult = result; } }],
    waitUntil(value) { pending = value; },
  });
  await pending;
  assert.equal(messageResult.ok, true);
  assert.equal(messageResult.message, "Saved for offline replay.");

  let cachedResponse;
  worker.listeners.get("fetch")({
    request: new Request(url, { headers: { Range: "bytes=2-4" } }),
    respondWith(value) { cachedResponse = value; },
  });
  const partial = await cachedResponse;
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), "bytes 2-4/6");
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [2, 3, 4]);
});

test("automatic Reel caching never downloads over cellular or caches unapproved media", async () => {
  const mediaId = "123e4567-e89b-42d3-a456-426614174000";
  const reel = {
    id: "123e4567-e89b-42d3-a456-426614174001", creatorId: "member",
    creatorName: "Alex", creatorLocation: "",
    creatorVerified: false, creatorPhoto: null, videoReference: `media:${mediaId}`,
    caption: "", durationSeconds: 5, likeCount: 0, commentCount: 0,
    createdAt: new Date().toISOString(),
  };
  let fetchCount = 0;
  const worker = await loadServiceWorker({
    networkType: "cellular",
    fetcher: async () => { fetchCount++; return new Response("video"); },
  });
  let pending;
  let result;
  worker.listeners.get("message")({
    data: { type: "myage:cache-reel-offline", mediaUrl: `https://myage.beauty/api/vibeswipe/media/${mediaId}`, reel, manual: false },
    ports: [{ postMessage(value) { result = value; } }],
    waitUntil(value) { pending = value; },
  });
  await pending;
  assert.equal(fetchCount, 0);
  assert.equal(result.ok, false);

  const unapproved = await loadServiceWorker({
    networkType: "wifi",
    fetcher: async () => new Response("video", { headers: { "Content-Type": "video/mp4" } }),
  });
  unapproved.listeners.get("message")({
    data: { type: "myage:cache-reel-offline", mediaUrl: `https://myage.beauty/api/vibeswipe/media/${mediaId}`, reel, manual: false },
    ports: [{ postMessage(value) { result = value; } }],
    waitUntil(value) { pending = value; },
  });
  await pending;
  assert.equal(result.ok, false);
  assert.equal([...unapproved.cacheEntries.keys()].some((key) => key === `https://myage.beauty/api/vibeswipe/media/${mediaId}`), false);
});

test("a user-confirmed Wi-Fi fallback works when the browser hides network type", async () => {
  const mediaId = "123e4567-e89b-42d3-a456-426614174000";
  const reel = {
    id: "123e4567-e89b-42d3-a456-426614174001", creatorId: "member",
    creatorName: "Alex", creatorLocation: "",
    creatorVerified: false, creatorPhoto: null, videoReference: `media:${mediaId}`,
    caption: "", durationSeconds: 5, likeCount: 0, commentCount: 0,
    createdAt: new Date().toISOString(),
  };
  const worker = await loadServiceWorker({
    fetcher: async () => new Response(new Uint8Array([1]), { headers: {
      "Content-Type": "video/mp4",
      "X-Myage-Offline-Eligible": "public-reel",
    } }),
  });
  let pending;
  let result;
  worker.listeners.get("message")({
    data: {
      type: "myage:cache-reel-offline", mediaUrl: `https://myage.beauty/api/vibeswipe/media/${mediaId}`,
      reel, manual: true, confirmedUnknownWifi: true,
    },
    ports: [{ postMessage(value) { result = value; } }],
    waitUntil(value) { pending = value; },
  });
  await pending;
  assert.equal(result.ok, true);
});
