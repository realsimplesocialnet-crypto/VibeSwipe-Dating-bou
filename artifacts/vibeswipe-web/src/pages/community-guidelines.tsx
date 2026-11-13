import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const guidelines = [
  {
    title: "Be respectful",
    detail: "Treat every person with care. Harassment, hate speech, threats, and unwanted pressure are not welcome.",
  },
  {
    title: "Be genuine",
    detail: "Use an accurate profile and represent yourself honestly.",
  },
  {
    title: "Respect consent",
    detail: "A match is not consent to share private information, images, or contact details.",
  },
  {
    title: "Keep it safe",
    detail: "Do not request or send money. Report suspicious behavior and use Block when needed.",
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/safety-center"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          data-testid="link-guidelines-back"
        >
          <ArrowLeft size={15} /> Back to Safety Center
        </Link>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">VibeSwipe community</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Community guidelines</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              VibeSwipe is for adults looking to meet with respect, honesty, and care.
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
      </div>
    </main>
  );
}
