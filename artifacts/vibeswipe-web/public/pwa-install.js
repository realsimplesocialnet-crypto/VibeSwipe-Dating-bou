/* Run before the app bundle: Chrome may offer installation before React mounts. */
(() => {
  const modes = ['standalone', 'fullscreen', 'minimal-ui'].map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  const inApp = () => modes.some((mode) => mode.matches) || navigator.standalone === true;
  // Playing a website video fullscreen is not a Home Screen installation.
  const videoFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const installedKey = 'myage:pwa-installed:v1';
  const readInstalled = () => {
    try { return window.localStorage.getItem(installedKey); } catch { return null; }
  };
  const writeInstalled = (value) => {
    try {
      if (value) window.localStorage.setItem(installedKey, value);
      else window.localStorage.removeItem(installedKey);
    } catch { /* Restricted storage must not prevent launching the app. */ }
  };
  let installationConfirmed = readInstalled() === 'confirmed' || readInstalled() === 'manual';
  if (inApp() && !videoFullscreen()) { installationConfirmed = true; writeInstalled('confirmed'); }
  const canCheckInstalled = typeof navigator.getInstalledRelatedApps === 'function';
  let deferredPrompt = null;
  let snapshot = {
    prompt: null, installed: installationConfirmed || inApp(),
    bannerDismissed: false, checkingInstalled: canCheckInstalled && !inApp(),
  };
  const subscribers = new Set();
  const publish = (next) => {
    snapshot = next;
    subscribers.forEach((notify) => notify());
  };
  const confirmInstalled = (manual = false) => {
    deferredPrompt = null;
    installationConfirmed = true;
    writeInstalled(manual ? 'manual' : 'confirmed');
    publish({ ...snapshot, prompt: null, installed: true, checkingInstalled: false });
  };
  window.vibeSwipeInstall = {
    getSnapshot: () => snapshot,
    subscribe: (notify) => {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
    clearPrompt: (prompt) => {
      if (snapshot.prompt === prompt) publish({ ...snapshot, prompt: null });
    },
    // Dismissal lasts only for this document, including route changes. Reload
    // offers installation again unless installation itself was confirmed.
    dismissBanner: () => publish({ ...snapshot, bannerDismissed: true }),
    confirmInstalled: () => confirmInstalled(true),
  };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (inApp()) return;
    if (snapshot.checkingInstalled) {
      deferredPrompt = event;
      return;
    }
    // A new browser offer is a stronger signal than a stale stored marker
    // after uninstalling. A missing offer, however, proves nothing.
    installationConfirmed = false;
    writeInstalled(null);
    publish({ ...snapshot, prompt: event, installed: false, checkingInstalled: false });
  });
  window.addEventListener('appinstalled', () => {
    confirmInstalled();
  });
  const updateMode = () => {
    if (inApp() && !videoFullscreen()) confirmInstalled();
    else if (inApp()) publish({ ...snapshot, installed: true });
    else publish({ ...snapshot, installed: installationConfirmed });
  };
  modes.forEach((mode) => {
    if (mode.addEventListener) mode.addEventListener('change', updateMode);
    else mode.addListener(updateMode);
  });
  window.addEventListener('pageshow', updateMode);
  window.addEventListener('storage', (event) => {
    if (event.key !== installedKey && event.key !== null) return;
    const remembered = readInstalled();
    installationConfirmed = remembered === 'confirmed' || remembered === 'manual';
    updateMode();
  });

  if (snapshot.checkingInstalled) {
    // Do not flash an install banner while Chrome checks existing installs.
    // Unsupported/rejected/hung checks still leave the website usable.
    const timeout = setTimeout(() => publish({ ...snapshot, checkingInstalled: false }), 2000);
    (async () => {
      try {
        const manifest = document.querySelector('link[rel="manifest"]');
        if (!manifest) return;
        const expected = new URL(manifest.href, window.location.href);
        const apps = await navigator.getInstalledRelatedApps();
        const found = apps.some((app) => {
          if (app.platform !== 'webapp' || !app.url) return false;
          try {
            const url = new URL(app.url, expected);
            return url.origin === expected.origin && url.pathname === expected.pathname;
          } catch { return false; }
        });
        if (found) confirmInstalled();
        else if (deferredPrompt) {
          const prompt = deferredPrompt;
          deferredPrompt = null;
          installationConfirmed = false;
          writeInstalled(null);
          publish({ ...snapshot, prompt, installed: false, checkingInstalled: false });
        }
      } catch { /* Safari and privacy-restricted browsers may not expose this. */ }
      finally {
        clearTimeout(timeout);
        if (snapshot.checkingInstalled) {
          if (deferredPrompt) {
            const prompt = deferredPrompt;
            deferredPrompt = null;
            installationConfirmed = false;
            writeInstalled(null);
            publish({ ...snapshot, prompt, installed: false, checkingInstalled: false });
          } else publish({ ...snapshot, checkingInstalled: false });
        }
      }
    })();
  }
})();
