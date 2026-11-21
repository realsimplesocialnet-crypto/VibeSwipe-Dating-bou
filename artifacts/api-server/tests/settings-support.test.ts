import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("support requests, safety reports, and audit review are restricted to authenticated admins", () => {
  const api = source("artifacts/api-server/src/routes/vibeswipe.ts");
  const reels = source("artifacts/api-server/src/routes/vibeswipe-reels.ts");
  const admin = source("artifacts/api-server/src/routes/vibeswipe-admin.ts");
  assert.match(api, /router\.use\(requireAuth\)/);
  assert.match(api, /router\.post\("\/vibeswipe\/support-requests"/);
  assert.match(api, /router\.post\("\/vibeswipe\/screen-time"/);
  assert.match(reels, /router\.use\("\/vibeswipe\/reels", requireAuth\)/);
  assert.match(reels, /router\.post\("\/vibeswipe\/reels\/:reelId\/reports"/);
  assert.match(reels, /reel\.userId === reporterId/);
  assert.match(admin, /router\.use\("\/vibeswipe\/admin", adminGuard\)/);
  assert.match(admin, /router\.get\("\/vibeswipe\/admin\/reports"/);
  assert.match(admin, /router\.patch\("\/vibeswipe\/admin\/reports\/:reportId\/status"/);
  assert.match(admin, /router\.get\("\/vibeswipe\/admin\/audit"/);
  assert.match(admin, /auditPrivateAccess\(req, "update_report_status"/);
  assert.doesNotMatch(admin.slice(admin.indexOf('router.get("/vibeswipe/admin/reports"'), admin.indexOf('router.get("/vibeswipe/admin/audit"')), /messagesTable|private conversation/i);
});

test("settings UI exposes language, screen-time controls, keyword filters, and member support", () => {
  const settings = source("artifacts/vibeswipe-web/src/components/settings/settings-pages.tsx");
  const support = source("artifacts/vibeswipe-web/src/pages/report-problem.tsx");
  const help = source("artifacts/vibeswipe-web/src/pages/help-center.tsx");
  const reels = source("artifacts/vibeswipe-web/src/pages/reels-feed.tsx");
  const privacy = source("artifacts/vibeswipe-web/src/pages/privacy-policy.tsx");

  assert.match(settings, /value="hi">हिन्दी/);
  assert.match(settings, /value="fr">Français/);
  assert.match(settings, /value="yo">Yorùbá/);
  assert.match(settings, /settings-screen-time/);
  assert.match(settings, /settings-keyword-filters/);
  assert.match(support, /useSubmitSupportRequest/);
  assert.match(help, /Help Center/);
  assert.match(reels, /useReportReel/);
  assert.match(privacy, /Screen time counts only while VibeSwipes is visible in the foreground/);
});
