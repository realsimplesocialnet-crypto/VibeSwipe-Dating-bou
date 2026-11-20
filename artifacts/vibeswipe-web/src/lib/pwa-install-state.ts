import { useSyncExternalStore } from 'react';

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type PwaInstallSnapshot = {
  prompt: InstallPrompt | null;
  installed: boolean;
  bannerDismissed: boolean;
  checkingInstalled: boolean;
};

export type PwaInstallStore = {
  getSnapshot: () => PwaInstallSnapshot;
  subscribe: (notify: () => void) => () => void;
  clearPrompt: (prompt: InstallPrompt) => void;
  dismissBanner: () => void;
  confirmInstalled: () => void;
};

declare global {
  interface Window {
    vibeSwipeInstall?: PwaInstallStore;
  }
}

const unavailable: PwaInstallSnapshot = {
  prompt: null,
  installed: false,
  bannerDismissed: false,
  checkingInstalled: false,
};

const getSnapshot = () => window.vibeSwipeInstall?.getSnapshot() ?? unavailable;
const subscribe = (notify: () => void) => window.vibeSwipeInstall?.subscribe(notify) ?? (() => {});

export function usePwaInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => unavailable);
}

export function shouldShowPwaInstallBanner(input: {
  mobile: boolean;
  appShell: boolean;
  installed: boolean;
  checkingInstalled: boolean;
  dismissed: boolean;
}): boolean {
  return input.mobile && !input.appShell && !input.installed && !input.checkingInstalled && !input.dismissed;
}
