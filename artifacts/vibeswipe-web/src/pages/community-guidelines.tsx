import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const guidelines = [
  {
    title: "Adults 18 and over",
    detail: "VIBESWIPES is for adults only. Do not create an account if you are under 18, and keep your profile information honest.",
  },
  {
    title: "Respect other people",
    detail: "Harassment, hate speech, threats, unwanted pressure, and sharing someone’s private information are not allowed.",
  },
  {
    title: "No scams or impersonation",
    detail: "Do not request or send money, misrepresent who you are, impersonate another person, or use a fake profile.",
  },
  {
    title: "Respect consent and boundaries",
    detail: "A match is not consent to share private information, images, or contact details. Use Block or Report when needed.",
  },
  {
    title: "Use VIBESWIPES responsibly",
    detail: "Do not use the service to threaten, defraud, spam, or harm others. VIBESWIPES may restrict accounts that violate these rules.",
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground" data-testid="page-terms">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="link-guidelines-back">
          <ArrowLeft size={15} /> Back to VIBESWIPES
        </Link>
        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
          These community rules are not legal advice. VIBESWIPES LIMITED should have its legal documents reviewed by qualified counsel.
        </div>
        <div className="mt-7 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">VIBESWIPES</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Community Guidelines</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              VIBESWIPES is an adults-only dating service. By creating an account or using VIBESWIPES, you agree to follow these rules.
            </p>
          </div>
        </div>
        <div className="mt-7 divide-y divide-white/[.08] rounded-3xl border border-white/[.08] bg-card px-5">
          {guidelines.map((item, index) => (
            <section key={item.title} className="flex gap-4 py-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-xs font-extrabold text-primary">
                {index + 1}
              </span>
              <div>
                <h2 className="text-sm font-bold">{item.title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            </section>
          ))}
        </div>
        <footer className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.08] pt-5 text-xs font-semibold text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
          <a href="mailto:Realsimplesocialnet@gmail.com?subject=VIBESWIPES%20safety%20report" className="hover:text-primary">Report a safety issue</a>
          <a href="mailto:Realsimplesocialnet@gmail.com?subject=VIBESWIPES%20support%20request" className="hover:text-primary">Contact support</a>
          <Link href="/" className="hover:text-primary">VIBESWIPES home</Link>
        </footer>
      </div>
    </main>
  );
}
