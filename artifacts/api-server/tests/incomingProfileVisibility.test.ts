import assert from "node:assert/strict";
import { test } from "node:test";
import { canShowIncomingProfile } from "../src/lib/incomingProfileVisibility.ts";

test("the signed-in user never appears in their own incoming lists", () => {
  assert.equal(canShowIncomingProfile({ id: "owner" }, "owner", new Set()), false);
});

test("demonstration profiles are not presented as real incoming activity", () => {
  assert.equal(canShowIncomingProfile({ id: "sample", isDemo: true }, "owner", new Set()), false);
});

test("blocked profiles are hidden regardless of which side placed the block", () => {
  const blocked = new Set(["blocked-by-owner", "blocked-the-owner"]);
  for (const id of blocked) assert.equal(canShowIncomingProfile({ id }, "owner", blocked), false);
});

test("real unblocked incoming profiles remain visible", () => {
  assert.equal(canShowIncomingProfile({ id: "member", isDemo: false }, "owner", new Set(["another"])), true);
});
