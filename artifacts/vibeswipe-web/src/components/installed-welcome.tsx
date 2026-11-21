import { LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Link } from 'wouter';
import { OnboardingVideoBackground } from './onboarding-video-background';
import { useAppLanguage } from '@/lib/app-language';

export function InstalledWelcome() {
  const { t } = useAppLanguage();
  return <main data-testid="installed-app-welcome" className="onboarding-welcome">
    <OnboardingVideoBackground/>
    <header className="onboarding-welcome-brand" aria-label="VibeSwipes">
      <div className="flex items-center gap-[9px]">
        <img src={`${import.meta.env.BASE_URL}vibeswipes-icon-192.png`} alt="" className="h-8 w-8 rounded-xl"/>
        <span className="brand text-[22px] font-extrabold tracking-[-.055em]">VibeSwipes</span>
      </div>
    </header>
    <span className="onboarding-welcome-preview">Onboarding preview</span>
    <footer className="onboarding-welcome-footer">
      <div className="onboarding-welcome-footer-inner">
        <h1 className="brand">{t("Your next connection starts here.")}</h1>
        <p>{t("Create your profile. Meet someone who gets you.")}</p>
        <div className="onboarding-welcome-actions">
          <Link href="/sign-up" data-testid="button-app-create-account" className="bg-[#F34E9A] text-[#24111b] shadow-lg shadow-pink-900/10 hover:bg-[#ff68aa]"><UserRoundPlus size={17}/>{t("Create Account")}</Link>
          <Link href="/sign-in" data-testid="button-app-sign-in" className="border border-white/15 bg-[#1A1A1E] text-[#FBF5F7] hover:bg-[#252025]"><LockKeyhole size={16}/>{t("Login")}</Link>
        </div>
        <div className="onboarding-welcome-legal">Adults 18+ · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/terms">Terms</Link></div>
      </div>
    </footer>
  </main>;
}
