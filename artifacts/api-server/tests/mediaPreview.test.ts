import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { GetMediaPreviewParams, SendMessageBody, SendMessageResponse } from "../../../lib/api-zod/src/generated/api.ts";
import {
  createLimiter, createPreviewCache, evictMediaPreview, getMediaPreview,
  PREVIEW_MAX_BYTES, PreviewBusyError, PreviewUnreadableError,
} from "../src/lib/mediaPreview.ts";

function fixture(args: string[], name: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-fixture-"));
  try {
    const out = join(dir, name);
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args, "-y", out]);
    assert.equal(result.status, 0, String(result.stderr));
    return readFileSync(out);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const previewTemps = () => readdirSync(tmpdir()).filter(name => name.startsWith("vibeswipe-preview-")).length;
function webpSize(bytes: Buffer): { width: number; height: number } {
  const dir = mkdtempSync(join(tmpdir(), "webp-size-"));
  try {
    const file = join(dir, "preview.webp");
    writeFileSync(file, bytes);
    const result = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const [width, height] = result.stdout.trim().split("x").map(Number);
    return { width, height };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("photo preview is a small bounded WebP made from the stored original, then cached", async () => {
  const original = fixture(["-f", "lavfi", "-i", "testsrc=size=1600x1200", "-frames:v", "1"], "big.png");
  const before = previewTemps();
  let reads = 0;
  const id = "11111111-1111-4111-8111-111111111111";
  const bytes = await getMediaPreview(id, "image", () => { reads += 1; return Readable.from([original]); });
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
  assert.ok(bytes.length <= PREVIEW_MAX_BYTES);
  const size = webpSize(bytes);
  assert.ok(Math.max(size.width, size.height) <= 320, JSON.stringify(size));
  assert.ok(bytes.length < original.length / 4);
  await getMediaPreview(id, "image", () => { reads += 1; return Readable.from([original]); });
  assert.equal(reads, 1, "second request is served from the private cache");
  evictMediaPreview(id);
  await getMediaPreview(id, "image", () => { reads += 1; return Readable.from([original]); });
  assert.equal(reads, 2, "eviction after original deletion forces a fresh authorized read");
  evictMediaPreview(id);
  assert.equal(previewTemps(), before, "temporary files are cleaned");
});

test("video preview takes a real frame", async () => {
  const video = fixture(["-f", "lavfi", "-i", "testsrc=size=640x360:duration=2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-movflags", "+faststart"], "clip.mp4");
  const bytes = await getMediaPreview("22222222-2222-4222-8222-222222222222", "video", () => Readable.from([video]));
  assert.deepEqual(webpSize(bytes), { width: 320, height: 180 });
  evictMediaPreview("22222222-2222-4222-8222-222222222222");
});

test("unreadable originals fail honestly and clean temp files", async () => {
  const before = previewTemps();
  await assert.rejects(getMediaPreview("33333333-3333-4333-8333-333333333333", "image", () => Readable.from([Buffer.from("not an image")])), PreviewUnreadableError);
  assert.equal(previewTemps(), before);
});

test("limiter bounds concurrent work and rejects beyond the queue", async () => {
  const limiter = createLimiter(2, 1);
  let peak = 0; let running = 0;
  const release: Array<() => void> = [];
  const job = () => limiter.run(async () => { running += 1; peak = Math.max(peak, running); await new Promise<void>(r => release.push(r)); running -= 1; });
  const jobs = [job(), job(), job()];
  await assert.rejects(job(), PreviewBusyError);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(peak, 2);
  while (release.length || running) { release.shift()?.(); await new Promise(r => setTimeout(r, 1)); }
  await Promise.all(jobs);
  assert.equal(limiter.active, 0);
});

test("preview cache expires and is size bounded", () => {
  let now = 0;
  const cache = createPreviewCache(2, 100, () => now);
  cache.set("a", Buffer.from("a")); cache.set("b", Buffer.from("b")); cache.set("c", Buffer.from("c"));
  assert.equal(cache.get("a"), undefined);
  now = 500;
  assert.equal(cache.get("b"), undefined);
});

test("contracts: preview id must be a uuid and story replies are server-described", () => {
  assert.equal(GetMediaPreviewParams.safeParse({ mediaId: "../etc" }).success, false);
  assert.equal(SendMessageBody.parse({ content: "Nice", storyId: "44444444-4444-4444-8444-444444444444" }).storyId, "44444444-4444-4444-8444-444444444444");
  const out = SendMessageResponse.parse({
    id: "11111111-1111-4111-8111-111111111111", matchId: "22222222-2222-4222-8222-222222222222", senderId: "x", content: "hi",
    createdAt: new Date().toISOString(), deletedForEveryone: false, isRead: false,
    storyReply: { storyId: "44444444-4444-4444-8444-444444444444", storyOwnerId: "y", available: false, mediaReference: null, mediaType: null, backgroundColor: null },
  });
  assert.equal(out.storyReply?.available, false);
});
