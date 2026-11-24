import { ArrowLeft, ChevronRight, CircleHelp, Flag, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useAppLanguage } from "@/lib/app-language";

const articles = [
  {
    question: "How do I update my profile?",
    answer: "Open Profile, tap the edit icon, then update your photos or profile details. Changes are saved to your account when you save the form.",
  },
  {
    question: "How do I control who can see or contact me?",
    answer: "Open Settings, then Privacy. You can make your account private, choose who can comment or message, and control downloads and liked-Reel visibility.",
  },
  {
    question: "How do I report a Reel or profile?",
    answer: "Use the three-dot menu on a Reel to report it. Open a profile’s options or the Safety Center to report a profile. Reports go to the MyAgeBeauty review team.",
  },
  {
    question: "What can I do if something is not working?",
    answer: "Try again when your connection is stable. If the problem continues, use Report a problem and include what you were doing and what happened. Do not include your password or verification code.",
  },
  {
    question: "How do I manage notifications?",
    answer: "Open Settings and choose Notifications. You can change in-app preferences and manage browser or phone notification permission separately.",
  },
];

export default function HelpCenterPage() {
  const { t } = useAppLanguage();
  return <main className="min-h-[100dvh] bg-background px-4 pb-28 pt-[calc(env(safe-area-inset-top)+20px)] text-foreground sm:px-6">
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-help-back"><ArrowLeft size={18}/>{t("Settings")}</Link>
      <header className="mb-7 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><CircleHelp size={23}/></span>
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{t("Support")}</p><h1 className="mt-1 text-2xl font-extrabold">{t("Help Center")}</h1></div>
      </header>
      <p className="mb-6 text-sm leading-6 text-muted-foreground">{t("Find help with common MyAgeBeauty features and account settings.")}</p>
      <section aria-label={t("Help articles")} className="divide-y divide-white/[.07]">
        {articles.map(({ question, answer }) => <details key={question} className="group py-4">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex-1">{t(question)}</span><ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"/>
          </summary>
          <p className="max-w-xl pb-2 pt-2 text-sm leading-6 text-muted-foreground">{t(answer)}</p>
        </details>)}
      </section>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link href="/report-problem" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-[#25111c]" data-testid="link-help-report"><Flag size={18}/>{t("Report a problem")}</Link>
        <Link href="/safety-center" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white/[.07] px-4 font-bold" data-testid="link-help-safety"><ShieldCheck size={18}/>{t("Safety Center")}</Link>
      </div>
    </div>
  </main>;
}
