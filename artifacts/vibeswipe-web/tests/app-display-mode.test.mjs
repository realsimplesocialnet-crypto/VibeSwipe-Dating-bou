import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMobileBrowser, isStandaloneApp } from '../src/lib/app-display-mode.ts';

const browser = (mode) => ({
  matchMedia: (query) => ({ matches: query === `(display-mode: ${mode})` }),
});

test('iPhone home-screen mode works even without standalone media query support', () => {
  assert.equal(isStandaloneApp(browser('browser'), { standalone: true }), true);
});

test('Android standalone and fullscreen windows are app launches', () => {
  assert.equal(isStandaloneApp(browser('standalone'), {}), true);
  assert.equal(isStandaloneApp(browser('fullscreen'), {}), true);
  assert.equal(isStandaloneApp(browser('minimal-ui'), {}), true);
});

test('a normal Safari or Chrome tab remains the website', () => {
  assert.equal(isStandaloneApp(browser('browser'), { standalone: false }), false);
  assert.equal(isStandaloneApp(browser('browser'), {}), false);
});

test('the install banner targets Android and iPhone browsers, not small desktop windows', () => {
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1' }), true);
  assert.equal(isMobileBrowser({ platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isMobileBrowser({ userAgentData: { mobile: true } }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', maxTouchPoints: 0 }), false);
});
