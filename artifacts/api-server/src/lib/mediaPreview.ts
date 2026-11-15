import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

/** Longest edge of a chat thumbnail; small enough for low-bandwidth lists. */
export const PREVIEW_MAX_EDGE = 320;
export const PREVIEW_MAX_BYTES = 96 * 1024;
export const PREVIEW_MAX_CONCURRENT = 2;
export const PREVIEW_MAX_QUEUED = 12;
const PREVIEW_CACHE_ENTRIES = 300;
const PREVIEW_CACHE_TTL_MS = 30 * 60_000;
const IMAGE_SOURCE_LIMIT = 40 * 1024 * 1024;
const VIDEO_SOURCE_LIMIT = 500 * 1024 * 1024;

export class PreviewBusyError extends Error { constructor() { super("Preview workers are busy."); this.name = "PreviewBusyError"; } }
export class PreviewUnreadableError extends Error { constructor(message = "This media could not be previewed.") { super(message); this.name = "PreviewUnreadableError"; } }

/** Bounded counting semaphore with a bounded wait queue. */
export function createLimiter(maxActive: number, maxQueued: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return {
    get active() { return active; },
    get queued() { return waiting.length; },
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active >= maxActive) {
        if (waiting.length >= maxQueued) throw new PreviewBusyError();
        await new Promise<void>(resolve => waiting.push(resolve));
      } else active += 1;
      try { return await task(); }
      finally {
        const next = waiting.shift();
        if (next) next(); else active -= 1;
      }
    },
  };
}

/** Private in-memory cache: never persisted to storage or disk. */
export function createPreviewCache(maxEntries = PREVIEW_CACHE_ENTRIES, ttlMs = PREVIEW_CACHE_TTL_MS, now = () => Date.now()) {
  const entries = new Map<string, { bytes: Buffer; at: number }>();
  return {
    get(id: string): Buffer | undefined {
      const hit = entries.get(id);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) { entries.delete(id); return undefined; }
      entries.delete(id); entries.set(id, hit);
      return hit.bytes;
    },
    set(id: string, bytes: Buffer) {
      entries.delete(id);
      entries.set(id, { bytes, at: now() });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
    delete(id: string) { entries.delete(id); },
    get size() { return entries.size; },
  };
}

const limiter = createLimiter(PREVIEW_MAX_CONCURRENT, PREVIEW_MAX_QUEUED);
const cache = createPreviewCache();
const inflight = new Map<string, Promise<Buffer>>();

/** Drop any cached thumbnail when the original is deleted or hidden. */
export function evictMediaPreview(mediaId: string): void {
  cache.delete(mediaId);
}

function limitBytes(max: number) {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > max) callback(new PreviewUnreadableError("This file is too large to preview."));
      else callback(null, chunk);
    },
  });
}

function ffmpeg(args: string[], timeoutMs = 45_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    timer.unref();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-2000); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new PreviewUnreadableError(stderr.split("\n").filter(Boolean).pop() || "ffmpeg failed")); });
  });
}

export function previewFilterArgs(): string {
  return `scale='min(${PREVIEW_MAX_EDGE},iw)':'min(${PREVIEW_MAX_EDGE},ih)':force_original_aspect_ratio=decrease`;
}

async function render(source: () => Readable, kind: "image" | "video"): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "vibeswipe-preview-"));
  try {
    const input = join(dir, "source");
    const output = join(dir, "preview.jpg");
    await pipeline(source(), limitBytes(kind === "video" ? VIDEO_SOURCE_LIMIT : IMAGE_SOURCE_LIMIT), createWriteStream(input));
    const tail = ["-frames:v", "1", "-vf", previewFilterArgs(), "-q:v", "7", "-map_metadata", "-1", "-f", "image2", "-y", output];
    if (kind === "video") {
      try { await ffmpeg(["-hide_banner", "-loglevel", "error", "-ss", "0.4", "-i", input, ...tail]); }
      catch { await ffmpeg(["-hide_banner", "-loglevel", "error", "-i", input, ...tail]); }
    } else await ffmpeg(["-hide_banner", "-loglevel", "error", "-i", input, ...tail]);
    let bytes = await readFile(output);
    if (bytes.length > PREVIEW_MAX_BYTES) {
      await ffmpeg(["-hide_banner", "-loglevel", "error", "-i", output, "-q:v", "16", "-y", join(dir, "smaller.jpg")]);
      bytes = await readFile(join(dir, "smaller.jpg"));
    }
    if (!bytes.length || bytes.length > PREVIEW_MAX_BYTES) throw new PreviewUnreadableError();
    return bytes;
  } catch (error) {
    if (error instanceof PreviewBusyError || error instanceof PreviewUnreadableError) throw error;
    throw new PreviewUnreadableError();
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Returns a bounded JPEG thumbnail made server-side from the stored original.
 * Callers MUST authorize the viewer before calling; results are cached in memory only.
 */
export async function getMediaPreview(mediaId: string, kind: "image" | "video", source: () => Readable): Promise<Buffer> {
  const cached = cache.get(mediaId);
  if (cached) return cached;
  const running = inflight.get(mediaId);
  if (running) return running;
  const job = limiter.run(() => render(source, kind)).then(bytes => { cache.set(mediaId, bytes); return bytes; });
  inflight.set(mediaId, job);
  try { return await job; }
  finally { inflight.delete(mediaId); }
}
