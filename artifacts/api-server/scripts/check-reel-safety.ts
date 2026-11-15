import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { checkReelVideo } from "../src/lib/reel-safety-checker";
import { rejectExplicitFrame, ReelSafetyError } from "../src/lib/reel-safety-policy";

const directory = await mkdtemp(join(tmpdir(), "reel-safety-selftest-"));
try {
  const file = join(directory, "three-minute-safe.mp4");
  const generated = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=240x320:r=1:d=185", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", file]);
  assert.equal(generated.status, 0, generated.stderr?.toString());
  const result = await checkReelVideo(file, 185);
  assert.ok(result.sampledFrames >= 185, "Check the whole 3-minute-plus timeline");
  assert.ok(result.maximumScore < .8, "Real model should accept a plain background");
  assert.throws(() => rejectExplicitFrame([{ label: "normal", score: .01 }, { label: "nsfw", score: .99 }]), (e: unknown) => e instanceof ReelSafetyError && e.status === 422);
  assert.throws(() => rejectExplicitFrame([{ label: "normal", score: 1 }]), (e: unknown) => e instanceof ReelSafetyError && e.status === 503);
  console.log(JSON.stringify({ realModelPassed: true, duration: 185, ...result }));
} finally { await rm(directory, { recursive: true, force: true }); }
