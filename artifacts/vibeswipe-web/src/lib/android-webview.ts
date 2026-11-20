import { isStandaloneApp } from './app-display-mode.ts';

export function isAndroidWebView(userAgent: string, hasAndroidBridge: boolean): boolean {
  const hasWebViewMarker = /(?:;\s*wv\)|\bwv\b)/i.test(userAgent);
  const hasClassicAndroidWebViewSignature = /\bandroid\b/i.test(userAgent)
    && /\bversion\/[\d.]+/i.test(userAgent)
    && /\bchrome\/[\d.]+/i.test(userAgent)
    && /mobile safari\//i.test(userAgent);
  return hasWebViewMarker || hasClassicAndroidWebViewSignature || hasAndroidBridge;
}

export function shouldLoadAppShell(
  userAgent: string,
  hasAndroidBridge: boolean,
  isStandalone: boolean,
): boolean {
  return isAndroidWebView(userAgent, hasAndroidBridge) || isStandalone;
}

export function isDedicatedAppPath(pathname: string, appPath: string): boolean {
  return pathname === appPath || pathname.startsWith(`${appPath}/`);
}

export function isAuthEntryPath(pathname: string): boolean {
  return /^\/(?:sign-in|sign-up)(?:\/|$)/.test(pathname);
}

export function isCurrentAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return isAndroidWebView(window.navigator.userAgent, 'Android' in window);
}

export function isCurrentAppShell(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = isStandaloneApp(window, navigator as Navigator & { standalone?: boolean });
  return shouldLoadAppShell(window.navigator.userAgent, 'Android' in window, standalone);
}
