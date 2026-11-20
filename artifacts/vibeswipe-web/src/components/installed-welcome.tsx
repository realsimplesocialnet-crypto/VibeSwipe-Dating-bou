import { Download, LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Link } from 'wouter';
import { OnboardingVideoBackground } from './onboarding-video-background';
import { isCurrentAppShell } from '@/lib/android-webview';
import apkDownloadUrl, { shouldShowAndroidApkDownload } from '@/lib/apk-download';
import { usePwaInstallState } from '@/lib/pwa-install-state';

export function InstalledWelcome() {
  const install = usePwaInstallState();
  const showAndroidDownload = shouldShowAndroidApkDownload(navigator.userAgent, isCurrentAppShell(), install.installed || install.checkingInstalled);
  return <main data-testid="installed-app-welcome" className="onboarding-welcome">
    <OnboardingVideoBackground/>
    <header className="onboarding-welcome-brand justify-between" aria-label="MYAGEBEAUTY">
      <div className="flex items-center gap-[9px]">
        <img src={`${import.meta.env.BASE_URL}myage-icon-192-v7.png`} alt="" className="h-8 w-8 rounded-xl"/>
        <span className="brand text-[22px] font-extrabold tracking-[-.055em]">MYAGEBEAUTY</span>
      </div>
      {showAndroidDownload && <a href={apkDownloadUrl} download="MYAGEBEAUTY.apk" data-testid="link-download-android-apk" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90">
        <Download size={15}/>Download Android App
      </a>}
    </header>
    <span className="onboarding-welcome-preview">Onboarding preview</span>
    <footer className="onboarding-welcome-footer">
      <div className="onboarding-welcome-footer-inner">
        <h1 className="brand">Your next connection starts here.</h1>
        <p>Create your profile. Meet someone who gets you.</p>
        <div className="onboarding-welcome-actions">
          <Link href="/sign-up" data-testid="button-app-create-account" className="bg-[#F34E9A] text-[#24111b] shadow-lg shadow-pink-900/10 hover:bg-[#ff68aa]"><UserRoundPlus size={17}/>Create Account</Link>
          <Link href="/sign-in" data-testid="button-app-sign-in" className="border border-white/15 bg-[#1A1A1E] text-[#FBF5F7] hover:bg-[#252025]"><LockKeyhole size={16}/>Login</Link>
        </div>
        <div className="onboarding-welcome-legal">Adults 18+ · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/terms">Terms</Link></div>
      </div>
    </footer>
  </main>;
}
