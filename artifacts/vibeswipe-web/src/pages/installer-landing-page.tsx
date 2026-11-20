import apkDownloadUrl from '@/lib/apk-download';
import { isIOSDevice } from '@/lib/app-display-mode';
import { isCurrentAppShell } from '@/lib/android-webview';

export default function InstallerLandingPage() {
  const inAppShell = isCurrentAppShell();
  const onIOS = isIOSDevice(navigator);

  return (
    <main className="installer-page" data-testid="installer-landing">
      <section className="installer-content">
        <div className="installer-brand" aria-label="Myage">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width="64"
            height="64"
            data-testid="img-myage-logo"
          />
          <span>Myage</span>
        </div>
        <h1 data-testid="text-install-tagline">Your next connection starts here.</h1>
        {!inAppShell && (
          <a
            className="installer-button"
            href={onIOS ? `${import.meta.env.BASE_URL}app` : apkDownloadUrl}
            download={onIOS ? undefined : 'Myage.apk'}
            data-testid={onIOS ? 'button-open-iphone-app' : 'button-install-apk'}
          >
            {onIOS ? 'Open iPhone App' : 'Install App'}
          </a>
        )}
        {onIOS && (
          <p className="installer-ios-help">
            On iPhone, open Myage in Safari, tap Share, then choose Add to Home Screen.
          </p>
        )}
      </section>
    </main>
  );
}
