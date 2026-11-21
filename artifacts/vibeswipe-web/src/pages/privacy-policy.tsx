import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const supportEmail = "Realsimplesocialnet@gmail.com";

const sections = [
  {
    title: "Who we are",
    body: "VibeSwipes is operated by VIBESWIPES LIMITED, a company registered in Nigeria. This notice applies to the VibeSwipes website, progressive web app, and mobile app. The service is intended for adults worldwide. Mandatory privacy rights in the country where you live continue to apply.",
  },
  {
    title: "Information we collect",
    body: "We process account and profile information you provide, such as your name, age, email or account identifier, gender, dating preferences, biography, interests, work, photos and videos, and the city, state, or country you choose to add. We also process activity needed to run the service, including likes, matches, follows, profile views, Reels, Stories, captions, comments, saved or reposted content, messages, attachments, blocks, reports, support requests, keyword-filter preferences, and daily VibeSwipes screen-time totals.",
  },
  {
    title: "Location and safety information",
    body: "You choose your country during signup; signup does not request device location. If you enable a nearby-discovery feature or choose temporary live-location sharing in Safety Center, we may process device location for that feature. A live-location link is shared only with people you choose and remains available until it expires or you stop it. Emergency-contact details are processed only when you choose that feature.",
  },
  {
    title: "Optional face verification",
    body: "If face verification is available and you choose to use it, a live camera image and the profile photo selected for checking are sent to Luxand for liveness and face-similarity checks. The live camera frame is not saved as a profile or message photo by VibeSwipes. A protected checked copy of the selected profile photo may be stored as verification evidence and, after a successful check, used as your main profile photo; it is shown according to your account settings and remains subject to normal profile-photo retention. Verification records can include photo references, status, and review details. Face checks are optional, are not proof of legal identity, and do not establish your age or location. Routine cleanup removes pending, processing, failed, or passed session records after 24 hours; requests awaiting review are expired after 30 days, and completed or cancelled session records are removed after 90 days. That session cleanup does not remove a checked photo that remains on your profile. Luxand's own terms and retention practices also apply.",
  },
  {
    title: "How we use information",
    body: "We use information to create and display profiles, support discovery and matching, deliver messages and notifications, provide safety and moderation tools, respond to requests, prevent abuse, secure the service, and maintain its features. Screen time counts only while VibeSwipes is visible in the foreground; it does not monitor time in other phone apps. Keyword filters are saved to your account settings and hide matching Reel captions or comments for you. We do not sell personal information.",
  },
  {
    title: "What other people can see",
    body: "Information and content you post may be shown according to your account and audience settings. Public content may be visible to people beyond your approved followers. Private-account content is limited to approved followers. Messages and attachments are available to the people in that conversation. A location link is available to the recipients you select. Do not post anything you are not comfortable sharing with that audience.",
  },
  {
    title: "Service providers and sharing",
    body: "Clerk provides account authentication. Replit hosts application services, the database, and file storage. Luxand processes face-verification images when you choose that feature. Expo and the relevant browser or device push service may process notification tokens and delivery information. These providers process data to provide their services. We may also disclose information when legally required or when reasonably necessary to protect users, investigate abuse, enforce our terms, or protect the service.",
  },
  {
    title: "Authorized administrator access",
    body: "Authorized administrators may review account details, online status, posts, stored conversations, and attachments for support, safety, moderation, and service operation. Private conversation inspection, media access, and conversation exports are recorded in an administrator access log. This does not give administrators access to activity in other apps or to messages you have not sent.",
  },
  {
    title: "Retention, access, and deletion requests",
    body: "We keep account information while your account is active and as needed to provide the service, protect members, resolve disputes, and meet legal obligations. Deactivating an account hides your profile but is reversible and does not itself delete stored information. To request access, correction, or deletion, email the support team. We will verify and handle the request under the laws that apply; some information may need to be retained for safety, legal, or security reasons.",
  },
  {
    title: "Your choices and device storage",
    body: "You can edit profile details, manage visibility and safety settings, block or report members, and control device notifications in the app. The web app uses essential browser storage and session cookies for sign-in, settings, and installation state; disabling them may prevent some features from working. Payments are not currently enabled. We will update this notice before collecting payment information for a future paid feature.",
  },
  {
    title: "International processing, security, and children",
    body: "Because VibeSwipes serves users in multiple countries, our service providers may process information outside your country, subject to protections required by applicable law. We use access controls and other safeguards, but no online service can guarantee absolute security. VibeSwipes is for adults aged 18 and over; do not create an account if you are under 18.",
  },
  {
    title: "Updates and contact",
    body: `We may update this policy when the service or its data practices change. The latest version will be posted here. Last updated November 20, 2026. For privacy questions or requests, contact ${supportEmail}.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground" data-testid="page-privacy-policy">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-privacy-home">
            <ArrowLeft size={16} /> Back to VibeSwipes
          </Link>
          <Link href="/" aria-label="VibeSwipes home" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-card text-primary">
            <span className="text-lg font-black leading-none">V</span>
          </Link>
        </header>

        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-xs leading-5 text-amber-100/80" role="note">
          This plain-language privacy notice is not legal advice. VIBESWIPES LIMITED should have it reviewed by qualified counsel for the countries where the service operates.
        </div>

        <div className="mt-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">VibeSwipes</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              How VibeSwipes handles information when you use the service.
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
          <Link href="/community-guidelines" className="hover:text-primary">Community Guidelines</Link>
          <a href={`mailto:${supportEmail}?subject=VibeSwipes%20safety%20report`} className="hover:text-primary">Report a safety issue</a>
          <a href={`mailto:${supportEmail}?subject=VibeSwipes%20privacy%20request`} className="hover:text-primary">Contact support</a>
        </footer>
      </div>
    </main>
  );
}
