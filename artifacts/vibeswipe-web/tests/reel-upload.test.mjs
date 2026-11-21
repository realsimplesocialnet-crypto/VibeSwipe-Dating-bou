import assert from "node:assert/strict";
import test from "node:test";
import { reelPostUnauthorizedMessage, uploadReelVideoBytes } from "../src/lib/reel-upload.ts";

test("temporary video storage failures retry the same signed PUT", async () => {
  const calls = [];
  const file = new Blob(["video bytes"], { type: "video/mp4" });
  const attempts = [];

  await uploadReelVideoBytes("https://storage.example/object", file, "video/mp4", {
    wait: async () => {},
    onAttempt: (attempt) => attempts.push(attempt),
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: calls.length === 1 ? 503 : 200 });
    },
  });

  assert.deepEqual(attempts, [1, 2]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url, init }) =>
    url === "https://storage.example/object" &&
    init.method === "PUT" &&
    init.body === file &&
    new Headers(init.headers).get("content-type") === "video/mp4",
  ));
});

test("repeated network errors keep a safe, actionable message without leaking the signed URL", async () => {
  let calls = 0;

  await assert.rejects(
    uploadReelVideoBytes("https://storage.example/object?signature=private", new Blob(["video"]), "video/mp4", {
      wait: async () => {},
      fetcher: async () => {
        calls++;
        throw new TypeError("Failed to fetch");
      },
    }),
    (error) =>
      error.code === "REEL_UPLOAD_NETWORK" &&
      /video is still selected/.test(error.userMessage) &&
      /secure storage/.test(error.userMessage) &&
      !error.userMessage.includes("localhost") &&
      !error.userMessage.includes("signature"),
  );

  assert.equal(calls, 3);
});

test("an expired signed upload link is not retried with the same URL", async () => {
  let calls = 0;

  await assert.rejects(
    uploadReelVideoBytes("https://storage.example/object", new Blob(["video"]), "video/mp4", {
      wait: async () => {},
      fetcher: async () => {
        calls++;
        return new Response(null, { status: 403 });
      },
    }),
    (error) => error.code === "REEL_UPLOAD_LINK" && /fresh link/.test(error.userMessage),
  );

  assert.equal(calls, 1);
});

test("a rejected post request does not falsely tell members they were logged out", () => {
  assert.match(reelPostUnauthorizedMessage({ status: 401 }), /video and caption are still here/);
  assert.equal(reelPostUnauthorizedMessage({ status: 403 }), null);
});
