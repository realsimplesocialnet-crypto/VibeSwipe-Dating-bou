import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const privacy = read("../src/pages/privacy-policy.tsx");
const terms = read("../src/pages/terms.tsx");
const webSettings = read("../src/components/settings/settings-pages.tsx");
const mobileSettings = read("../../vibeswipe/app/settings.tsx");
const mobilePrivacy = read("../../vibeswipe/app/privacy-policy.tsx");
const mobileTerms = read("../../vibeswipe/app/terms.tsx");
const mobileLayout = read("../../vibeswipe/app/_layout.tsx");
const mobileWelcome = read("../../vibeswipe/components/OnboardingWelcome.tsx");
const appEntry = read("../src/main.tsx");
const publicLegalEntry = read("../src/public-legal-entry.tsx");
const webApp = read("../src/App.tsx");
const installedWelcome = read("../src/components/installed-welcome.tsx");
const profileSignup = read("../src/components/profile-first-signup.tsx");

test("privacy notice names the operator, support channel, and deletion request path", () => {
  assert.match(privacy, /VIBESWIPES LIMITED/);
  assert.match(privacy, /registered in Nigeria/);
  assert.match(privacy, /Realsimplesocialnet@gmail\.com/);
  assert.match(privacy, /request access, correction, or deletion/i);
  assert.match(privacy, /This plain-language privacy notice is not legal advice/);
  assert.match(webSettings, /link-contact-support/);
  assert.match(webSettings, /link-request-account-deletion/);
  assert.match(mobileSettings, /button-contact-support/);
  assert.match(mobileSettings, /button-request-account-deletion/);
});

test("terms distinguish planned verification charges from active payments", () => {
  assert.match(terms, /not available or chargeable now/);
  assert.match(terms, /₦3,000 per month/);
  assert.match(terms, /renew monthly until you cancel/);
  assert.match(terms, /Cancellation stops the next renewal/);
  assert.match(terms, /verification is declined.*refunded/);
  assert.match(terms, /no partial-month refunds except where required by law/);
  assert.match(terms, /No card or Paystack payments are currently being processed/);
  assert.match(terms, /Google Play Billing/);
  assert.match(terms, /card acceptance may vary by country/);
  assert.match(mobilePrivacy, /VIBESWIPES LIMITED/);
  assert.match(mobileTerms, /₦3,000 per month/);
  assert.match(mobileTerms, /Google Play Billing/);
  assert.match(mobileTerms, /not available or chargeable now/);
  assert.match(mobileLayout, /section === "privacy-policy"/);
  assert.match(mobileLayout, /section === "terms"/);
  assert.match(mobileWelcome, /router\.push\("\/privacy-policy"\)/);
  assert.match(mobileWelcome, /router\.push\("\/terms"\)/);
});

test("VibeSwipes branding is published in website and PWA metadata", () => {
  const manifest = read("../public/manifest.json");
  const html = read("../index.html");
  assert.match(manifest, /"name": "VibeSwipes"/);
  assert.match(manifest, /"short_name": "VibeSwipes"/);
  assert.match(manifest, /vibeswipes-icon-192\.png/);
  assert.match(webApp, />VibeSwipes<\/span>/);
  assert.doesNotMatch(webApp, />My<span className="text-primary">age<\/span>/);
  assert.match(installedWelcome, />VibeSwipes<\/span>/);
  assert.match(profileSignup, />VibeSwipes<\/span>/);
  assert.match(html, /<title>VibeSwipes/);
  assert.doesNotMatch(html, /MYAGEBEAUTY|MYAGEBEAUTY/i);
  assert.match(privacy, /VibeSwipes is operated by VIBESWIPES LIMITED/);
});

test("public legal URLs bypass the install landing without exposing app routes", () => {
  assert.match(appEntry, /publicLegalPaths = new Set\(\['\/privacy-policy', '\/terms', '\/community-guidelines'\]\)/);
  assert.match(appEntry, /isPublicLegalPage/);
  assert.match(publicLegalEntry, /path="\/privacy-policy"/);
  assert.match(publicLegalEntry, /path="\/terms"/);
  assert.match(publicLegalEntry, /path="\/community-guidelines"/);
  assert.doesNotMatch(publicLegalEntry, /ClerkProvider|from "\.\/App"/);
});
