import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAndroidWebView, shouldLoadAppShell } from '../src/lib/android-webview.ts';

test('detects an Android WebView from the wv user-agent marker', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14; wv)', false), true);
});

test('detects the Android bridge even without a wv user-agent marker', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14) Chrome/130', true), true);
});

test('keeps ordinary browser visits on the installer landing page', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14) Chrome/130', false), false);
  assert.equal(isAndroidWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false), false);
});

test('opens the existing app for an installed Home Screen PWA', () => {
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false, true), true);
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (Linux; Android 14) Chrome/130', false, true), true);
});

test('ordinary browser tabs stay on the installer page', () => {
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false, false), false);
});
