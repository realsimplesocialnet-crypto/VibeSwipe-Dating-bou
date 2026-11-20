import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAndroidWebView, isAuthEntryPath, isDedicatedAppPath, shouldLoadAppShell } from '../src/lib/android-webview.ts';
import { isIOSDevice } from '../src/lib/app-display-mode.ts';

test('detects an Android WebView from the wv user-agent marker', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14; wv)', false), true);
});

test('detects the Android bridge even without a wv user-agent marker', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14) Chrome/130', true), true);
});

test('does not mistake ordinary browsers for an Android WebView', () => {
  assert.equal(isAndroidWebView('Mozilla/5.0 (Linux; Android 14) Chrome/130', false), false);
  assert.equal(isAndroidWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false), false);
});

test('opens the existing app for an installed Home Screen PWA', () => {
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false, true), true);
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (Linux; Android 14) Chrome/130', false, true), true);
});

test('ordinary browser tabs do not count as an installed app shell', () => {
  assert.equal(shouldLoadAppShell('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1', false, false), false);
});

test('auth links open the real sign-in and sign-up routes', () => {
  assert.equal(isAuthEntryPath('/sign-in'), true);
  assert.equal(isAuthEntryPath('/sign-up'), true);
  assert.equal(isAuthEntryPath('/sign-up/verify-email'), true);
  assert.equal(isAuthEntryPath('/discover'), false);
});

test('routes the dedicated iPhone app path while keeping legacy paths separate', () => {
  assert.equal(isDedicatedAppPath('/app', '/app'), true);
  assert.equal(isDedicatedAppPath('/app/reels/123', '/app'), true);
  assert.equal(isDedicatedAppPath('/reels/123', '/app'), false);
});

test('recognizes iPhone, iPad, and touch-screen iPadOS browsers', () => {
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18) Safari/604.1' }), true);
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18) Safari/604.1' }), true);
  assert.equal(isIOSDevice({ platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130' }), false);
});
