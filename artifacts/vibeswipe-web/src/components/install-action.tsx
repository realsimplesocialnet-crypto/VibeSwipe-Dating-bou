import { useId, useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type InstallState = { prompt: InstallPrompt | null; installed: boolean };
type InstallStore = {
  getSnapshot: () => InstallState;
  subscribe: (notify: () => void) => () => void;
  clearPrompt: (prompt: InstallPrompt) => void;
};
declare global {
  interface Window { vibeSwipeInstall?: InstallStore }
}
const unavailable: InstallState = { prompt: null, installed: false };
const fallback: InstallStore = {
  getSnapshot: () => unavailable,
  subscribe: () => () => {},
  clearPrompt: () => {},
};

export function InstallAction({ className = '' }: { className?: string }) {
  const store = window.vibeSwipeInstall ?? fallback;
  const { prompt, installed } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const helpId = useId();
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent);

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
        setNotice('Installation was cancelled. You can also install from the Chrome menu.');
      }
    } catch (error) {
      console.warn('VibeSwipe installation prompt could not open.', error);
      store.clearPrompt(prompt);
      setNotice('Chrome could not open its install prompt. Use the browser menu below instead.');
      setShowHelp(true);
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;
  return <div className={`relative ${className}`}>
    <button onClick={() => void install()} disabled={busy} aria-expanded={showHelp} aria-controls={showHelp ? helpId : undefined}
      data-testid="button-install-app"
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-white/[.08] disabled:opacity-50">
      <Download size={16}/><span>{busy ? 'Opening…' : prompt ? 'Install app' : 'Install options'}</span>
    </button>
    {showHelp && <div id={helpId} className="absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/10 bg-[#26212a] p-4 text-left text-xs leading-5 text-muted-foreground shadow-xl"
      data-testid="text-install-help">
      <div className="mb-2 flex items-start justify-between gap-3">
        <strong className="text-sm text-foreground">Install VibeSwipe</strong>
        <button onClick={() => setShowHelp(false)} aria-label="Close install instructions" className="rounded p-1 hover:bg-white/10"><X size={14}/></button>
      </div>
      {notice && <p role="status" className="mb-3 text-rose-200">{notice}</p>}
      {prompt ? <button onClick={() => void install()} disabled={busy} className="mb-3 w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-[#24111b]">Install now</button>
        : <p className="mb-3">The browser hasn’t offered one-tap installation yet. Keep this page open briefly, or use its menu:</p>}
      {ios ? <ol className="list-decimal space-y-1 pl-4"><li>Open this website in Safari.</li><li>Tap <strong className="text-foreground">Share</strong>.</li><li>Choose <strong className="text-foreground">Add to Home Screen</strong>, then <strong className="text-foreground">Add</strong>.</li></ol>
        : <ol className="list-decimal space-y-1 pl-4"><li>Tap Chrome’s <strong className="text-foreground">⋮</strong> menu.</li><li>Choose <strong className="text-foreground">Add to Home screen</strong> or <strong className="text-foreground">Install app</strong>.</li><li>If asked, choose <strong className="text-foreground">Install</strong> and confirm.</li></ol>}
      <p className="mt-3">If no install option appears, update Chrome and open this site in a normal tab, not Incognito.</p>
    </div>}
  </div>;
}
