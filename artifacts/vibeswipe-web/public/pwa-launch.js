/* Independent of React/auth: a failed app bundle must not prevent launch recovery. */
(() => {
  const script = document.currentScript;
  const scope = new URL('./', script.src);
  const warn = (error) => console.warn('Myage offline support is unavailable; the website can still open.', error);

  // The root-scoped installable site would otherwise open /admin inside the PWA.
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true;
  if (
    script.dataset.production === 'true' &&
    isStandalone &&
    window.location.hostname === 'myage.beauty' &&
    /^\/admin(?:\/|$)/.test(window.location.pathname)
  ) {
    const browserUrl = new URL(window.location.href);
    browserUrl.protocol = 'https:';
    browserUrl.hostname = 'vibe-swipe-dating-app.replit.app';
    browserUrl.port = '';
    window.location.replace(browserUrl.href);
    return;
  }

  const retry = document.getElementById('startup-retry');
  if (retry) retry.addEventListener('click', () => window.location.reload());
  window.setTimeout(() => {
    const help = document.getElementById('startup-help');
    if (help) help.hidden = false;
  }, 8000);

  // Development must never cache Vite's modules. No browser-brand or install checks.
  if (script.dataset.production !== 'true' || !('serviceWorker' in navigator)) return;
  let pending = null;
  let registration = null;
  const register = () => {
    if (pending) return;
    pending = navigator.serviceWorker.register(new URL('service-worker.js', scope).href, {
      scope: scope.pathname,
      updateViaCache: 'none',
    }).then((result) => { registration = result; })
      .catch(warn)
      .finally(() => { pending = null; });
  };
  register();
  window.addEventListener('online', () => {
    if (registration) void registration.update().catch(warn);
    else register();
  });
})();
