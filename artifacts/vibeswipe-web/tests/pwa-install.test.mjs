import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8');
function setup(options = {}) {
  const window = new EventTarget();
  const standalone = new EventTarget();
  standalone.matches = false;
  window.matchMedia = () => standalone;
  const storage = options.storage ?? new Map();
  const timers = [];
  Object.defineProperty(window, 'localStorage', { get() {
    if (options.blockedStorage) throw new Error('Storage unavailable');
    return {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    };
  } });
  window.location = { href: 'https://app.example.test/discover' };
  const document = { querySelector: () => ({ href: 'https://app.example.test/manifest.json?v=7' }) };
  if (options.fullscreenVideo) document.fullscreenElement = {};
  runInNewContext(source, {
    window, navigator: options.navigator ?? {}, document, URL,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
  });
  return { window, standalone, store: window.vibeSwipeInstall, storage, timers };
}

test('keeps an early browser prompt until a component subscribes', () => {
  const { window, store } = setup();
  const prompt = new Event('beforeinstallprompt', { cancelable: true });
  window.dispatchEvent(prompt);
  assert.equal(prompt.defaultPrevented, true);
  assert.equal(store.getSnapshot().prompt, prompt);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.clearPrompt(prompt);
  assert.equal(store.getSnapshot().prompt, null);
  assert.equal(notifications, 1);
  unsubscribe();
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(notifications, 1);
  assert.equal(store.getSnapshot().installed, true);
});

test('an old consumed prompt cannot clear a newer prompt', () => {
  const { window, store } = setup();
  const first = new Event('beforeinstallprompt', { cancelable: true });
  const second = new Event('beforeinstallprompt', { cancelable: true });
  window.dispatchEvent(first);
  window.dispatchEvent(second);
  store.clearPrompt(first);
  assert.equal(store.getSnapshot().prompt, second);
});

test('standalone mode is reflected in the shared install state', () => {
  const { standalone, store } = setup();
  standalone.matches = true;
  standalone.dispatchEvent(new Event('change'));
  assert.equal(store.getSnapshot().installed, true);
});

test('watching a video fullscreen does not permanently mark the website as installed', () => {
  const { standalone, store, storage } = setup({ fullscreenVideo: true });
  standalone.matches = true;
  standalone.dispatchEvent(new Event('change'));
  assert.equal(store.getSnapshot().installed, true);
  standalone.matches = false;
  standalone.dispatchEvent(new Event('change'));
  assert.equal(store.getSnapshot().installed, false);
  assert.equal(setup({ storage }).store.getSnapshot().installed, false);
});

test('returning website visits remain eligible without a new browser prompt', () => {
  const { window, store } = setup();
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(store.getSnapshot().installed, false);
  assert.equal(store.getSnapshot().prompt, null);
});

test('install completion stays confirmed when a browser-mode event follows', () => {
  const { window, standalone, store } = setup();
  window.dispatchEvent(new Event('appinstalled'));
  standalone.matches = false;
  standalone.dispatchEvent(new Event('change'));
  assert.equal(store.getSnapshot().installed, true);
});

test('completed installations survive reloads instead of prompting again permanently', () => {
  const { window, store, storage } = setup();
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(setup({ storage }).store.getSnapshot().installed, true);
});

test('iPhone Home Screen launches are remembered without appinstalled support', () => {
  const { store, storage } = setup({ navigator: { standalone: true } });
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(setup({ storage }).store.getSnapshot().installed, true);
});

test('closing the banner lasts through navigation, but not a fresh website load', () => {
  const { window, store, storage } = setup();
  store.dismissBanner();
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(store.getSnapshot().bannerDismissed, true);
  const refreshed = setup({ storage }).store.getSnapshot();
  assert.equal(refreshed.bannerDismissed, false);
  assert.equal(refreshed.installed, false);
});

test('Already installed remembers the choice in browsers without install detection', () => {
  const { store, storage } = setup();
  store.confirmInstalled();
  const refreshed = setup({ storage });
  refreshed.window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  assert.equal(refreshed.store.getSnapshot().installed, true);
  assert.equal(refreshed.store.getSnapshot().prompt, null);
});

test('a real new browser install offer clears a stale marker after uninstalling', () => {
  const first = setup();
  first.window.dispatchEvent(new Event('appinstalled'));
  const next = setup({ storage: first.storage });
  next.window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  assert.equal(next.store.getSnapshot().installed, false);
  assert.equal(next.store.getSnapshot().prompt?.type, 'beforeinstallprompt');
});

test('disabled browser storage cannot prevent the app opening or detecting home-screen mode', () => {
  const { store } = setup({ blockedStorage: true, navigator: { standalone: true } });
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(setup({ blockedStorage: true }).store.getSnapshot().installed, false);
});

test('another tab receives an installation confirmation without refreshing', () => {
  const first = setup();
  const second = setup({ storage: first.storage });
  first.window.dispatchEvent(new Event('appinstalled'));
  second.window.dispatchEvent(Object.assign(new Event('storage'), { key: 'myage:pwa-installed:v1' }));
  assert.equal(second.store.getSnapshot().installed, true);
});

test('Chrome detects a pre-existing install before showing the banner', async () => {
  const { store, storage } = setup({ navigator: {
    getInstalledRelatedApps: async () => [{ platform: 'webapp', url: 'https://app.example.test/manifest.json?v=7' }],
  } });
  assert.equal(store.getSnapshot().checkingInstalled, true);
  await new Promise(setImmediate);
  assert.equal(store.getSnapshot().checkingInstalled, false);
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(setup({ storage }).store.getSnapshot().installed, true);
});

test('unrelated installs, rejected checks and slow checks do not hide the website banner forever', async () => {
  for (const getInstalledRelatedApps of [
    async () => [{ platform: 'webapp', url: 'https://another.example.test/manifest.json' }],
    async () => { throw new Error('API unavailable'); },
  ]) {
    const { store } = setup({ navigator: { getInstalledRelatedApps } });
    await new Promise(setImmediate);
    assert.equal(store.getSnapshot().installed, false);
    assert.equal(store.getSnapshot().checkingInstalled, false);
  }
  const { store, timers } = setup({ navigator: { getInstalledRelatedApps: () => new Promise(() => {}) } });
  timers[0]();
  assert.equal(store.getSnapshot().checkingInstalled, false);
  assert.equal(store.getSnapshot().installed, false);
});

test('banner has a close button, persistent installed option and releases reserved height', () => {
  const ui = readFileSync(new URL('../src/components/install-action.tsx', import.meta.url), 'utf8');
  assert.match(ui, /onClick=\{store\.dismissBanner\} aria-label="Dismiss install banner"/);
  assert.match(ui, /onClick=\{store\.confirmInstalled\}/);
  assert.match(ui, /if \(hidden\) \{[^}]*removeProperty\('--install-banner-height'\)/s);
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.related_applications[0].platform, 'webapp');
  assert.equal(manifest.related_applications[0].url, 'manifest.json?v=7');
  assert.equal(manifest.prefer_related_applications, false);
});
