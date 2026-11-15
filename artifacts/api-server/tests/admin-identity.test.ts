import assert from "node:assert/strict";
import test from "node:test";
import { loadAdminIdentity } from "../src/lib/admin-identity.ts";

test("an existing account identity is preserved", async () => {
  const identity = { id: "test-account" };
  assert.equal(await loadAdminIdentity(async () => identity), identity);
});
test("an orphaned profile remains reviewable without invented identity details", async () => {
  assert.equal(await loadAdminIdentity(async () => { throw { status: 404 }; }), null);
});
test("provider outages and other errors fail explicitly instead of pretending account details are missing", async () => {
  for (const error of [{ status: 503 }, { status: 429 }, new Error("Provider unavailable")]) {
    await assert.rejects(loadAdminIdentity(async () => { throw error; }), actual => actual === error);
  }
});
