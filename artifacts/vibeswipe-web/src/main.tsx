import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

import { isAuthEntryPath, isCurrentAppShell, isDedicatedAppPath } from '@/lib/android-webview';
import { RouteSkeleton } from '@/components/route-skeleton';

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
const loadingScreen = (message: string) => <RouteSkeleton label={message} />;

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  inAppShell ? (
    <Suspense fallback={loadingScreen('Opening MyAgeBeauty…')}>
      <WebViewAppEntry />
    </Suspense>
  ) : isPublicLegalPage ? (
    <Suspense fallback={loadingScreen('Loading MyAgeBeauty information…')}>
      <PublicLegalEntry />
    </Suspense>
  ) : (
    <Suspense fallback={loadingScreen('Opening MyAgeBeauty…')}>
      <WebViewAppEntry />
    </Suspense>
  ),
);

const splash = document.getElementById("app-splash");
if (splash) {
  const root = document.documentElement;
  const removeSplash = () => {
    if (!splash.isConnected) return;
    splash.style.opacity = "0";
    window.setTimeout(() => splash.remove(), 400);
  };
  const dismissSplash = () => {
    if (root.classList.contains("is-auth-loading")) return;
    removeSplash();
    observer.disconnect();
  };
  const observer = new MutationObserver(dismissSplash);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  dismissSplash();
  window.setTimeout(() => {
    observer.disconnect();
    removeSplash();
  }, 8000);
}

