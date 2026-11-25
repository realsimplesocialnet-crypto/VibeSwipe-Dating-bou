import assert from "node:assert/strict";
import test from "node:test";
import { getAppClerkCredentials } from "../src/lib/clerk-client.ts";

const envKeys = [
  "MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY",
  "MYAGE_EXTERNAL_CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NODE_ENV",
] as const;

function withEnvironment(
  values: Partial<Record<(typeof envKeys)[number], string>>,
  run: () => void,
) {
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) {
    delete process.env[key];
    const value = values[key];
    if (value !== undefined) process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("external Clerk takes precedence over Replit-managed keys", () => {
  withEnvironment({
    MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY: "pk_test_external",
    MYAGE_EXTERNAL_CLERK_SECRET_KEY: "sk_test_external",
    CLERK_PUBLISHABLE_KEY: "pk_test_managed",
    CLERK_SECRET_KEY: "sk_test_managed",
    NODE_ENV: "development",
  }, () => {
    const credentials = getAppClerkCredentials();
    assert.equal(credentials.publishableKey, "pk_test_external");
    assert.equal(credentials.secretKey, "sk_test_external");
    assert.equal(credentials.usesExternalClerk, true);
  });
});

test("partial external Clerk configuration fails instead of mixing tenants", () => {
  withEnvironment({
    MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY: "pk_test_external",
    CLERK_SECRET_KEY: "sk_test_managed",
    NODE_ENV: "development",
  }, () => {
    assert.throws(getAppClerkCredentials, /requires both MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY/);
  });
});

test("production rejects development keys for the external Clerk tenant", () => {
  withEnvironment({
    MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY: "pk_test_external",
    MYAGE_EXTERNAL_CLERK_SECRET_KEY: "sk_test_external",
    NODE_ENV: "production",
  }, () => {
    assert.throws(getAppClerkCredentials, /Production deployments require live external Clerk credentials/);
  });
  withEnvironment({
    MYAGE_EXTERNAL_CLERK_PUBLISHABLE_KEY: "pk_live_external",
    MYAGE_EXTERNAL_CLERK_SECRET_KEY: "sk_live_external",
    NODE_ENV: "production",
  }, () => {
    assert.equal(getAppClerkCredentials().usesExternalClerk, true);
  });
});
