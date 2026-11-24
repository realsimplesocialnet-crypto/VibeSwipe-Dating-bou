import { LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Link } from 'wouter';
import { OnboardingVideoBackground } from './onboarding-video-background';
import { useAppLanguage } from '@/lib/app-language';

export function InstalledWelcome() {
  const { t } = useAppLanguage();
  return <main data-testid="installed-app-welcome" className="onboarding-welcome">
    <OnboardingVideoBackground/>
    <header className="onboarding-welcome-brand" aria-label="MyAgeBeauty">
      <div className="flex items-center gap-[9px]">
        <img src={`${import.meta.env.BASE_URL}myage-monochrome-icon-192.png`} alt="" className="h-8 w-8 rounded-xl"/>
        <span className="brand text-[22px] font-extrabold tracking-[-.055em]">MyAgeBeauty</span>
      </div>
    </header>
    <span className="onboarding-welcome-preview">Onboarding preview</span>
    <footer className="onboarding-welcome-footer">
      <div className="onboarding-welcome-footer-inner">
        <h1 className="brand">{t("Share your world here.")}</h1>
        <p>{t("Post photos and Reels, follow people, and keep in touch.")}</p>
        <div className="onboarding-welcome-actions">
          <Link href="/sign-up" data-testid="button-app-create-account" className="bg-primary text-primary-foreground shadow-lg shadow-black/10 hover:opacity-90"><UserRoundPlus size={17}/>{t("Create Account")}</Link>
          <Link href="/sign-in" data-testid="button-app-sign-in" className="border border-white/15 bg-[#111111] text-white hover:bg-[#252525]"><LockKeyhole size={16}/>{t("Login")}</Link>
        </div>
        <div className="onboarding-welcome-legal">Adults 18+ · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/terms">Terms</Link></div>
      </div>
    </footer>
  </main>;
}
