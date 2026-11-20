import apkDownloadUrl from '@/lib/apk-download';
import { isCurrentAppShell } from '@/lib/android-webview';

export default function InstallerLandingPage() {
  const inAppShell = isCurrentAppShell();

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
            href={apkDownloadUrl}
            download="Myage.apk"
            data-testid="button-install-apk"
          >
            Install App
          </a>
        )}
      </section>
    </main>
  );
}
