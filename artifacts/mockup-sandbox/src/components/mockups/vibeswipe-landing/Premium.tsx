import type { AnchorHTMLAttributes } from 'react';
import { ArrowRight, Heart, Shield, Download, UserRound } from 'lucide-react';
import './_group.css';
const pathFor=(path:string)=>'/__mockup/images/vibeswipe-landing'+path;
function Link({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement> & {href:string}) { return <a {...props} href={href} onClick={event=>event.preventDefault()}/>; }
function InstallAction(){return <button className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm font-semibold text-foreground"><Download size={16}/>Install options</button>;}
function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand">
    <img src={pathFor('/icon.png')} alt="" className="h-9 w-9 rounded-xl ring-1 ring-white/10" />
    {!compact && <span className="brand text-[21px] font-extrabold text-[#fff2f7]">vibe<span className="text-primary">swipe</span></span>}
  </Link>;
}

export function Premium() {
  const principles = [
    { n: '01', icon: UserRound, title: 'A fuller picture', copy: 'Photos are the start. Your words and interests make a profile yours.' },
    { n: '02', icon: Heart, title: 'A mutual yes', copy: 'Only a mutual match opens the door to a conversation.' },
    { n: '03', icon: Shield, title: 'Room to be real', copy: 'Block, report or take a pause. Your boundaries stay in your hands.' },
  ];
  return <div className="landing grain min-h-[100dvh] overflow-x-hidden">
    <header className="landing-header mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 md:px-10">
      <Brand/>
      <nav className="flex items-center gap-1.5 sm:gap-2">
        <Link href="/sign-in" data-testid="link-sign-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-4">Sign in</Link>
        <Link href="/sign-up" data-testid="link-sign-up" className="whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#25111d] transition-colors hover:bg-[#ff68aa]">Join<span className="hidden sm:inline"> VibeSwipe</span></Link>
      </nav>
    </header>

    <section className="landing-rise mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_.9fr] md:items-center md:gap-16 md:px-10 md:pb-24 md:pt-16">
      <div>
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#ff91c1]"><span className="h-px w-8 bg-primary"/>For adults who mean it</div>
        <h1 className="brand mt-6 text-[clamp(2.75rem,11vw,5.6rem)] font-extrabold leading-[1.02] tracking-[-.055em] text-[#fff3f8]">Less swiping.<br/><span className="text-primary">More feeling.</span></h1>
        <p className="mt-6 max-w-[460px] text-[17px] leading-[1.7] text-[#c3b7c0]">Meet people who show up as themselves. Make a real connection, then let the conversation take its time.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/sign-up" data-testid="button-start-meeting" className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-[15px] font-bold text-[#24111b] transition-colors hover:bg-[#ff68aa]">Find your person <ArrowRight size={17}/></Link>
          <InstallAction/>
        </div>
      </div>

      <div className="w-full md:max-w-[420px] md:justify-self-end">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1d1a21]">
          <div className="relative aspect-[4/3.4] overflow-hidden bg-[linear-gradient(160deg,#3c2836,#874a62_55%,#c27c84)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_22%,rgba(255,215,190,.45),transparent_40%)]"/>
            <div className="absolute left-1/2 top-[16%] h-[44%] w-[40%] -translate-x-1/2 rounded-[48%_48%_42%_42%] bg-[linear-gradient(160deg,#e6a98b,#a35d57)]"/>
            <div className="absolute bottom-0 left-1/2 h-[42%] w-[72%] -translate-x-1/2 rounded-t-[46%] bg-[linear-gradient(160deg,#e0c1b6,#915561_75%)]"/>
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1d1a21] to-transparent"/>
            <div className="absolute inset-x-5 top-5 flex gap-1.5"><span className="h-1 flex-1 rounded-full bg-white/90"/><span className="h-1 flex-1 rounded-full bg-white/30"/><span className="h-1 flex-1 rounded-full bg-white/30"/></div>
          </div>
          <div className="px-6 pb-6 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground">Illustrative profile</div>
            <div className="brand mt-2 text-2xl font-bold text-[#fff2f7]">A little about me</div>
            <p className="mt-1 text-sm text-[#c3b7c0]">Good conversation, always.</p>
          </div>
          <div className="grid border-t border-white/[.08] sm:grid-cols-2">
            <div className="flex gap-3 px-6 py-5"><Heart size={17} className="mt-0.5 shrink-0 fill-primary text-primary"/><div><div className="text-sm font-bold">A better first hello</div><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Start with more than a photo.</p></div></div>
            <div className="flex gap-3 border-t border-white/[.08] px-6 py-5 sm:border-l sm:border-t-0"><Shield size={17} className="mt-0.5 shrink-0 text-[#86d9b6]"/><div><div className="text-sm font-bold">Your boundaries</div><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Block, report or pause.</p></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 md:px-10">
      <dl className="grid grid-cols-3 border-y border-white/[.08]">
        {[['18+','Adults only'],['Mutual','Matches to message'],['Your call','Privacy controls']].map(([v,l],i)=><div key={v} className={`py-6 pr-2 ${i>0?'border-l border-white/[.08] pl-4 md:pl-8':''}`}><dt className="text-[12px] leading-5 text-muted-foreground md:text-sm">{l}</dt><dd className="brand order-first mt-1 text-lg font-bold text-foreground md:text-2xl">{v}</dd></div>)}
      </dl>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-28">
      <div className="grid gap-10 md:grid-cols-[.8fr_1.2fr] md:gap-16">
        <div><span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">A different kind of spark</span><h2 className="brand mt-4 max-w-sm text-[2.1rem] font-bold leading-[1.12] tracking-[-.045em] md:text-[2.6rem]">Chemistry starts with showing up.</h2></div>
        <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
          {principles.map(({n,icon:Icon,title,copy})=><article key={n} className="grid grid-cols-[auto_1fr] gap-5 py-7"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/[.08] text-primary"><Icon size={18}/></div><div><div className="flex items-baseline gap-3"><span className="text-xs font-bold tabular-nums text-primary">{n}</span><h3 className="text-lg font-bold">{title}</h3></div><p className="mt-2 max-w-md text-[15px] leading-7 text-muted-foreground">{copy}</p></div></article>)}
        </div>
      </div>
    </section>

    <section className="mx-auto mb-16 max-w-6xl px-5 md:px-10">
      <div className="rounded-[28px] border border-white/[.09] bg-[linear-gradient(135deg,#231d27,#2a1c26)] px-6 py-12 md:px-14 md:py-16">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div><span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">The next good thing</span><h2 className="brand mt-4 text-[2.1rem] font-bold leading-[1.1] tracking-[-.045em] md:text-5xl">Make space for a spark.</h2><p className="mt-3 text-[15px] text-muted-foreground">VibeSwipe is for adults 18 and over.</p></div>
          <Link href="/sign-up" data-testid="button-join-bottom" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-bold text-[#24111b] transition-colors hover:bg-[#ff68aa] sm:w-auto">Create your profile <ArrowRight size={16}/></Link>
        </div>
      </div>
    </section>

    <footer className="mx-auto flex max-w-6xl flex-col gap-5 border-t border-white/[.08] px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-10"><Brand/><span>Genuine connection, with your safety in mind.</span><div className="flex gap-5"><Link href="/sign-in" data-testid="footer-signin" className="hover:text-foreground">Sign in</Link><Link href="/sign-up" data-testid="footer-signup" className="hover:text-foreground">Join</Link></div></footer>
  </div>;
}
