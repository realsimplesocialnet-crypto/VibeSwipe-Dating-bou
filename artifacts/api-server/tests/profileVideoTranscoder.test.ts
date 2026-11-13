import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { File } from "@google-cloud/storage";
import { TranscodeProfileVideoResponse } from "../../../lib/api-zod/src/generated/api.ts";
import test from "node:test";
import {
  MAX_PROFILE_VIDEO_BYTES,
  ProfileVideoValidationError,
  transcodeProfileVideo,
  validateTranscodedProfileVideo,
} from "../src/lib/profileVideoTranscoder.ts";

const execFileAsync = promisify(execFile);

async function createVideoFixture(
  width: number,
  height: number,
  duration: number,
): Promise<{ directory: string; path: string }> {
  const directory = await mkdtemp(join(tmpdir(), "profile-video-test-"));
  const path = join(directory, "source.mp4");
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=blue:s=${width}x${height}:r=24`,
    "-t", String(duration),
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    path,
  ]);
  return { directory, path };
}

function createStorageFile(inputPath: string, outputPath: string): {
  file: File;
  getWriteOptions: () => { metadata?: Record<string, unknown> } | undefined;
} {
  let writeOptions: { metadata?: Record<string, unknown> } | undefined;
  const file = {
    getMetadata: async () => [
      { size: (await stat(inputPath)).size, metadata: { source: "test" } },
    ],
    createReadStream: () => createReadStream(inputPath),
    createWriteStream: (options: { metadata?: Record<string, unknown> }) => {
      writeOptions = options;
      return createWriteStream(outputPath);
    },
  };
  return {
    file: file as unknown as File,
    getWriteOptions: () => writeOptions,
  };
}

async function transcodeDimensions(width: number, height: number) {
  const fixture = await createVideoFixture(width, height, 1);
  const outputPath = join(fixture.directory, "processed.mp4");
  try {
    const storage = createStorageFile(fixture.path, outputPath);
    const result = await transcodeProfileVideo(storage.file);
    const format = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=format_name",
      "-of", "default=nw=1:nk=1",
      outputPath,
    ]);
    return { result, format: format.stdout.trim(), writeOptions: storage.getWriteOptions() };
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
}

test("landscape videos transcode to MP4 within the 1280×720 bounds", async () => {
  const { result, format, writeOptions } = await transcodeDimensions(1920, 1080);
  assert.deepEqual(
    { width: result.width, height: result.height },
    { width: 1280, height: 720 },
  );
  assert.match(format, /mp4/);
  assert.equal(writeOptions?.metadata?.contentType, "video/mp4");
  assert.deepEqual(writeOptions?.metadata?.metadata, { source: "test" });
});

test("portrait videos transcode to MP4 within the 720×1280 bounds", async () => {
  const { result, format, writeOptions } = await transcodeDimensions(1080, 1920);
  assert.deepEqual(
    { width: result.width, height: result.height },
    { width: 720, height: 1280 },
  );
  assert.match(format, /mp4/);
  assert.equal(writeOptions?.metadata?.contentType, "video/mp4");
});

test("the output size and duration limits include their exact allowed boundaries", () => {
  const atLimits = {
    size: MAX_PROFILE_VIDEO_BYTES,
    duration: 30,
    width: 1280,
    height: 720,
  };
  assert.doesNotThrow(() => validateTranscodedProfileVideo(atLimits));
  assert.throws(
    () => validateTranscodedProfileVideo({ ...atLimits, size: MAX_PROFILE_VIDEO_BYTES + 1 }),
    (error: unknown) =>
      error instanceof ProfileVideoValidationError && /50 MB/.test(error.message),
  );
  assert.throws(
    () => validateTranscodedProfileVideo({ ...atLimits, duration: 30.01 }),
    (error: unknown) =>
      error instanceof ProfileVideoValidationError && /30 seconds/.test(error.message),
  );
});

test("the transcode API response accepts the processed MP4 metadata", async () => {
  const { result } = await transcodeDimensions(1920, 1080);
  const response = TranscodeProfileVideoResponse.parse({
    mediaReference: "media:00000000-0000-4000-8000-000000000001",
    ...result,
  });
  assert.equal(response.mediaReference, "media:00000000-0000-4000-8000-000000000001");
  assert.ok(response.size <= MAX_PROFILE_VIDEO_BYTES);
  assert.ok(response.duration <= 30);
});

test("videos longer than 30 seconds are rejected after transcoding", async (t) => {
  const fixture = await createVideoFixture(320, 240, 31);
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const storage = createStorageFile(fixture.path, join(fixture.directory, "processed.mp4"));
  await assert.rejects(
    transcodeProfileVideo(storage.file),
    (error: unknown) =>
      error instanceof ProfileVideoValidationError && /30 seconds/.test(error.message),
  );
});
