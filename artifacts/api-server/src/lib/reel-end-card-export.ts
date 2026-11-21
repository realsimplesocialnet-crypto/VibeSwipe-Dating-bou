import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

type ProbeResult = {
  streams?: Array<{ width?: number; height?: number }>;
  format?: { duration?: string };
};

function run(command: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    timer.unref();
    const abort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout = `${stdout}${chunk}`.slice(-8000); });
    child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-8000); });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", code => {
      cleanup();
      if (signal?.aborted) { reject(new Error("Reel export was cancelled.")); return; }
      if (code === 0) { resolve(stdout); return; }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
    if (signal?.aborted) abort();
  });
}

export function reelEndCardFilter(durationSeconds: number, width: number, height: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("The Reel duration could not be read.");
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("The Reel dimensions could not be read.");
  }
  const start = Math.max(0, durationSeconds - 2);
  const cardHeight = Math.max(2, Math.round(height * 0.12 / 2) * 2);
  const progress = `min(max((t-${start.toFixed(3)})/0.4,0),1)`;
  const verticalPosition = `main_h-overlay_h*(1-pow(1-${progress},2))`;
  return `[1:v]scale=${width}:${cardHeight}:flags=lanczos[card];[0:v][card]overlay=x=0:y='${verticalPosition}':eval=frame:enable='gte(t,${start.toFixed(3)})':shortest=1:format=auto[v]`;
}

export async function addReelEndCard(
  inputPath: string,
  outputPath: string,
  cardImagePath: string,
  signal?: AbortSignal,
): Promise<{ size: number; duration: number; width: number; height: number }> {
  const probeText = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "format=duration:stream=width,height",
    "-of", "json",
    inputPath,
  ], 30_000, signal);
  const probe = JSON.parse(probeText) as ProbeResult;
  const duration = Number(probe.format?.duration);
  const width = probe.streams?.[0]?.width;
  const height = probe.streams?.[0]?.height;
  if (
    !Number.isFinite(duration) || duration <= 0 ||
    typeof width !== "number" || typeof height !== "number" ||
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width <= 0 || height <= 0
  ) {
    throw new Error("The Reel video could not be read for export.");
  }

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", inputPath,
    "-loop", "1", "-framerate", "30", "-i", cardImagePath,
    "-filter_complex", reelEndCardFilter(duration, width, height),
    "-map", "[v]", "-map", "0:a?",
    "-map_metadata", "-1",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", outputPath,
  ], Math.min(2_147_000_000, Math.max(600_000, Math.ceil(duration * 3_000))), signal);

  const outputStat = await stat(outputPath);
  if (outputStat.size <= 0) throw new Error("The Reel export is empty.");
  return { size: outputStat.size, duration, width, height };
}
