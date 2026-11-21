import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { addReelEndCard, reelEndCardFilter } from "../src/lib/reel-end-card-export.ts";

const fallbackPng = fileURLToPath(new URL("../assets/reel-end-card.png", import.meta.url));

function samplePixel(videoPath: string, time: string): Buffer {
  return execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-ss", time, "-i", videoPath,
    "-vf", "crop=1:1:350:630,format=rgb24", "-frames:v", "1",
    "-f", "rawvideo", "-",
  ]);
}

test("end-card filter starts within the last two seconds and uses a short slide-up", () => {
  const filter = reelEndCardFilter(12, 1080, 1920);
  assert.match(filter, /gte\(t,10\.000\)/);
  assert.match(filter, /scale=1080:230/);
  assert.match(filter, /0\.4/);
  assert.match(filter, /pow\(1-/);
});

test("download export preserves the video and overlays its final frame section only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vibeswipe-end-card-test-"));
  const source = join(directory, "source.mp4");
  const output = join(directory, "export.mp4");
  try {
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=blue:s=360x640:r=10:d=3",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=3",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source,
    ]);
    const result = await addReelEndCard(source, output, fallbackPng);
    assert.equal(result.width, 360);
    assert.equal(result.height, 640);
    assert.ok(Math.abs(result.duration - 3) < 0.1);
    const audioStreams = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
      "-of", "csv=p=0", output,
    ], { encoding: "utf8" }).trim();
    assert.equal(audioStreams, "aac", "the exported Reel should keep its original sound");
    const before = samplePixel(output, "0.5");
    const end = samplePixel(output, "2.8");
    assert.equal(before.length, 3);
    assert.equal(end.length, 3);
    assert.ok(before[2]! > 200, "the original video should remain visible before the end-card");
    assert.ok(end[2]! < 220, "the end-card should darken the bottom area near the end");
    assert.ok(result.size > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the static PNG fallback is a valid PNG image", () => {
  const result = spawnSync("file", [fallbackPng], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PNG image data/);
});
