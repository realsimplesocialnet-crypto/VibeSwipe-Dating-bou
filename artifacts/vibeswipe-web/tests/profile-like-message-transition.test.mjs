import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../../vibeswipe/app/profile/[profileId].tsx", import.meta.url), "utf8");

test("profile dating action changes from Like to Message only after a mutual match", () => {
  assert.match(web, /matchedId\?<><MessageCircle size=\{17\}\/>Message<\/>:actionStatusLoading/);
  assert.doesNotMatch(web, /button-start-direct-chat|openDirectChat|useStartDirectChat/);
  assert.match(native, /\{matchId \? "Message"/);
  assert.doesNotMatch(native, /public-profile-start-direct-chat|openDirectChat|useStartDirectChat/);
});
