import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("only currently visible approved Reel videos receive the offline-cache marker", () => {
  const source = readFileSync(new URL("../src/routes/vibeswipe.ts", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('"/vibeswipe/media/:mediaId"'), source.indexOf("export default router"));
  assert.match(route, /authorizeMediaRead\(userId, asset\)/);
  assert.match(route, /asset\.mediaType === "video"\s*\?\s*await canViewReelMedia\(userId, asset\.id\)/);
  assert.match(route, /if \(offlineEligibleReel\) res\.setHeader\("X-Myage-Offline-Eligible", "public-reel"\)/);
});
