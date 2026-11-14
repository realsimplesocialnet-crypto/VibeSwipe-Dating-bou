/* Run before the app bundle: Chrome may offer installation before React mounts. */
(() => {
  const modes = ['standalone', 'fullscreen'].map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  const inApp = () => modes.some((mode) => mode.matches) || navigator.standalone === true;
  let installationConfirmed = false;
  let snapshot = { prompt: null, installed: inApp() };
  const subscribers = new Set();
  const publish = (next) => {
    snapshot = next;
    subscribers.forEach((notify) => notify());
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
  };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    publish({ ...snapshot, prompt: event });
  });
  window.addEventListener('appinstalled', () => {
    installationConfirmed = true;
    publish({ prompt: null, installed: true });
  });
  const updateMode = () => publish({ ...snapshot, installed: installationConfirmed || inApp() });
  modes.forEach((mode) => {
    if (mode.addEventListener) mode.addEventListener('change', updateMode);
    else mode.addListener(updateMode);
  });
  window.addEventListener('pageshow', updateMode);
})();
