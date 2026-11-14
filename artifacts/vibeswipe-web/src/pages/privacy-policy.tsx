import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const sections = [
  {
    title: "Information Myage collects",
    body: "Myage stores the account and profile information you provide, including your name, age, gender, dating preferences, biography, interests, work, profile photos, and registered city, state, and country. When you use the service, it also processes likes, matches, profile views, messages and attachments, online status, and safety actions such as blocks and reports. Emergency contacts and temporary live-location details are processed only if you choose those Safety Center features.",
  },
  {
    title: "How information is used",
    body: "We use this information to create and display your profile, show relevant people, make matches, deliver messages and notifications, operate safety tools, and maintain the service. We do not sell personal information.",
  },
  {
    title: "What other members can see",
    body: "Profile details you add—such as your photo, name, age, location, biography, work, and interests—may be shown to other Myage members as part of discovery and profile views. Messages are visible to the people in that conversation. Safety reports, account credentials, and emergency-contact details are not displayed as public profile information. A live-location link is available to people you choose to share it with until it expires or is stopped.",
  },
  {
    title: "Service providers and storage",
    body: "Clerk handles account sign-in. Myage uses Replit-hosted application services, PostgreSQL, and file storage to operate the service and store profiles, messages, and uploaded media. These providers process information to provide their services to Myage; their own privacy terms also apply.",
  },
  {
    title: "Your choices",
    body: "You can update profile details from the Profile area and control safety and visibility features in Settings. Share only information you are comfortable showing to other members.",
  },
  {
    title: "Adults only and policy changes",
    body: "Myage is for people aged 18 and over. We do not knowingly allow minors to use the service. We may update this notice when the service or its data practices change; the current version will be available on this page.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground" data-testid="page-privacy-policy">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-privacy-home">
            <ArrowLeft size={16} /> Back to Myage
          </Link>
          <Link href="/" aria-label="Myage home" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-card text-primary">
            <span className="text-lg font-black leading-none">M</span>
          </Link>
        </header>

        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
          This is a plain-language privacy notice, not legal advice. The Myage operator should review it for the laws that apply to the business before relying on it as a final legal policy.
        </div>

        <div className="mt-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">Myage · myage.beauty</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              What information is used to help Myage work, and what stays private.
            </p>
          </div>
        </div>

        <div className="mt-7 divide-y divide-white/[.08] rounded-3xl border border-white/[.08] bg-card px-5">
          {sections.map((section, index) => (
            <section key={section.title} className="flex gap-4 py-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-xs font-extrabold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-sm font-bold">{section.title}</h2>
                <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{section.body}</p>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.08] pt-5 text-xs font-semibold text-muted-foreground">
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
          <Link href="/report-safety" className="hover:text-primary">Report a safety issue</Link>
          <Link href="/" className="hover:text-primary">Myage home</Link>
        </footer>
      </div>
    </main>
  );
}
