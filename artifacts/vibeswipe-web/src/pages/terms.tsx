import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";

const supportEmail = "Realsimplesocialnet@gmail.com";

const sections = [
  {
    title: "1. Who operates VibeSwipes",
    body: "VibeSwipes is operated by VIBESWIPES LIMITED, a company registered in Nigeria. These Terms apply to the VibeSwipes website, progressive web app, and mobile app. By creating an account or using the service, you agree to these Terms. If you do not agree, do not use the service.",
  },
  {
    title: "2. Eligibility and your account",
    body: "You must be at least 18 years old and legally able to enter into these Terms. Provide accurate information, protect your sign-in details, and use one account for yourself. Do not impersonate anyone, create a misleading profile, or let another person use your account. You are responsible for activity through your account.",
  },
  {
    title: "3. The service",
    body: "VibeSwipes provides adult profiles, discovery, likes and matches, private messaging, Reels, Stories, and safety tools. Features may change, be limited, or be unavailable in some places. We do not promise a match, relationship, particular number of users, or uninterrupted service.",
  },
  {
    title: "4. Community rules",
    body: "Do not harass, threaten, exploit, discriminate against, or defraud anyone; post illegal, non-consensual, or sexually exploitative content; share another person's private information without permission; impersonate someone; spam; or use VibeSwipes to request money or run a scam. Respect consent and boundaries. A match is not consent to meet, send money, or share private information. Use Block and Report when needed.",
  },
  {
    title: "5. Your content",
    body: "You keep ownership of content you submit. You give VibeSwipes a worldwide, non-exclusive permission to host, store, adapt for display, and show that content only as needed to operate, secure, and improve the service and to make it available to the audiences you choose. Remove content you no longer want to share. Copies already received by other members and records retained for safety, legal, or security reasons may remain.",
  },
  {
    title: "6. Safety and verification",
    body: "Use care when communicating with or meeting people. VibeSwipes is not a background-check service and cannot guarantee another member's identity, conduct, or safety. Optional face verification checks a live image against a profile photo; it is not legal-identity, age, or location verification. Do not rely on a badge as a guarantee.",
  },
  {
    title: "7. Moderation and account status",
    body: "You can block or report members. We may review reports, remove content, restrict features, suspend, or close accounts when needed to protect members, investigate abuse, enforce these Terms, or comply with law. Deactivation hides your profile and can be reversed; it is not account deletion. To request account or personal-data deletion, contact the support team.",
  },
  {
    title: "8. Planned paid verification",
    body: "Paid verification is planned but is not available or chargeable now. The planned base price is ₦3,000 per month. When launched, the checkout screen will show the price and currency available to you; price, currency, and card acceptance may vary by country, card issuer, processor, and platform. Do not send card details to VibeSwipes support.",
  },
  {
    title: "9. Future subscriptions, cancellation, and refunds",
    body: "If the planned verification subscription launches, it will renew monthly until you cancel it through the place where you purchased it. Cancellation stops the next renewal, and access continues through the paid period. If verification is declined or VibeSwipes cannot provide it, the charge will be refunded. Otherwise, there are no partial-month refunds except where required by law. Any required refund process and timing will be shown by the billing provider.",
  },
  {
    title: "10. Cards and app-store billing",
    body: "No card or Paystack payments are currently being processed. Paystack may be considered for eligible card payments after launch, but it is not integrated now. For digital features in an Android app distributed through Google Play, Google Play Billing will be used unless an alternative billing method is expressly permitted and available under Google Play policy. Other platforms may have different purchase rules. The available payment methods will be shown before purchase.",
  },
  {
    title: "11. Privacy and account deletion",
    body: "Our Privacy Policy explains how information is handled. Deactivating an account only hides the profile. To request deletion, email the support team from Settings or the contact link below; we will verify and handle the request under applicable law. Some records may be retained where necessary for legal compliance, safety, security, or dispute resolution.",
  },
  {
    title: "12. Intellectual property and service availability",
    body: "VibeSwipes and its licensors own the service software, branding, and materials other than member content. Do not copy, reverse engineer, disrupt, or misuse the service, or use its content commercially without permission. The service is provided as available, subject to consumer and other rights that cannot be excluded under applicable law.",
  },
  {
    title: "13. Changes, law, and contact",
    body: `We may update these Terms and will post the current version here. Last updated November 20, 2026. Nigerian law governs these Terms except where mandatory law in your place of residence gives you rights that cannot be waived. Questions, privacy requests, and deletion requests: ${supportEmail}.`,
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground" data-testid="page-terms">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-terms-home">
          <ArrowLeft size={16} /> Back to VibeSwipes
        </Link>
        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
          These plain-language Terms are not legal advice. VIBESWIPES LIMITED should have them reviewed by qualified counsel for the countries where the service operates.
        </div>
        <div className="mt-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">VibeSwipes</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Rules for using the VibeSwipes service.</p>
          </div>
        </div>
        <div className="mt-7 divide-y divide-white/[.08] rounded-3xl border border-white/[.08] bg-card px-5">
          {sections.map((section) => (
            <section key={section.title} className="py-5">
              <h2 className="text-sm font-bold">{section.title}</h2>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <footer className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.08] pt-5 text-xs font-semibold text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
          <Link href="/community-guidelines" className="hover:text-primary">Community Guidelines</Link>
          <a href={`mailto:${supportEmail}?subject=VibeSwipes%20safety%20report`} className="hover:text-primary">Report a safety issue</a>
          <a href={`mailto:${supportEmail}?subject=VibeSwipes%20support%20request`} className="hover:text-primary">Contact support</a>
        </footer>
      </div>
    </main>
  );
}
