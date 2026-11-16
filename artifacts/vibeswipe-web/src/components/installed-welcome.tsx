import { LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Link } from 'wouter';
import { OnboardingVideoBackground } from './onboarding-video-background';

export function InstalledWelcome() {
  return <main data-testid="installed-app-welcome" className="onboarding-welcome">
    <OnboardingVideoBackground/>
    <header className="onboarding-welcome-brand" aria-label="Myage">
      <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="h-8 w-8 rounded-xl"/>
      <span className="brand text-[22px] font-extrabold tracking-[-.055em]">My<span className="text-[#F34E9A]">age</span></span>
    </header>
    <span className="onboarding-welcome-preview">Onboarding preview</span>
    <footer className="onboarding-welcome-footer">
      <div className="onboarding-welcome-footer-inner">
        <h1 className="brand">Your next connection starts here.</h1>
        <p>Create your profile. Meet someone who gets you.</p>
        <div className="onboarding-welcome-actions">
          <Link href="/sign-up" data-testid="button-app-create-account" className="bg-[#F34E9A] text-[#24111b] shadow-lg shadow-pink-900/10 hover:bg-[#ff68aa]"><UserRoundPlus size={17}/>Get Started</Link>
          <Link href="/sign-in" data-testid="button-app-sign-in" className="border border-white/15 bg-[#1A1A1E] text-[#FBF5F7] hover:bg-[#252025]"><LockKeyhole size={16}/>Log in</Link>
        </div>
        <div className="onboarding-welcome-legal">Adults 18+ · <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/terms">Terms</Link></div>
      </div>
    </footer>
  </main>;
}
