import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8');
function setup() {
  const window = new EventTarget();
  const standalone = new EventTarget();
  standalone.matches = false;
  window.matchMedia = () => standalone;
  runInNewContext(source, { window, navigator: {} });
  return { window, standalone, store: window.vibeSwipeInstall };
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
