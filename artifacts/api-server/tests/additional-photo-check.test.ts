import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { FaceVerificationError, matchAdditionalProfilePhoto, PHOTO_FACE_MISMATCH } from "../src/lib/luxand.ts";

process.env.LUXAND_API_TOKEN = "unit-test-token";
const main = new Uint8Array([1, 2, 3]), candidate = new Uint8Array([4, 5, 6]);
function provider(body: unknown, status = 200) {
  const calls: { url: string; body: FormData }[] = [];
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal((options?.headers as Record<string, string>).token, "unit-test-token");
    assert.equal(options?.redirect, "error");
    calls.push({ url: String(url), body: options?.body as FormData });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { request, calls };
}
test("gallery face checking compares the exact main/candidate bytes without requesting another liveness capture", async () => {
  const p = provider({ similar: true, score: 0.97 });
  await matchAdditionalProfilePhoto(main, candidate, "image/jpeg", "image/png", p.request);
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, "https://api.luxand.cloud/photo/similarity");
  assert.deepEqual(new Uint8Array(await (p.calls[0].body.get("face1") as Blob).arrayBuffer()), main);
  assert.deepEqual(new Uint8Array(await (p.calls[0].body.get("face2") as Blob).arrayBuffer()), candidate);
});
for (const response of [{ similar: false, score: 0.99 }, { similar: true, score: 0.89 }, {}, { similar: true, score: "0.99" }]) {
  test(`nonmatching or inconclusive comparison is rejected: ${JSON.stringify(response)}`, async () => {
    const p = provider(response);
    await assert.rejects(matchAdditionalProfilePhoto(main, candidate, "image/jpeg", "image/jpeg", p.request),
      (e: unknown) => e instanceof FaceVerificationError && e.status === 422 && e.message === PHOTO_FACE_MISMATCH);
  });
}
test("no face or unreadable face is rejected with the requested public message", async () => {
  const p = provider({ error: "No face" }, 422);
  await assert.rejects(matchAdditionalProfilePhoto(main, candidate, "image/jpeg", "image/jpeg", p.request),
    (e: unknown) => e instanceof FaceVerificationError && e.status === 422 && e.message === PHOTO_FACE_MISMATCH);
});
for (const status of [401, 429, 500, 503]) {
  test(`provider ${status} fails closed and never leaks provider text`, async () => {
    const p = provider({ error: "private provider diagnostic" }, status);
    await assert.rejects(matchAdditionalProfilePhoto(main, candidate, "image/jpeg", "image/jpeg", p.request),
      (e: unknown) => e instanceof FaceVerificationError && e.status === 503 && !e.message.includes("private provider"));
  });
}
test("network and malformed JSON failures cannot accept a photo", async () => {
  for (const request of [
    async () => { throw new TypeError("network failed"); },
    async () => new Response("not json", { status: 200 }),
  ]) {
    await assert.rejects(matchAdditionalProfilePhoto(main, candidate, "image/jpeg", "image/jpeg", request as typeof fetch),
      (e: unknown) => e instanceof FaceVerificationError && e.status === 503);
  }
});
test("profile save checks extra photos before writing and rejects a stale verified-face snapshot", () => {
  const source = readFileSync(new URL("../src/routes/vibeswipe.ts", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('router.put("/vibeswipe/me"'), source.indexOf('router.get("/vibeswipe/settings"'));
  assert.ok(route.indexOf("await checkAdditionalPhoto") < route.indexOf("db.transaction"));
  assert.match(route, /existingProfile\?\.isVerified !== photoSnapshot\?\.isVerified/);
  assert.match(route, /existingProfile\?\.photos\[0\] !== photoSnapshot\?\.photos\[0\]/);
  assert.match(route, /body\.photos = checked/);
});
test("uploaded files cannot substitute unchecked bytes after comparison", () => {
  const source = readFileSync(new URL("../src/lib/additional-photo-check.ts", import.meta.url), "utf8");
  assert.match(source, /eq\(mediaAssetsTable\.ownerId, userId\)/);
  assert.match(source, /isNull\(mediaAssetsTable\.matchId\)/);
  assert.match(source, /startsWith\("\/objects\/verified-profile\/"\).*verifiedAgainst === verifiedMain/);
  assert.ok(source.indexOf("await matchAdditionalProfilePhoto") < source.indexOf("await storage.storeVerifiedProfilePhoto"));
  assert.match(source, /storeVerifiedProfilePhoto\(extra\.bytes, userId, candidate\.contentType, verifiedMain\)/);
});
