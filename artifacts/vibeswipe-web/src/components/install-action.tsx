import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { isMobileBrowser, useStandaloneMode } from '@/lib/app-display-mode';
import { isCurrentAndroidWebView } from '@/lib/android-webview';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type InstallState = { prompt: InstallPrompt | null; installed: boolean; bannerDismissed: boolean; checkingInstalled: boolean };
type InstallStore = {
  getSnapshot: () => InstallState;
  subscribe: (notify: () => void) => () => void;
  clearPrompt: (prompt: InstallPrompt) => void;
  dismissBanner: () => void;
  confirmInstalled: () => void;
};
declare global {
  interface Window { vibeSwipeInstall?: InstallStore }
}
const unavailable: InstallState = { prompt: null, installed: false, bannerDismissed: false, checkingInstalled: false };
let fallbackState = unavailable;
const fallbackListeners = new Set<() => void>();
try {
  const remembered = window.localStorage.getItem('myage:pwa-installed:v1');
  if (remembered === 'confirmed' || remembered === 'manual') fallbackState = { ...unavailable, installed: true };
} catch { /* Storage may be restricted. Dismissal must still work. */ }
const publishFallback = (next: InstallState) => {
  fallbackState = next;
  fallbackListeners.forEach(notify => notify());
};
const fallback: InstallStore = {
  getSnapshot: () => fallbackState,
  subscribe: notify => { fallbackListeners.add(notify); return () => { fallbackListeners.delete(notify); }; },
  clearPrompt: () => {},
  dismissBanner: () => publishFallback({ ...fallbackState, bannerDismissed: true }),
  confirmInstalled: () => {
    try { window.localStorage.setItem('myage:pwa-installed:v1', 'manual'); } catch { /* Keep the current page usable. */ }
    publishFallback({ ...fallbackState, installed: true });
  },
};

export function MobileInstallBanner() {
  if (isCurrentAndroidWebView()) return null;
  return isMobileBrowser(navigator) ? <InstallAction banner /> : null;
}

export function InstallAction({ className = '', compact = false, banner = false }: { className?: string; compact?: boolean; banner?: boolean }) {
  const standalone = useStandaloneMode();
  const inAndroidApp = isCurrentAndroidWebView();
  const store = window.vibeSwipeInstall?.dismissBanner ? window.vibeSwipeInstall : fallback;
  const { prompt, installed, bannerDismissed, checkingInstalled } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const hidden = inAndroidApp || standalone || installed || checkingInstalled || (banner && bannerDismissed);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const helpId = useId();
  const bannerRef = useRef<HTMLDivElement>(null);
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    if (!banner) return;
    if (hidden) {
      document.documentElement.style.removeProperty('--install-banner-height');
      return;
    }
    const updateHeight = () => {
      document.documentElement.style.setProperty('--install-banner-height', `${bannerRef.current?.offsetHeight ?? 0}px`);
    };
    updateHeight();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    if (bannerRef.current) observer?.observe(bannerRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      document.documentElement.style.removeProperty('--install-banner-height');
    };
  }, [banner, hidden]);

  async function install() {
    if (!prompt) { setShowHelp((value) => !value); return; }
    setBusy(true);
    setNotice('');
    try {
      // Keep this call directly in the click handler so Chrome sees a user gesture.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      store.clearPrompt(prompt);
      setShowHelp(choice.outcome === 'dismissed');
      if (choice.outcome === 'dismissed') {
        setNotice('Installation was cancelled. You can keep using the website or install from your browser’s menu.');
      }
    } catch (error) {
      console.warn('VIBESWIPES installation prompt could not open.', error);
      store.clearPrompt(prompt);
      setNotice('The install prompt could not open. Keep using the website, or use your browser’s menu below.');
      setShowHelp(true);
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;
  return <div ref={bannerRef} data-testid={banner ? 'mobile-install-banner' : undefined}
    className={banner ? 'sticky top-0 z-40 border-b border-primary/20 bg-card text-card-foreground shadow-sm' : `relative ${className}`}>
    <div className={banner ? 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3' : undefined}>
    {banner && <><img src={`${import.meta.env.BASE_URL}vibeswipes-icon-192.png`} alt="" className="h-10 w-10 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5">Get the full VIBESWIPES experience</p><p className="text-[11px] text-muted-foreground">Add the app to your home screen</p></div></>}
    <button onClick={() => void install()} disabled={busy} aria-expanded={showHelp} aria-controls={showHelp ? helpId : undefined}
      data-testid={banner ? 'button-install-banner' : 'button-install-app'} aria-label={compact ? 'Install app options' : undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl ${banner ? 'min-h-11 bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90' : `border border-border bg-secondary/40 ${compact ? 'h-11 w-11' : 'px-3.5 py-2.5'} text-sm font-semibold text-foreground hover:bg-secondary`} disabled:opacity-50`}>
      <Download size={16}/>{!compact && <span>{busy ? 'Opening…' : banner || prompt ? 'Install app' : 'Install options'}</span>}
    </button>
    {banner && <button type="button" onClick={store.dismissBanner} aria-label="Dismiss install banner" data-testid="button-dismiss-install-banner"
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X size={18}/></button>}
    </div>
    {!compact && !banner && <p className="mt-0.5 text-center text-[10px] leading-3 text-muted-foreground">Optional</p>}
    {showHelp && <div id={helpId} role="region" aria-label="App installation instructions" className={`absolute right-0 top-full z-50 ${banner ? 'mr-3' : ''} mt-3 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card p-4 text-left text-xs leading-5 text-muted-foreground shadow-xl`}
      data-testid="text-install-help">
      <div className="mb-2 flex items-start justify-between gap-3">
        <strong className="text-sm text-foreground">Install VIBESWIPES</strong>
        <button onClick={() => setShowHelp(false)} aria-label="Close install instructions" className="rounded p-1 hover:bg-white/10"><X size={14}/></button>
      </div>
      <p className="mb-3 text-foreground">Installation is optional. You can create your account and use VIBESWIPES directly on this website.</p>
      <button type="button" onClick={store.confirmInstalled} data-testid="button-already-installed" className="mb-3 min-h-11 font-semibold text-primary underline">Already installed? Hide install reminders</button>
      {notice && <p role="status" className="mb-3 text-destructive">{notice}</p>}
      {prompt ? <button onClick={() => void install()} disabled={busy} className="mb-3 w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-[#24111b]">Install now</button>
        : <p className="mb-3">The browser hasn’t offered one-tap installation yet. Keep this page open briefly, or use its menu:</p>}
      {ios ? <ol className="list-decimal space-y-1 pl-4"><li>Open this website in Safari.</li><li>Tap <strong className="text-foreground">Share</strong>.</li><li>Choose <strong className="text-foreground">Add to Home Screen</strong>, then <strong className="text-foreground">Add</strong>.</li></ol>
        : <ol className="list-decimal space-y-1 pl-4"><li>Open your browser’s menu, usually <strong className="text-foreground">⋮</strong> or <strong className="text-foreground">☰</strong>.</li><li>Choose <strong className="text-foreground">Add to Home screen</strong> or <strong className="text-foreground">Install app</strong>.</li><li>If asked, choose <strong className="text-foreground">Install</strong> and confirm.</li></ol>}
      <p className="mt-3">If no install option appears, update your browser and use a normal tab, not private browsing. Chrome is not required to use this website.</p>
      <a href={`${import.meta.env.BASE_URL}open.html`} target="_blank" rel="noopener" className="mt-3 inline-block font-semibold text-primary underline">Installed app won’t open? Get launch help</a>
    </div>}
  </div>;
}
