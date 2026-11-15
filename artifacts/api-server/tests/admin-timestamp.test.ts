import assert from "node:assert/strict";
import test from "node:test";
import { adminTimestamp } from "../src/lib/admin-timestamp.ts";

test("normalizes aggregate PostgreSQL timestamp strings and mapped Date values alike", () => {
  assert.equal(adminTimestamp("2026-11-15 23:00:00+00"), "2026-11-15T23:00:00.000Z");
  assert.equal(adminTimestamp(new Date("2026-11-15T23:00:00Z")), "2026-11-15T23:00:00.000Z");
});
test("a conversation with no messages has no fabricated latest-message time", () => {
  assert.equal(adminTimestamp(null), null);
  assert.equal(adminTimestamp(undefined), null);
});
test("invalid timestamps fail explicitly instead of inventing a valid activity time", () => {
  assert.throws(() => adminTimestamp("invalid"), RangeError);
});
