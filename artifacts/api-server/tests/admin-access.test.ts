import assert from "node:assert/strict";
import test from "node:test";
import { hasVerifiedAdminEmail } from "../src/lib/admin-access.ts";

const identity = {
  id: "user_test",
  primaryEmailAddressId: "email_primary",
  emailAddresses: [
    { id: "email_primary", emailAddress: "admin@example.test", verification: { status: "verified" } },
    { id: "email_secondary", emailAddress: "secondary@example.test", verification: { status: "verified" } },
  ],
};

test("admin access requires the configured address to be the verified primary email", () => {
  assert.equal(hasVerifiedAdminEmail(identity, " ADMIN@example.test "), true);
  assert.equal(hasVerifiedAdminEmail(identity, "secondary@example.test"), false);
});

test("admin access fails closed for absent configuration, unverified email, banned, or locked users", () => {
  assert.equal(hasVerifiedAdminEmail(identity, ""), false);
  assert.equal(hasVerifiedAdminEmail({
    ...identity,
    emailAddresses: identity.emailAddresses.map((email) => ({
      ...email,
      verification: email.id === "email_primary" ? { status: "unverified" } : email.verification,
    })),
  }, "admin@example.test"), false);
  assert.equal(hasVerifiedAdminEmail({ ...identity, banned: true }, "admin@example.test"), false);
  assert.equal(hasVerifiedAdminEmail({ ...identity, locked: true }, "admin@example.test"), false);
});
