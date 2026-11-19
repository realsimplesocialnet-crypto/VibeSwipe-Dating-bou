import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const web = read("../src/components/social-hub.tsx");
const native = read("../../vibeswipe/components/ProfileFollow.tsx");

test("profile actions show Follow back for a current incoming follow", () => {
  assert.match(web, /followsYou \? 'Follow back' : 'Follow'/);
  assert.match(native, /followsYou \? "Follow back" : "Follow"/);
});

test("profile actions wait for refreshed follow status before showing a stale label", () => {
  assert.match(web, /requestPendingByMe=\{summary\.data\.requestPendingByMe\} checking=\{summary\.isFetching\}/);
  assert.match(web, /<span>Checking…<\/span>/);
  assert.match(native, /const checkingRelationship = query\.isFetching/);
  assert.match(native, /Checking…/);
});
