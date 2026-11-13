/* Run before the app bundle: Chrome may offer installation before React mounts. */
(() => {
  const standalone = window.matchMedia('(display-mode: standalone)');
  let snapshot = { prompt: null, installed: standalone.matches || navigator.standalone === true };
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
  window.addEventListener('appinstalled', () => publish({ prompt: null, installed: true }));
  standalone.addEventListener('change', () => {
    publish({ ...snapshot, installed: standalone.matches || navigator.standalone === true });
  });
})();
