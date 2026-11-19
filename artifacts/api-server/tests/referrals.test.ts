import assert from "node:assert/strict";
import test from "node:test";
import { findAvailableReferralCode, referralCodeCandidate } from "../src/lib/referrals.ts";

test("referral codes are stable, ID-derived, and eight uppercase alphanumeric characters", () => {
  const first = referralCodeCandidate("user_referral_test");
  assert.equal(first, referralCodeCandidate("user_referral_test"));
  assert.match(first, /^[A-Z0-9]{8}$/);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[0-9]/);
  assert.notEqual(first, referralCodeCandidate("another_user"));
});

test("referral allocation retries deterministic candidates when a collision is found", async () => {
  const checked: string[] = [];
  const allocated = await findAvailableReferralCode("user_referral_test", async (candidate) => {
    checked.push(candidate);
    return checked.length === 1;
  });
  assert.equal(checked.length, 2);
  assert.equal(allocated, referralCodeCandidate("user_referral_test", 1));
});
