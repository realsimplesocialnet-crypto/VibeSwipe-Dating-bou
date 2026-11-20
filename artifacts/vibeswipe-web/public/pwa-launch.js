/* Independent of React/auth: a failed app bundle must not prevent launch recovery. */
(() => {
  const script = document.currentScript;
  const scope = new URL('./', script.src);
  const warn = (error) => console.warn('MYAGEBEAUTY offline support is unavailable; the website can still open.', error);

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
