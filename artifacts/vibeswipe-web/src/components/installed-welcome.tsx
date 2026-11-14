import { Heart, LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Link } from 'wouter';

export function InstalledWelcome() {
  return <main data-testid="installed-app-welcome" className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#100e14] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-foreground">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-[radial-gradient(ellipse_82%_58%_at_50%_0%,rgba(179,66,151,.24),rgba(118,58,145,.12)_44%,transparent_76%)]"/>
    <div className="relative flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
      <div className="mb-10 flex items-center justify-center gap-3" aria-label="VibeSwipe">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-200/10 bg-[linear-gradient(145deg,rgba(239,72,151,.2),rgba(128,73,169,.2))] shadow-[0_8px_30px_rgba(229,62,151,.12)]">
          <Heart size={25} strokeWidth={2.5} className="fill-[#ff4e9b] text-[#ff4e9b]"/>
        </span>
        <span className="brand text-[25px] font-extrabold tracking-[-.055em] text-white">Vibe<span className="text-[#ff5ca6]">Swipe</span></span>
      </div>
      <h1 className="brand text-[2.65rem] font-extrabold leading-[1.06] tracking-[-.055em] text-white">Welcome to<br/>VibeSwipe.</h1>
      <p className="mt-4 max-w-[300px] text-[15px] leading-6 text-[#aaa2b1]">Create your account or sign in to continue.</p>
      <div className="mt-9 grid w-full gap-3">
        <Link href="/sign-up" data-testid="button-app-create-account" className="flex min-h-[60px] items-center justify-center gap-3 rounded-2xl bg-[#f34e9a] px-5 py-4 text-base font-bold text-[#27111d] shadow-[0_10px_32px_rgba(243,78,154,.22)] transition-colors hover:bg-[#ff68aa]">
          <UserRoundPlus size={19} strokeWidth={2.2}/>Create account
        </Link>
        <Link href="/sign-in" data-testid="button-app-sign-in" className="flex min-h-[58px] items-center justify-center gap-3 rounded-2xl border border-white/[.14] bg-white/[.035] px-5 py-4 text-base font-semibold text-[#f3edf3] transition-colors hover:bg-white/[.07]">
          <LockKeyhole size={17}/>Sign in
        </Link>
      </div>
    </div>
    <div className="relative flex w-full max-w-sm items-center justify-center gap-2 text-center text-xs">
      <span className="text-[#8f8997]">For adults 18 and over</span>
      <span aria-hidden="true" className="text-[#827987]">•</span>
      <Link href="/community-guidelines" className="font-medium text-[#ff70b0] hover:text-[#ff9ac8]">Community guidelines</Link>
    </div>
  </main>;
}
