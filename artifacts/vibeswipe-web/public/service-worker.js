/* Static shell only. Never cache API, Clerk, private messages, or uploaded media. */
const CACHE_NAME = 'vibeswipe-shell-v2';
const scopeUrl = new URL(self.registration.scope);
const shell = [
  scopeUrl.href,
  new URL('manifest.json', scopeUrl).href,
  new URL('icon.png', scopeUrl).href,
  new URL('icon-192.png', scopeUrl).href,
  new URL('icon-512.png', scopeUrl).href,
  new URL('logo.svg', scopeUrl).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('vibeswipe-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    ))
      .then(() => self.clients.claim()),
  );
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
