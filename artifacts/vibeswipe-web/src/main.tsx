import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

import apkDownloadUrl from '@/lib/apk-download';
import { isCurrentAppShell } from '@/lib/android-webview';
import InstallerLandingPage from '@/pages/installer-landing-page';

import './styles/installer-landing.css';

const WebViewAppEntry = lazy(() => import('./webview-app-entry'));
const inAppShell = isCurrentAppShell();
const fallbackInstallLink = document.getElementById('installer-install-fallback');

if (fallbackInstallLink instanceof HTMLAnchorElement) {
  if (inAppShell) fallbackInstallLink.remove();
  else fallbackInstallLink.href = apkDownloadUrl;
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  inAppShell ? (
    <Suspense fallback={<main className="installer-page"><p className="installer-loading">Opening Myage…</p></main>}>
      <WebViewAppEntry />
    </Suspense>
  ) : (
    <InstallerLandingPage />
  ),
);

