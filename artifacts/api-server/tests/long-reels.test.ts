import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { File } from "@google-cloud/storage";
import {
  MAX_PROFILE_VIDEO_SOURCE_BYTES, transcodeReelVideo, validateTranscodedProfileVideo,
} from "../src/lib/profileVideoTranscoder.ts";
import { reelAssetProblem } from "../src/lib/reel-cursor.ts";

test("Reels accept three minutes and longer while profile and Story limits stay unchanged", () => {
  for (const duration of [180, 185, 300, 900, 3600]) {
    const video = { size: 1024, duration, width: 720, height: 1280 };
    assert.doesNotThrow(() => validateTranscodedProfileVideo(video, null, MAX_PROFILE_VIDEO_SOURCE_BYTES));
    assert.throws(() => validateTranscodedProfileVideo(video), /30 seconds/);
    assert.throws(() => validateTranscodedProfileVideo(video, 15), /15 seconds/);
    assert.equal(reelAssetProblem({ ownerId: "me", mediaType: "video", contentType: "video/mp4", durationSeconds: duration, matchId: null }, "me"), null);
  }
});

test("long Reels still reject invalid durations and oversized output", () => {
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.throws(() => validateTranscodedProfileVideo({ size: 100, duration, width: 720, height: 1280 }, null, MAX_PROFILE_VIDEO_SOURCE_BYTES));
  }
  assert.throws(() => validateTranscodedProfileVideo({ size: MAX_PROFILE_VIDEO_SOURCE_BYTES + 1, duration: 185, width: 720, height: 1280 }, null, MAX_PROFILE_VIDEO_SOURCE_BYTES), /500 MB/);
});

const haveFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
test("actual Reels transcoding preserves all 185 seconds rather than truncating to 30", { skip: !haveFfmpeg, timeout: 60_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "long-reel-test-"));
  try {
    const input = join(dir, "input.mp4");
    const output = join(dir, "output.mp4");
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x284:r=1",
      "-t", "185", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", input,
    ], { timeout: 30_000, stdio: "pipe" });
    const source = {
      getMetadata: async () => [{ size: String((await stat(input)).size) }],
      createReadStream: () => createReadStream(input),
      createWriteStream: () => createWriteStream(output),
    } as unknown as File;
    const result = await transcodeReelVideo(source);
    assert.ok(result.duration >= 184.5 && result.duration <= 186, `Expected full clip, got ${result.duration}s`);
    const duration = Number(execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", output,
    ], { encoding: "utf8" }).trim());
    assert.ok(duration >= 184.5, "Stored video must retain the end of the original clip");
    assert.equal(result.size, (await stat(output)).size);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
