import { isStandaloneApp } from './app-display-mode.ts';

export function isAndroidWebView(userAgent: string, hasAndroidBridge: boolean): boolean {
  return userAgent.toLowerCase().includes('wv') || hasAndroidBridge;
}

export function shouldLoadAppShell(
  userAgent: string,
  hasAndroidBridge: boolean,
  isStandalone: boolean,
): boolean {
  return isAndroidWebView(userAgent, hasAndroidBridge) || isStandalone;
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
