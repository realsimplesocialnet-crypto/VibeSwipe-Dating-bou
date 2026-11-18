import type { AnchorHTMLAttributes } from 'react';
import { ArrowRight, Heart, Shield, Download } from 'lucide-react';
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

export function Current() {
  return <div className="grain min-h-[100dvh] overflow-hidden">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Brand/><div className="flex items-center gap-3"><Link href="/sign-in" data-testid="link-sign-in" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">Sign in</Link><Link href="/sign-up" data-testid="link-sign-up" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#25111d] shadow-lg shadow-primary/15">Join Myage</Link></div></header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 md:min-h-[690px] md:grid-cols-[1.04fr_.96fr] md:px-10 md:py-14">
      <div className="pointer-events-none absolute -left-40 top-10 h-[420px] w-[420px] rounded-full bg-primary/[.08] blur-[100px]"/>
      <div className="relative z-10 max-w-[650px]">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[.07] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.13em] text-[#ff91c1]"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>For adults who mean it</div>
        <h1 className="brand max-w-[680px] text-[clamp(3.2rem,8vw,6.65rem)] font-extrabold leading-[.98] tracking-[-.07em] text-[#fff3f8]">Less swiping.<br/><span className="text-primary">More feeling.</span></h1>
        <p className="mt-7 max-w-[480px] text-base leading-7 text-muted-foreground md:text-lg">Meet people who show up as themselves. Make a real connection, then let the conversation take its time.</p>
        <div className="mt-9 flex flex-wrap items-center gap-3"><Link href="/sign-up" data-testid="button-start-meeting" className="inline-flex items-center gap-3 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-[#24111b] shadow-[0_14px_50px_rgba(242,72,151,.22)] transition-transform hover:-translate-y-0.5">Find your person <ArrowRight size={17}/></Link><InstallAction/></div>
        <div className="mt-12 flex items-center gap-7 border-t border-white/[.08] pt-6 text-xs text-muted-foreground"><div><strong className="block text-xl font-bold text-foreground">18+</strong>Adults only</div><span className="h-8 w-px bg-white/10"/><div><strong className="block text-xl font-bold text-foreground">Mutual</strong>matches to message</div><span className="h-8 w-px bg-white/10"/><div><strong className="block text-xl font-bold text-foreground">Your call</strong>privacy controls</div></div>
      </div>
      <div className="relative mx-auto w-full max-w-[470px] md:ml-auto">
        <div className="absolute -inset-8 rounded-[44%] bg-[radial-gradient(ellipse_at_center,rgba(227,61,132,.18),transparent_65%)]"/>
        <div className="relative rotate-[2deg] overflow-hidden rounded-[32px] border border-white/10 bg-[#25202a] p-3 shadow-2xl">
          <div className="relative aspect-[.79] overflow-hidden rounded-[25px] bg-[linear-gradient(145deg,#3c2836,#9e536c_46%,#d9898a)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_25%,rgba(255,215,190,.75),transparent_22%),linear-gradient(180deg,transparent_42%,rgba(20,13,20,.9))]"/>
            <div className="absolute left-[23%] top-[14%] h-[40%] w-[56%] rounded-[48%_48%_42%_42%] bg-[linear-gradient(135deg,#e6a98b,#a35d57)] shadow-[0_35px_65px_rgba(32,15,24,.3)]"/>
            <div className="absolute left-[13%] top-[47%] h-[56%] w-[75%] rounded-t-[45%] bg-[linear-gradient(135deg,#e0c1b6,#915561_70%)]"/>
            <div className="absolute inset-x-5 bottom-5 text-white"><div className="mb-3 flex gap-1.5"><span className="h-1 flex-1 rounded-full bg-white"/><span className="h-1 flex-1 rounded-full bg-white/30"/><span className="h-1 flex-1 rounded-full bg-white/30"/></div><div className="flex items-end justify-between"><div><div className="text-3xl font-bold tracking-tight">A little about me</div><p className="mt-1 text-sm text-white/75">Good conversation, always.</p></div><span className="rounded-full bg-black/25 px-3 py-1 text-xs backdrop-blur">Profile 01</span></div></div>
          </div>
        </div>
        <div className="absolute -left-10 top-14 rounded-2xl border border-white/10 bg-[#211c25]/95 px-4 py-3 shadow-xl backdrop-blur"><div className="flex items-center gap-2 text-sm font-bold"><Heart size={15} className="fill-primary text-primary"/>A better first hello</div><p className="mt-1 text-xs text-muted-foreground">Start with a little more than a photo.</p></div>
        <div className="absolute -right-3 bottom-12 rounded-2xl border border-white/10 bg-[#211c25]/95 px-4 py-3 shadow-xl backdrop-blur"><div className="flex items-center gap-2 text-sm font-bold"><Shield size={15} className="text-[#86d9b6]"/>Your boundaries, always</div><p className="mt-1 text-xs text-muted-foreground">Block, report, or take a pause.</p></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <div className="grid gap-8 border-t border-white/[.08] pt-8 md:grid-cols-[.7fr_1.3fr]"><div><span className="text-xs font-bold uppercase tracking-[.2em] text-primary">A different kind of spark</span><h2 className="brand mt-4 max-w-sm text-4xl font-bold leading-tight tracking-[-.05em]">Chemistry starts with showing up.</h2></div><div className="grid gap-8 sm:grid-cols-3">{[['01','A fuller picture','Photos are the start. Your words and interests make it yours.'],['02','A mutual yes','Only a mutual match opens the door to a conversation.'],['03','Room to be real','Simple safety controls keep your boundaries in your hands.']].map(([n,title,copy])=><article key={n} className="border-t border-primary/30 pt-4"><div className="text-xs font-bold text-primary">{n}</div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p></article>)}</div></div>
    </section>
    <section className="mx-auto mb-16 max-w-7xl px-5 md:px-10"><div className="relative overflow-hidden rounded-[30px] border border-white/[.09] bg-[#211d25] px-6 py-12 md:px-14 md:py-16"><div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"/><div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><span className="text-xs font-bold uppercase tracking-[.2em] text-primary">The next good thing</span><h2 className="brand mt-4 text-4xl font-bold tracking-[-.05em] md:text-5xl">Make space for a spark.</h2><p className="mt-3 text-sm text-muted-foreground">Myage is for adults 18 and over.</p></div><Link href="/sign-up" data-testid="button-join-bottom" className="rounded-xl bg-primary px-6 py-3.5 font-bold text-[#24111b]">Create your profile <ArrowRight size={16} className="ml-2 inline"/></Link></div></div></section>
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/[.08] px-5 py-7 text-xs text-muted-foreground md:px-10"><Brand/><span>Genuine connection, with your safety in mind.</span><div className="flex gap-4"><Link href="/sign-in" data-testid="footer-signin">Sign in</Link><Link href="/sign-up" data-testid="footer-signup">Join</Link></div></footer>
  </div>;
}
