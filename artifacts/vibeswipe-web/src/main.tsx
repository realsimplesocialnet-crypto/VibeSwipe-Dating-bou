import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

import { isAuthEntryPath, isCurrentAppShell, isDedicatedAppPath } from '@/lib/android-webview';

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
  || isAuthEntryPath(scopedPath)
  || scopedPath === '/';
const publicLegalPaths = new Set(['/privacy-policy', '/terms', '/community-guidelines']);
const isPublicLegalPage = publicLegalPaths.has(scopedPath);
const loadingScreen = (message: string) => (
  <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24, color: '#fff5fa', fontFamily: 'system-ui, sans-serif' }}>
    <p>{message}</p>
  </main>
);

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  inAppShell ? (
    <Suspense fallback={loadingScreen('Opening VIBESWIPES…')}>
      <WebViewAppEntry />
    </Suspense>
  ) : isPublicLegalPage ? (
    <Suspense fallback={loadingScreen('Loading VIBESWIPES information…')}>
      <PublicLegalEntry />
    </Suspense>
  ) : (
    <Suspense fallback={loadingScreen('Opening VIBESWIPES…')}>
      <WebViewAppEntry />
    </Suspense>
  ),
);

