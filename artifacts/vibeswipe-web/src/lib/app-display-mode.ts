import { useSyncExternalStore } from 'react';

const modes = ['(display-mode: standalone)', '(display-mode: fullscreen)'];

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
