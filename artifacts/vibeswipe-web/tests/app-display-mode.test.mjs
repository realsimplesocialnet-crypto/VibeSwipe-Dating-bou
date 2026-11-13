import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStandaloneApp } from '../src/lib/app-display-mode.ts';

const browser = (mode) => ({
  matchMedia: (query) => ({ matches: query === `(display-mode: ${mode})` }),
});

test('iPhone home-screen mode works even without standalone media query support', () => {
  assert.equal(isStandaloneApp(browser('browser'), { standalone: true }), true);
});

test('Android standalone and fullscreen windows are app launches', () => {
  assert.equal(isStandaloneApp(browser('standalone'), {}), true);
  assert.equal(isStandaloneApp(browser('fullscreen'), {}), true);
});

test('a normal Safari or Chrome tab remains the website', () => {
  assert.equal(isStandaloneApp(browser('browser'), { standalone: false }), false);
  assert.equal(isStandaloneApp(browser('browser'), {}), false);
});
