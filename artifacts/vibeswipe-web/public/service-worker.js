/* Cache the app shell, approved public Reels, and account-scoped recent profiles. */
const CACHE_NAME = 'myage-shell-v20';
const REEL_CACHE_NAME = 'myage-offline-reels-v1';
const PROFILE_CACHE_NAME = 'myage-offline-profiles-v1';
const MAX_OFFLINE_REELS = 3;
const MAX_OFFLINE_REEL_BYTES = 50 * 1024 * 1024;
const MAX_OFFLINE_TOTAL_BYTES = 120 * 1024 * 1024;
const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OFFLINE_PROFILES = 20;
const MAX_OFFLINE_PROFILE_PHOTOS = 40;
const MAX_OFFLINE_PROFILE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const scopeUrl = new URL(self.registration.scope);
const offlineUrl = new URL('offline.html', scopeUrl).href;
const appShellUrl = new URL('index.html', scopeUrl).href;
let activeProfileCacheUserId = null;
const shell = [
  new URL('open.html', scopeUrl).href,
  new URL('manifest.json', scopeUrl).href,
  new URL('vibeswipes-icon-192.png', scopeUrl).href,
  new URL('vibeswipes-icon-512.png', scopeUrl).href,
  new URL('vibeswipes-apple-touch.png', scopeUrl).href,
  new URL('logo.svg?v=1', scopeUrl).href,
  new URL('logo.svg', scopeUrl).href,
];

function appEntryAssets(html) {
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const asset = new URL(match[1], appShellUrl);
      if (
        asset.origin === scopeUrl.origin &&
        asset.pathname.startsWith(scopeUrl.pathname) &&
        /\.(?:m?js|css)$/i.test(asset.pathname)
      ) assets.add(asset.href);
    } catch {
      // Ignore malformed or external references in the document.
    }
  }
  return [...assets];
}

async function cacheAppEntryAssets(cache, html) {
  const assets = appEntryAssets(html);
  if (!assets.some((url) => /\.m?js(?:$|\?)/i.test(url))) {
    throw new Error('The VIBESWIPES app entry script could not be found.');
  }
  await Promise.all(assets.map(async (url) => {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('A VIBESWIPES app entry asset could not be downloaded.');
    await cache.put(url, response);
  }));
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(request, { signal: controller.signal, cache: 'no-cache' });
  } finally {
    clearTimeout(timer);
  }
}

function currentNetworkType() {
  return self.navigator?.connection?.type?.toLowerCase?.() ?? 'unknown';
}

function offlineMetadataUrl(reelId) {
  return new URL(`__offline-reels/${reelId}.json`, scopeUrl).href;
}

function safeOfflineReel(input) {
  if (!input || typeof input !== 'object' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id ?? '')) return null;
  if (typeof input.videoReference !== 'string' || !/^media:[0-9a-f-]{36}$/i.test(input.videoReference)) return null;
  if (typeof input.creatorName !== 'string' || typeof input.caption !== 'string') return null;
  return {
    id: input.id,
    creatorId: String(input.creatorId ?? ''),
    creatorName: input.creatorName,
    creatorLocation: String(input.creatorLocation ?? ''),
    creatorVerified: Boolean(input.creatorVerified),
    creatorPhoto: typeof input.creatorPhoto === 'string' ? input.creatorPhoto : null,
    videoReference: input.videoReference,
    caption: input.caption,
    durationSeconds: Number.isFinite(input.durationSeconds) ? input.durationSeconds : null,
    likeCount: Number.isFinite(input.likeCount) ? input.likeCount : 0,
    commentCount: Number.isFinite(input.commentCount) ? input.commentCount : 0,
    likedByMe: false,
    savedByMe: false,
    isOwner: false,
    createdAt: input.createdAt instanceof Date ? input.createdAt.toISOString() : String(input.createdAt ?? ''),
  };
}

async function readBoundedVideo(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_OFFLINE_REEL_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_OFFLINE_REEL_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function offlineReelRecords(cache) {
  const records = [];
  for (const request of await cache.keys()) {
    if (!new URL(request.url).pathname.includes('/__offline-reels/')) continue;
    const response = await cache.match(request);
    if (!response) continue;
    try {
      const record = await response.json();
      if (record?.reel?.id && record.videoUrl && Number.isFinite(record.savedAt) && Number.isFinite(record.bytes)) {
        records.push({ ...record, metadataUrl: request.url });
      }
    } catch {
      await cache.delete(request);
    }
  }
  return records;
}

async function cachedOfflineReelRecord(cache, videoUrl) {
  const record = (await offlineReelRecords(cache)).find((entry) => entry.videoUrl === videoUrl);
  if (!record) return null;
  if (Date.now() - record.savedAt <= MAX_OFFLINE_AGE_MS) return record;
  await cache.delete(record.videoUrl);
  await cache.delete(record.metadataUrl);
  return null;
}

async function trimOfflineReels(cache) {
  const records = (await offlineReelRecords(cache)).sort((a, b) => a.savedAt - b.savedAt);
  const now = Date.now();
  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index];
    if (now - record.savedAt <= MAX_OFFLINE_AGE_MS) continue;
    await cache.delete(record.videoUrl);
    await cache.delete(record.metadataUrl);
    records.splice(index, 1);
  }
  let total = records.reduce((sum, record) => sum + record.bytes, 0);
  while (records.length > MAX_OFFLINE_REELS || total > MAX_OFFLINE_TOTAL_BYTES) {
    const oldest = records.shift();
    if (!oldest) break;
    await cache.delete(oldest.videoUrl);
    await cache.delete(oldest.metadataUrl);
    total -= oldest.bytes;
  }
}

async function cacheOfflineReel(data) {
  const reel = safeOfflineReel(data?.reel);
  if (!reel) return { ok: false, message: 'This Reel cannot be saved offline.' };
  const mediaUrl = new URL(String(data.mediaUrl ?? ''), scopeUrl);
  const mediaId = reel.videoReference.slice(6);
  if (mediaUrl.origin !== scopeUrl.origin ||
      !mediaUrl.pathname.startsWith(scopeUrl.pathname) ||
      !new RegExp(`/api/vibeswipe/media/${mediaId}$`).test(mediaUrl.pathname)) {
    return { ok: false, message: 'This Reel cannot be saved offline.' };
  }
  const network = currentNetworkType();
  if (network === 'cellular') return { ok: false, message: 'Connect to Wi-Fi to save this video offline.' };
  if (network !== 'wifi' && data.confirmedWifi !== true &&
      !(data.manual === true && data.confirmedUnknownWifi === true)) {
    return { ok: false, message: 'Your browser cannot confirm Wi-Fi. Use Save offline only after connecting to Wi-Fi.' };
  }

  const cache = await caches.open(REEL_CACHE_NAME);
  const existing = await cache.match(mediaUrl.href);
  if (existing) return { ok: true, message: 'This video is already saved for offline replay.' };

  let response;
  try {
    response = await fetch(mediaUrl.href, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    return { ok: false, message: 'Could not download this video. Check your connection and try again.' };
  }
  if (!response.ok || response.status !== 200 ||
      response.headers.get('x-myage-offline-eligible') !== 'public-reel' ||
      !response.headers.get('content-type')?.toLowerCase().startsWith('video/')) {
    return { ok: false, message: 'This video is not available to save offline.' };
  }
  const bytes = await readBoundedVideo(response);
  if (!bytes) return { ok: false, message: 'This video is too large to save offline (50 MB maximum).' };

  const contentType = response.headers.get('content-type') || 'video/mp4';
  await cache.put(mediaUrl.href, new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Accept-Ranges': 'bytes',
    },
  }));
  const record = {
    reel,
    videoUrl: mediaUrl.href,
    savedAt: Date.now(),
    bytes: bytes.byteLength,
  };
  await cache.put(offlineMetadataUrl(reel.id), new Response(JSON.stringify(record), {
    headers: { 'Content-Type': 'application/json' },
  }));
  await trimOfflineReels(cache);
  const stillCached = await cache.match(mediaUrl.href);
  return stillCached
    ? { ok: true, message: 'Saved for offline replay.' }
    : { ok: false, message: 'This video could not fit in the offline storage limit.' };
}

async function cachedRangeResponse(response, range) {
  if (!range) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */0' } });
  const bytes = await response.arrayBuffer();
  const length = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[2] && match[1] ? Math.min(length - 1, Number(match[2])) : length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  }
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': response.headers.get('content-type') || 'video/mp4',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${length}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

function isSafeProfileCacheUserId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function profileCachePartitionPath(userId) {
  return new URL(`__offline-profiles/${encodeURIComponent(userId)}/`, scopeUrl).pathname;
}

function profileCacheKey(userId, profileId) {
  return new URL(`__offline-profiles/${encodeURIComponent(userId)}/profiles/${encodeURIComponent(profileId)}.json`, scopeUrl).href;
}

function profilePhotoCacheKey(userId, mediaId) {
  return new URL(`__offline-profiles/${encodeURIComponent(userId)}/photos/${encodeURIComponent(mediaId)}.webp`, scopeUrl).href;
}

function publicProfileCacheProjection(value, requestedId) {
  if (!value || typeof value !== 'object' || value.id !== requestedId || typeof value.name !== 'string') return null;
  if (!Array.isArray(value.photos) || !Array.isArray(value.interests)) return null;
  return {
    id: value.id,
    name: value.name,
    age: Number.isInteger(value.age) ? value.age : null,
    showAge: Boolean(value.showAge),
    gender: typeof value.gender === 'string' ? value.gender : '',
    lookingFor: typeof value.lookingFor === 'string' ? value.lookingFor : '',
    bio: typeof value.bio === 'string' ? value.bio : '',
    city: typeof value.city === 'string' ? value.city : '',
    country: typeof value.country === 'string' ? value.country : null,
    state: typeof value.state === 'string' ? value.state : null,
    interests: value.interests.filter((item) => typeof item === 'string'),
    occupation: typeof value.occupation === 'string' ? value.occupation : '',
    occupationOther: typeof value.occupationOther === 'string' ? value.occupationOther : '',
    photos: value.photos.filter((item) => typeof item === 'string'),
    isDemo: Boolean(value.isDemo),
    isVerified: Boolean(value.isVerified),
  };
}

function responseWithOfflineMarker(response) {
  const headers = new Headers(response.headers);
  headers.set('x-myage-offline-cache', 'profile');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function trimOfflineProfiles(cache, userId) {
  const partition = profileCachePartitionPath(userId);
  const keys = await cache.keys();
  const profileRows = [];
  const photoRows = [];
  for (const request of keys) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith(partition)) continue;
    const response = await cache.match(request);
    const cachedAt = Number(response?.headers.get('x-myage-profile-cached-at')) || 0;
    if (pathname.includes('/profiles/')) profileRows.push({ request, cachedAt });
    else if (pathname.includes('/photos/')) photoRows.push({ request, cachedAt });
  }
  const now = Date.now();
  for (const rows of [profileRows, photoRows]) {
    rows.sort((a, b) => a.cachedAt - b.cachedAt);
    const max = rows === profileRows ? MAX_OFFLINE_PROFILES : MAX_OFFLINE_PROFILE_PHOTOS;
    for (const row of rows) {
      if (now - row.cachedAt > MAX_OFFLINE_PROFILE_AGE_MS) {
        await cache.delete(row.request);
        row.remove = true;
      }
    }
    const remaining = rows.filter((row) => !row.remove);
    while (remaining.length > max) await cache.delete(remaining.shift().request);
  }
}

async function cachePublicProfileResponse(cache, userId, profileId, response) {
  let profile;
  try {
    profile = publicProfileCacheProjection(await response.clone().json(), profileId);
  } catch {
    return;
  }
  if (!profile) return;
  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-myage-profile-cached-at', String(Date.now()));
  for (const header of ['content-length', 'content-encoding', 'content-range', 'etag', 'last-modified', 'set-cookie']) headers.delete(header);
  await cache.put(profileCacheKey(userId, profileId), new Response(JSON.stringify(profile), {
    status: 200,
    headers,
  }));
  await trimOfflineProfiles(cache, userId);
}

async function cachedPublicProfile(cache, userId, profileId) {
  const key = profileCacheKey(userId, profileId);
  const response = await cache.match(key);
  if (!response) return null;
  const cachedAt = Number(response.headers.get('x-myage-profile-cached-at')) || 0;
  if (!cachedAt || Date.now() - cachedAt > MAX_OFFLINE_PROFILE_AGE_MS) {
    await cache.delete(key);
    return null;
  }
  return responseWithOfflineMarker(response);
}

async function fetchPublicProfile(request, profileId) {
  const userId = activeProfileCacheUserId;
  if (!isSafeProfileCacheUserId(userId)) return fetch(request);
  const cache = await caches.open(PROFILE_CACHE_NAME);
  try {
    const response = await fetch(request);
    if ([401, 403, 404].includes(response.status)) {
      await cache.delete(profileCacheKey(userId, profileId));
      return response;
    }
    if (response.status === 200 && response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      await cachePublicProfileResponse(cache, userId, profileId, response);
    } else if (response.status >= 500) {
      return (await cachedPublicProfile(cache, userId, profileId)) || response;
    }
    return response;
  } catch (error) {
    const cached = await cachedPublicProfile(cache, userId, profileId);
    if (cached) return cached;
    throw error;
  }
}

async function profileUsesPhoto(cache, userId, mediaId) {
  const partition = profileCachePartitionPath(userId);
  for (const request of await cache.keys()) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith(partition) || !pathname.includes('/profiles/')) continue;
    const profile = await cache.match(request);
    if (!profile) continue;
    try {
      const data = await profile.json();
      if (data.photos?.includes(`media:${mediaId}`)) return true;
    } catch {
      await cache.delete(request);
    }
  }
  return false;
}

async function fetchPublicProfilePhoto(request, mediaId) {
  const userId = activeProfileCacheUserId;
  if (!isSafeProfileCacheUserId(userId)) return fetch(request);
  const cache = await caches.open(PROFILE_CACHE_NAME);
  const key = profilePhotoCacheKey(userId, mediaId);
  if (!await profileUsesPhoto(cache, userId, mediaId)) return fetch(request);
  try {
    const response = await fetch(request);
    if ([401, 403, 404].includes(response.status)) {
      await cache.delete(key);
      return response;
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (response.ok &&
        response.headers.get('content-type')?.toLowerCase().startsWith('image/webp') &&
        (!Number.isFinite(contentLength) || contentLength <= 128 * 1024)) {
      const headers = new Headers(response.headers);
      headers.set('x-myage-profile-cached-at', String(Date.now()));
      const copy = new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers });
      await cache.put(key, copy);
      await trimOfflineProfiles(cache, userId);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    const cachedAt = Number(cached?.headers.get('x-myage-profile-cached-at')) || 0;
    if (cached && Date.now() - cachedAt <= MAX_OFFLINE_PROFILE_AGE_MS) return responseWithOfflineMarker(cached);
    if (cached) await cache.delete(key);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const offline = await fetchWithTimeout(offlineUrl);
    if (!offline.ok) throw new Error('VIBESWIPES recovery page is unavailable.');
    await cache.put(offlineUrl, offline);
    const appShell = await fetchWithTimeout(appShellUrl);
    if (!appShell.ok || !appShell.headers.get('content-type')?.includes('text/html')) {
      throw new Error('The VIBESWIPES app shell is unavailable.');
    }
    const appHtml = await appShell.clone().text();
    await cache.put(appShellUrl, appShell);
    await cacheAppEntryAssets(cache, appHtml);
    // A single unavailable optional icon must not disable the whole worker.
    await Promise.allSettled(shell.map(async (url) => {
      const response = await fetchWithTimeout(url);
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'myage:cache-reel-offline') return;
  event.waitUntil(cacheOfflineReel(event.data).then((result) => {
    event.ports?.[0]?.postMessage(result);
  }).catch(() => {
    event.ports?.[0]?.postMessage({ ok: false, message: 'Could not save this video offline. Try again on Wi-Fi.' });
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (key.startsWith('vibeswipe-shell-') || key.startsWith('myage-shell-')) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    ))
      .then(async () => {
        await trimOfflineReels(await caches.open(REEL_CACHE_NAME));
        await self.clients.claim();
      }),
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
    icon: new URL('vibeswipes-icon-192.png', scopeUrl).href,
    badge: new URL('vibeswipes-icon-192.png', scopeUrl).href,
    tag: data.type === 'reel_comment_reply' && typeof data.commentId === 'string'
      ? `reel-comment-reply-${data.commentId}`
      : data.type === 'reel_like' && typeof data.reelId === 'string'
        ? `reel-like-${data.reelId}` : typeof data.matchId === 'string' ? `message-${data.matchId}` : 'myage-message',
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
  const mediaMatch = url.pathname.match(/\/api\/vibeswipe\/media\/([0-9a-f-]{36})$/i);
  if (mediaMatch) {
    event.respondWith((async () => {
      const cache = await caches.open(REEL_CACHE_NAME);
      const record = await cachedOfflineReelRecord(cache, url.href);
      const cached = record ? await cache.match(url.href) : null;
      if (!record) await cache.delete(url.href);
      if (self.navigator?.onLine === false) {
        if (cached) return cachedRangeResponse(cached, request.headers.get('range'));
        return fetch(request);
      }
      try {
        const response = await fetch(request);
        if (cached && [401, 403, 404].includes(response.status)) {
          await cache.delete(url.href);
          for (const record of await offlineReelRecords(cache)) {
            if (record.videoUrl === url.href) await cache.delete(record.metadataUrl);
          }
        }
        return response;
      } catch (error) {
        if (cached) return cachedRangeResponse(cached, request.headers.get('range'));
        throw error;
      }
    })());
    return;
  }
  if (/\/(?:api|storage|__clerk)(?:\/|$)/i.test(url.pathname) || /clerk/i.test(url.hostname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const fallback = async () => (await cache.match(appShellUrl)) || (await cache.match(offlineUrl)) || new Response(
        'VIBESWIPES could not connect. Check your connection and reload this page.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
      if (self.navigator?.onLine === false) return fallback();
      try {
        const response = await fetchWithTimeout(request);
        if (response.status >= 500) throw new Error('VIBESWIPES is temporarily unavailable.');
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          void cache.put(appShellUrl, response.clone());
        }
        return response;
      } catch {
        return fallback();
      }
    })());
    return;
  }

  // Stable install metadata must refresh online rather than keeping old launch behavior.
  if (/\/(?:manifest\.json|pwa-install\.js|pwa-launch\.js)$/.test(url.pathname)) {
    event.respondWith(fetchWithTimeout(request).then(async (response) => {
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
