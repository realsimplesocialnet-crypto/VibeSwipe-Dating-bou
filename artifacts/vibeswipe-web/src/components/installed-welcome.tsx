import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { InstallAction } from '@/components/install-action';
import { useStandaloneMode } from '@/lib/app-display-mode';

export function InstalledWelcome() {
  const standalone=useStandaloneMode();
  return <main data-testid="installed-app-welcome" className="flex min-h-[100dvh] flex-col bg-background px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-foreground">
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="VibeSwipe" className="mb-7 h-20 w-20 rounded-[24px] ring-1 ring-white/10"/>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">VibeSwipe · 18+</p>
      <h1 className="brand mt-4 text-4xl font-extrabold leading-[1.08] tracking-[-.05em]">Welcome to<br/>VibeSwipe.</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">Create your account or sign in to continue.</p>
      <div className="mt-10 grid gap-3">
        <Link href="/sign-up" data-testid="button-app-create-account" className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-4 text-base font-bold text-[#24111b]">Create account <ArrowRight size={18}/></Link>
        <Link href="/sign-in" data-testid="button-app-sign-in" className="flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[.03] px-5 py-4 text-base font-bold">Sign in</Link>
      </div>
      {!standalone&&<div className="mt-6 text-center"><p className="mb-3 text-xs leading-5 text-muted-foreground">Use VibeSwipe here in your browser, or install it on your phone.</p><div className="inline-block"><InstallAction/></div></div>}
    </div>
    <div className="mx-auto w-full max-w-sm text-center">
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15}/>For adults 18 and over.</p>
      <Link href="/community-guidelines" className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4">Community guidelines</Link>
    </div>
  </main>;
}
