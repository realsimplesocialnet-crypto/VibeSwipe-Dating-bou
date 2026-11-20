import { useSyncExternalStore } from 'react';

const modes = ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)'];

export function isMobileBrowser(browserNavigator: {
  userAgent?: string;
  userAgentData?: { mobile?: boolean };
  platform?: string;
  maxTouchPoints?: number;
}): boolean {
  return browserNavigator.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod|Mobile/i.test(browserNavigator.userAgent ?? '')
    || (browserNavigator.platform === 'MacIntel' && (browserNavigator.maxTouchPoints ?? 0) > 1);
}

export function isIOSDevice(browserNavigator: {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}): boolean {
  return /iPhone|iPad|iPod/i.test(browserNavigator.userAgent ?? '')
    || (browserNavigator.platform === 'MacIntel' && (browserNavigator.maxTouchPoints ?? 0) > 1);
}

export function isStandaloneApp(
  browser: Pick<Window, 'matchMedia'>,
  browserNavigator: { standalone?: boolean },
): boolean {
  // Home-screen Safari supplies navigator.standalone even when its media query differs.
  return browserNavigator.standalone === true || modes.some((mode) => browser.matchMedia(mode).matches);
}

function readMode() {
  return isStandaloneApp(window, navigator as Navigator & { standalone?: boolean });
}

function subscribe(notify: () => void) {
  const queries = modes.map((mode) => window.matchMedia(mode));
  for (const query of queries) {
    if (query.addEventListener) query.addEventListener('change', notify);
    else query.addListener(notify);
  }
  window.addEventListener('pageshow', notify);
  return () => {
    for (const query of queries) {
      if (query.removeEventListener) query.removeEventListener('change', notify);
      else query.removeListener(notify);
    }
    window.removeEventListener('pageshow', notify);
  };
}

export function useStandaloneMode() {
  return useSyncExternalStore(subscribe, readMode);
}
