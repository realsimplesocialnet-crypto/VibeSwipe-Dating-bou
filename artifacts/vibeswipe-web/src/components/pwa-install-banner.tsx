import { useState } from 'react';
import { ArrowDownToLine, Share, X } from 'lucide-react';
import { isCurrentAndroidWebView } from '@/lib/android-webview';
import { isIOSDevice, isMobileBrowser } from '@/lib/app-display-mode';
import { usePwaInstallState, shouldShowPwaInstallBanner } from '@/lib/pwa-install-state';

export function PwaInstallBanner() {
  const install = usePwaInstallState();
  const [showHelp, setShowHelp] = useState(false);
  const ios = isIOSDevice(navigator);
  const visible = shouldShowPwaInstallBanner({
    mobile: isMobileBrowser(navigator),
    appShell: isCurrentAndroidWebView(),
    installed: install.installed,
    checkingInstalled: install.checkingInstalled,
    dismissed: install.bannerDismissed,
  });

  if (!visible) return null;

  async function installApp() {
    if (!install.prompt || ios) {
      setShowHelp((current) => !current);
      return;
    }
    try {
      await install.prompt.prompt();
      const choice = await install.prompt.userChoice;
      const store = window.vibeSwipeInstall;
      store?.clearPrompt(install.prompt);
      if (choice.outcome === 'accepted') store?.confirmInstalled();
      else setShowHelp(true);
    } catch (error) {
      console.warn('VibeSwipes install prompt could not open.', error);
      window.vibeSwipeInstall?.clearPrompt(install.prompt);
      setShowHelp(true);
    }
  }

  return <aside data-testid="pwa-install-banner" className="sticky top-0 z-40 border-b border-primary/20 bg-card text-card-foreground shadow-sm">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
      <img src={`${import.meta.env.BASE_URL}vibeswipes-icon-192.png`} alt="" className="h-10 w-10 shrink-0 rounded-xl"/>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold leading-5">Get VibeSwipes on your Home Screen</p>
        <p className="text-[11px] text-muted-foreground">{ios ? 'Open it like an app whenever you want.' : 'Open it faster, right from your phone.'}</p>
      </div>
      <button type="button" onClick={() => void installApp()} aria-expanded={showHelp} aria-controls={showHelp ? 'myage-pwa-install-help' : undefined}
        data-testid="button-pwa-install" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">
        {ios ? <Share size={14}/> : <ArrowDownToLine size={14}/>}
        {ios ? 'Add to Home Screen' : install.prompt ? 'Install' : 'Install options'}
      </button>
      <button type="button" onClick={() => window.vibeSwipeInstall?.dismissBanner()} aria-label="Dismiss install banner" className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
        <X size={17}/>
      </button>
    </div>
    {showHelp && <div id="myage-pwa-install-help" role="region" aria-label="VibeSwipes installation steps" className="mx-auto max-w-6xl px-4 pb-3 text-xs leading-5 text-muted-foreground">
      {ios
        ? <>In Safari, tap <strong className="text-foreground">Share</strong>, choose <strong className="text-foreground">Add to Home Screen</strong>, then tap <strong className="text-foreground">Add</strong>.</>
        : <>Open your browser menu and choose <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>.</>}
      <button type="button" onClick={() => window.vibeSwipeInstall?.confirmInstalled()} className="ml-2 font-semibold text-primary underline">
        Already installed? Hide this
      </button>
    </div>}
  </aside>;
}
