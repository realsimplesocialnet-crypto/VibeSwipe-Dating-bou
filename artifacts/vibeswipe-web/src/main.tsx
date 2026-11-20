import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

import { isAuthEntryPath, isCurrentAppShell, isDedicatedAppPath } from '@/lib/android-webview';
import PublicAuthLandingPage from '@/pages/public-auth-landing-page';

import './styles/public-auth-landing.css';

const WebViewAppEntry = lazy(() => import('./webview-app-entry'));
const PublicLegalEntry = lazy(() => import('./public-legal-entry'));
const artifactBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const dedicatedAppPath = `${artifactBasePath}/app`;
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const scopedPath = artifactBasePath
  && (currentPath === artifactBasePath || currentPath.startsWith(`${artifactBasePath}/`))
  ? currentPath.slice(artifactBasePath.length) || '/'
  : currentPath;
const inAppShell = isCurrentAppShell()
  || isDedicatedAppPath(window.location.pathname, dedicatedAppPath)
  || isAuthEntryPath(scopedPath);
const publicLegalPaths = new Set(['/privacy-policy', '/terms', '/community-guidelines']);
const isPublicLegalPage = publicLegalPaths.has(scopedPath);

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
    <PublicAuthLandingPage />
  ),
);

