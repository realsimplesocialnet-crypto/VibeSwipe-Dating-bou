import assert from "node:assert/strict";
import test from "node:test";
import { FaceVerificationError, faceMatchPassed, isCameraJpeg, livenessPassed, verifyLiveProfilePhoto } from "../src/lib/luxand.ts";
import { discoveryExcludedIds } from "../src/lib/discovery-exclusions.ts";
import { resolvePreferredDiscoveryArea } from "../src/lib/travelCities.ts";
import { automaticDiscovery } from "../src/lib/discovery-pool.ts";

// Isolated test-process value only; mocks must never make a real provider request.
process.env.LUXAND_API_TOKEN = "unit-test-token";
const live = { score: 0.999, result: "real", rectangle: { left: 1, top: 2, right: 80, bottom: 90 } };
const match = { score: 0.95, similar: true };
function provider(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; body: FormData }[] = [];
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    const response = responses[calls.length];
    assert.ok(response, "Unexpected external call");
    assert.equal((options?.headers as Record<string, string>).token, "unit-test-token");
    calls.push({ url: String(url), body: options!.body as FormData });
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
  }) as typeof fetch;
  return { request, calls };
}
const selfie = new Uint8Array([1, 2]), photo = new Uint8Array([3, 4]);

test("liveness only accepts an explicit real face with a valid score and rectangle", () => {
  assert.equal(livenessPassed(live), true);
  for (const value of [null, [live], {}, { ...live, result: "fake" }, { ...live, score: "1" }, { ...live, score: 0.5 }, { ...live, score: NaN }, { ...live, score: 2 }, { ...live, rectangle: {} }]) {
    assert.equal(livenessPassed(value), false);
  }
});
test("face matching requires the provider's boolean decision and a conservative score", () => {
  assert.equal(faceMatchPassed(match), true);
  for (const value of [null, {}, { similar: "true", score: 1 }, { similar: true, score: 0.89 }, { similar: false, score: 1 }, { similar: true, score: Infinity }]) assert.equal(faceMatchPassed(value), false);
});
test("both checks run server-side against the documented endpoints", async () => {
  const p = provider([{ body: live }, { body: match }]);
  await verifyLiveProfilePhoto(selfie, photo, "image/jpeg", p.request);
  assert.deepEqual(p.calls.map(c => c.url), ["https://api.luxand.cloud/photo/liveness", "https://api.luxand.cloud/photo/similarity"]);
  assert.ok(p.calls[0].body.get("photo") instanceof Blob);
  assert.ok(p.calls[1].body.get("face1") instanceof Blob);
  assert.ok(p.calls[1].body.get("face2") instanceof Blob);
});
test("spoof failure stops before comparison and cannot award verification", async () => {
  const p = provider([{ body: { ...live, result: "fake" } }]);
  await assert.rejects(verifyLiveProfilePhoto(selfie, photo, "image/jpeg", p.request), (e: unknown) => e instanceof FaceVerificationError && e.status === 422);
  assert.equal(p.calls.length, 1);
});
test("real but non-matching faces do not verify", async () => {
  const p = provider([{ body: live }, { body: { score: 0.2, similar: false } }]);
  await assert.rejects(verifyLiveProfilePhoto(selfie, photo, "image/jpeg", p.request), (e: unknown) => e instanceof FaceVerificationError && e.status === 422);
});
test("provider authentication failure is unavailable, never a successful verification", async () => {
  const p = provider([{ status: 401, body: { message: "Unauthorized" } }]);
  await assert.rejects(verifyLiveProfilePhoto(selfie, photo, "image/jpeg", p.request), (e: unknown) => e instanceof FaceVerificationError && e.status === 503);
});
test("unreadable provider images return a retryable face-check error", async () => {
  const p = provider([{ status: 400, body: { error: "No face" } }]);
  await assert.rejects(verifyLiveProfilePhoto(selfie, photo, "image/jpeg", p.request), (e: unknown) => e instanceof FaceVerificationError && e.status === 422);
});
test("JPEG intake rejects wrong formats and oversized files", () => {
  const jpeg = Buffer.alloc(120); jpeg.set([0xff, 0xd8, 0xff]);
  assert.equal(isCameraJpeg(jpeg), true);
  assert.equal(isCameraJpeg(Buffer.from("not a camera JPEG")), false);
  assert.equal(isCameraJpeg(Buffer.alloc(5 * 1024 * 1024 + 1)), false);
});
test("Bauchi can be selected as a state without requiring a saved city", () => {
  const area = resolvePreferredDiscoveryArea({
    travelMode: false, travelCity: null, requestedCountry: "Nigeria", requestedState: "Bauchi",
    homeCountry: "India", homeState: "Delhi", homeCity: "New Delhi",
  });
  assert.equal(area.scope, "state"); assert.equal(area.country, "Nigeria"); assert.equal(area.state, "Bauchi"); assert.equal(area.city, null);
  assert.equal(automaticDiscovery({ travelMode: false, requestedState: "Bauchi" }), false);
});
test("including passed people never removes blocks, self or outgoing likes", () => {
  const params = { viewerId: "me", reactions: [{ id: "passed", type: "pass" }, { id: "liked", type: "like" }, { id: "super", type: "super" }, { id: "blocked", type: "pass" }], blocks: [{ blockerId: "blocked", blockedId: "me" }], includePassed: true, hasRequestedLocation: true, travelMode: false };
  assert.deepEqual([...discoveryExcludedIds(params)].sort(), ["me", "liked", "super", "blocked"].sort());
  for (const override of [{ includePassed: false }, { hasRequestedLocation: false }, { travelMode: true }]) assert.equal(discoveryExcludedIds({ ...params, ...override }).has("passed"), true);
});
