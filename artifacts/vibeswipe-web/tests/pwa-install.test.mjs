import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8');
function setup(options = {}) {
  const window = new EventTarget();
  if (options.androidBridge) window.Android = {};
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
  return { window, store: window.vibeSwipeInstall, storage, timers };
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

test('Android WebView is marked installed without relying on standalone display mode', () => {
  const { store, storage } = setup({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv)' } });
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(storage.get('myage:pwa-installed:v1'), 'confirmed');
});

test('ordinary Android browsers initialize without display-mode detection', () => {
  const { store } = setup({ navigator: {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36',
    standalone: false,
  } });
  assert.equal(store.getSnapshot().installed, false);
});

test('Android bridge marks the page as running inside its app wrapper', () => {
  const { store } = setup({ androidBridge: true });
  assert.equal(store.getSnapshot().installed, true);
});

test('returning website visits remain eligible without a new browser prompt', () => {
  const { window, store } = setup();
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(store.getSnapshot().installed, false);
  assert.equal(store.getSnapshot().prompt, null);
});

test('install completion stays confirmed after page visibility updates', () => {
  const { window, store } = setup();
  window.dispatchEvent(new Event('appinstalled'));
  window.dispatchEvent(new Event('pageshow'));
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

test('a new browser install offer clears a stale manual installed marker', () => {
  const { store, storage } = setup();
  store.confirmInstalled();
  const refreshed = setup({ storage });
  const prompt = new Event('beforeinstallprompt', { cancelable: true });
  refreshed.window.dispatchEvent(prompt);
  assert.equal(refreshed.store.getSnapshot().installed, false);
  assert.equal(refreshed.store.getSnapshot().prompt, prompt);
});

test('a real new browser install offer clears a stale marker after uninstalling', () => {
  const first = setup();
  first.window.dispatchEvent(new Event('appinstalled'));
  const next = setup({ storage: first.storage });
  next.window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  assert.equal(next.store.getSnapshot().installed, false);
  assert.equal(next.store.getSnapshot().prompt?.type, 'beforeinstallprompt');
});

test('disabled browser storage cannot prevent detecting an iOS Home Screen launch', () => {
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

test('a detected installed PWA suppresses a queued browser install prompt', async () => {
  const { window, store } = setup({ navigator: {
    getInstalledRelatedApps: async () => [{ platform: 'webapp', url: 'https://app.example.test/manifest.json?v=9' }],
  } });
  const prompt = new Event('beforeinstallprompt', { cancelable: true });
  window.dispatchEvent(prompt);
  assert.equal(store.getSnapshot().checkingInstalled, true);
  assert.equal(store.getSnapshot().prompt, null);
  await new Promise(setImmediate);
  assert.equal(store.getSnapshot().installed, true);
  assert.equal(store.getSnapshot().prompt, null);
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

test('the website does not render install prompts or APK download controls', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.related_applications[0].platform, 'webapp');
  assert.equal(manifest.related_applications[0].url, 'manifest.json?v=9');
  assert.equal(manifest.prefer_related_applications, false);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const pushSettings = readFileSync(new URL('../src/components/WebPushSettings.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /InstallAction|MobileInstallBanner|ConsumerInstallBanner/);
  assert.doesNotMatch(app, /PwaInstallBanner/);
  const welcome = readFileSync(new URL('../src/components/installed-welcome.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(welcome, /Download Android App|apkDownloadUrl|link-download-android-apk/);
  assert.doesNotMatch(pushSettings, /InstallAction/);
  const browserInstall = readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8');
  assert.match(browserInstall, /beforeinstallprompt/);
  assert.match(browserInstall, /event\.preventDefault\(\)/);
  assert.doesNotMatch(browserInstall, /display-mode|matchMedia/);
});
