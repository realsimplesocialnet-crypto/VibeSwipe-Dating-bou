import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canApproveVerification, promoteVerificationPhoto, REVIEW_MAX_AGE_MS } from "../src/lib/face-verification-policy.ts";

const eligible = {
  status: "awaiting_review", checked: true,
  sealedPhoto: "media:11111111-1111-4111-8111-111111111111",
  expectedMainPhoto: "main", currentMainPhoto: "main",
  suspended: false, deactivated: false, demo: false, alreadyVerified: false,
  createdAt: new Date(), now: Date.now(),
};
test("server-checked evidence is eligible for automatic activation without an administrator", () => {
  assert.equal(canApproveVerification(eligible), true);
});
test("unverified, replayed, stale, blocked and changed-profile evidence cannot activate a badge", () => {
  for (const change of [
    { status: "pending" }, { status: "processing" }, { status: "failed" }, { status: "approved" },
    { status: "cancelled" }, { checked: false }, { sealedPhoto: null }, { sealedPhoto: "https://example.com/photo" },
    { currentMainPhoto: "different" }, { suspended: true }, { deactivated: true },
    { demo: true }, { alreadyVerified: true }, { now: eligible.createdAt.getTime() + REVIEW_MAX_AGE_MS },
  ]) assert.equal(canApproveVerification({ ...eligible, ...change }), false);
});
test("the exact checked photo becomes main and gallery selection does not duplicate it", () => {
  assert.deepEqual(promoteVerificationPhoto(["a", "b", "c"], "b", "sealed"), ["sealed", "a", "c"]);
  assert.deepEqual(promoteVerificationPhoto(["a", "b", "c"], "new", "sealed"), ["sealed", "b", "c"]);
  assert.equal(promoteVerificationPhoto(["a", "b", "c", "d", "e", "f"], "new", "sealed").length, 6);
});
test("automatic activation checks every remaining photo before its atomic profile/session update", () => {
  const source = readFileSync(new URL("../src/lib/automatic-face-verification.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("await checkAdditionalPhoto") < source.indexOf("await db.transaction"));
  assert.match(source, /JSON\.stringify\(current\.photos\) !== JSON\.stringify\(profile\.photos\)/);
  assert.match(source, /isVerified: true/);
  assert.match(source, /status: "approved", reviewedAt: new Date\(\), reviewedBy: null/);
  assert.match(source, /request\.checkedAt && request\.referencePhoto/);
});
test("camera completion activates the checked photo before returning a verified result", () => {
  const source = readFileSync(new URL("../src/routes/vibeswipe-verification.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("await verifyLiveProfilePhoto") < source.indexOf("await activateCheckedFace(userId, session.id)"));
  assert.ok(source.indexOf("await activateCheckedFace(userId, session.id)") < source.indexOf("verified: true, reviewStatus: \"approved\""));
  assert.match(source, /checked: committed/);
  assert.match(source, /router\.post\("\/vibeswipe\/verification\/finalize"/);
});
test("admin verification history has no manual approval or rejection path", () => {
  const route = readFileSync(new URL("../src/routes/vibeswipe-verification-admin.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../../vibeswipe-web/src/components/admin/sections/verifications.tsx", import.meta.url), "utf8");
  assert.match(route, /res\.status\(410\)/);
  assert.doesNotMatch(route, /tx\.update|db\.update|isVerified: true|ReviewFaceVerificationBody/);
  assert.doesNotMatch(ui, /DecisionDialog|useReviewFaceVerification|button-approve|button-reject|Awaiting review|until you approve/);
  assert.match(ui, /No administrator approval is needed/);
});
test("checked evidence retries without the member keeping the app open and never bypasses failed checks", () => {
  const worker = readFileSync(new URL("../src/lib/automatic-face-verification-worker.ts", import.meta.url), "utf8");
  const entrypoint = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(worker, /await activateCheckedFace\(request\.userId, request\.id\)/);
  assert.match(worker, /eq\(sessions\.status, "awaiting_review"\)/);
  assert.match(worker, /error\.status !== 429/);
  assert.match(worker, /"cancelled" : "rejected"/);
  assert.match(worker, /reviewedBy: null/);
  assert.doesNotMatch(worker, /isVerified: true/);
  assert.match(entrypoint, /void finishPendingFaceVerifications\(\)/);
  assert.match(entrypoint, /setInterval\(\(\) => void finishPendingFaceVerifications\(\)/);
});
