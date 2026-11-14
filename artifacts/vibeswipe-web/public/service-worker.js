/* Static shell only. Never cache API, Clerk, private messages, or uploaded media. */
const CACHE_NAME = 'myage-shell-v8';
const scopeUrl = new URL(self.registration.scope);
const shell = [
  scopeUrl.href,
  new URL('manifest.json', scopeUrl).href,
  new URL('myage-icon-192-v7.png', scopeUrl).href,
  new URL('myage-icon-512-v7.png', scopeUrl).href,
  new URL('myage-apple-touch-v7.png', scopeUrl).href,
  new URL('myage-pwa-icon.svg?v=7', scopeUrl).href,
  new URL('logo.svg', scopeUrl).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (key.startsWith('vibeswipe-shell-') || key.startsWith('myage-shell-')) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    payload = { body: event.data?.text?.() ?? '' };
  }
  const title = typeof payload.title === 'string' ? payload.title : 'New message';
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  event.waitUntil(Promise.all([self.registration.showNotification(title, {
    body: typeof payload.body === 'string' ? payload.body : 'You have a new message.',
    icon: new URL('myage-icon-192-v7.png', scopeUrl).href,
    badge: new URL('myage-icon-192-v7.png', scopeUrl).href,
    tag: typeof data.matchId === 'string' ? `message-${data.matchId}` : 'myage-message',
    renotify: true,
    silent: false,
    data,
  }), self.clients.matchAll({ type: 'window' }).then(windows => {
    for (const client of windows) client.postMessage({ type: 'myage:new-message', matchId: data.matchId });
  })]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedPath = event.notification.data?.url;
  let target = new URL('./', scopeUrl);
  if (typeof requestedPath === 'string') {
    try {
      const candidate = new URL(requestedPath, scopeUrl);
      if (candidate.origin === scopeUrl.origin && candidate.pathname.startsWith(scopeUrl.pathname)) {
        target = candidate;
      }
    } catch {
      // Keep the safe app root when notification data is malformed.
    }
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (
        clientUrl.origin !== scopeUrl.origin ||
        !clientUrl.pathname.startsWith(scopeUrl.pathname)
      ) {
        continue;
      }
      try {
        const destination = await client.navigate(target.href);
        return (destination || client).focus();
      } catch {
        // Open a fresh app window below if this browser cannot navigate an existing one.
      }
    }
    return self.clients.openWindow(target.href);
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  if (/\/(?:api|storage|__clerk)(?:\/|$)/i.test(url.pathname) || /clerk/i.test(url.hostname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(scopeUrl.href)) || Response.error();
    }));
    return;
  }

  // Stable install metadata must refresh online rather than keeping old launch behavior.
  if (/\/(?:manifest\.json|pwa-install\.js)$/.test(url.pathname)) {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }

  const isStaticAsset = /\.(?:js|css|svg|png|ico|woff2?|ttf|webmanifest|json)$/i.test(url.pathname);
  if (!isStaticAsset) return;
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  }));
});
