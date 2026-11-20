import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

import apkDownloadUrl from '@/lib/apk-download';
import { isIOSDevice } from '@/lib/app-display-mode';
import { isCurrentAppShell, isDedicatedAppPath } from '@/lib/android-webview';
import InstallerLandingPage from '@/pages/installer-landing-page';

import './styles/installer-landing.css';

const WebViewAppEntry = lazy(() => import('./webview-app-entry'));
const PublicLegalEntry = lazy(() => import('./public-legal-entry'));
const artifactBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const dedicatedAppPath = `${artifactBasePath}/app`;
const inAppShell = isCurrentAppShell() || isDedicatedAppPath(window.location.pathname, dedicatedAppPath);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const scopedPath = artifactBasePath
  && (currentPath === artifactBasePath || currentPath.startsWith(`${artifactBasePath}/`))
  ? currentPath.slice(artifactBasePath.length) || '/'
  : currentPath;
const publicLegalPaths = new Set(['/privacy-policy', '/terms', '/community-guidelines']);
const isPublicLegalPage = publicLegalPaths.has(scopedPath);
const fallbackInstallLink = document.getElementById('installer-install-fallback');

if (fallbackInstallLink instanceof HTMLAnchorElement) {
  if (inAppShell || isPublicLegalPage) fallbackInstallLink.remove();
  else if (isIOSDevice(navigator)) {
    fallbackInstallLink.href = `${import.meta.env.BASE_URL}app`;
    fallbackInstallLink.removeAttribute('download');
    fallbackInstallLink.textContent = 'Open iPhone App';
  } else {
    fallbackInstallLink.href = apkDownloadUrl;
  }
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  inAppShell ? (
    <Suspense fallback={<main className="installer-page"><p className="installer-loading">Opening VIBESWIPES…</p></main>}>
      <WebViewAppEntry />
    </Suspense>
  ) : isPublicLegalPage ? (
    <Suspense fallback={<main className="installer-page"><p className="installer-loading">Loading VIBESWIPES information…</p></main>}>
      <PublicLegalEntry />
    </Suspense>
  ) : (
    <InstallerLandingPage />
  ),
);

