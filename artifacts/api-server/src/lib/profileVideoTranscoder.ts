import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { File } from "@google-cloud/storage";

export const MAX_PROFILE_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_PROFILE_VIDEO_DURATION_SECONDS = 30;
export const MAX_PROFILE_VIDEO_SOURCE_BYTES = 500 * 1024 * 1024;

export class ProfileVideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileVideoValidationError";
  }
}

export type TranscodedProfileVideo = {
  size: number;
  duration: number;
  width: number;
  height: number;
};

type ProbeResult = {
  streams?: Array<{ width?: number; height?: number }>;
  format?: { duration?: string };
};

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    timer.unref();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-8000);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

async function probeVideo(path: string): Promise<TranscodedProfileVideo> {
  const result = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "format=duration:stream=width,height",
    "-of", "json",
    path,
  ]);
  const probe = JSON.parse(result) as ProbeResult;
  const stream = probe.streams?.[0];
  const width = stream?.width;
  const height = stream?.height;
  const duration = Number(probe.format?.duration);
  if (
    typeof width !== "number" || typeof height !== "number" ||
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width <= 0 || height <= 0 || !Number.isFinite(duration) || duration <= 0
  ) {
    throw new ProfileVideoValidationError("This video could not be read.");
  }
  return { size: 0, duration, width, height };
}

export async function transcodeProfileVideo(
  source: File,
): Promise<TranscodedProfileVideo> {
  const [sourceMetadata] = await source.getMetadata();
  const sourceSize = Number(sourceMetadata.size);
  if (
    !Number.isFinite(sourceSize) || sourceSize <= 0 ||
    sourceSize > MAX_PROFILE_VIDEO_SOURCE_BYTES
  ) {
    throw new ProfileVideoValidationError("Choose a source video that is 500 MB or smaller.");
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "vibeswipe-video-"));
  const inputPath = join(workingDirectory, "source");
  const outputPath = join(workingDirectory, "compressed.mp4");
  try {
    await pipeline(source.createReadStream(), createWriteStream(inputPath));
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf",
      "scale=w='if(gte(iw,ih),min(1280,iw),min(720,iw))':h='if(gte(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-t", "31",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "26",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ]);

    const outputStats = await stat(outputPath);
    if (!outputStats.size) {
      throw new ProfileVideoValidationError("This video could not be compressed.");
    }
    if (outputStats.size > MAX_PROFILE_VIDEO_BYTES) {
      throw new ProfileVideoValidationError("The compressed video must be 50 MB or smaller.");
    }

    const video = await probeVideo(outputPath);
    if (video.duration > MAX_PROFILE_VIDEO_DURATION_SECONDS) {
      throw new ProfileVideoValidationError("Profile videos must be 30 seconds or shorter.");
    }
    if (Math.max(video.width, video.height) > 1280 || Math.min(video.width, video.height) > 720) {
      throw new ProfileVideoValidationError("The compressed video exceeds the 720p limit.");
    }

    const destination = source.createWriteStream({
      resumable: false,
      metadata: {
        contentType: "video/mp4",
        ...(sourceMetadata.metadata ? { metadata: sourceMetadata.metadata } : {}),
      },
    });
    await pipeline(createReadStream(outputPath), destination);
    return { ...video, size: outputStats.size };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
