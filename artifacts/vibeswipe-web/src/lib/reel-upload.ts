export class ReelUploadError extends Error {
  readonly userMessage: string;
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ReelUploadError";
    this.code = code;
    this.userMessage = message;
    this.status = status;
  }
}

type ReelUploadOptions = {
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  onAttempt?: (attempt: number) => void;
  timeoutMs?: number;
};

const MAX_ATTEMPTS = 3;
const SIGNED_UPLOAD_TTL_MS = 15 * 60 * 1000;

export function reelPostUnauthorizedMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("status" in error) || error.status !== 401) return null;
  return "The post request was rejected. Your video and caption are still here—tap Post to try again.";
}

/**
 * Upload a Reel directly to its signed storage URL. Retrying the same PUT is safe:
 * it overwrites the same private object instead of creating another asset.
 */
export async function uploadReelVideoBytes(
  url: string,
  file: Blob,
  contentType: string,
  options: ReelUploadOptions = {},
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? SIGNED_UPLOAD_TTL_MS - 30_000);
    let failure: ReelUploadError;
    let retry = false;

    try {
      const response = await fetcher(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
        signal: controller.signal,
      });
      if (response.ok) return;

      retry = response.status === 408 || response.status === 429 || response.status >= 500;
      failure = response.status === 401 || response.status === 403
        ? new ReelUploadError(
          "REEL_UPLOAD_LINK",
          "The secure video upload link was rejected. Your video is still selected; tap Post again to request a fresh link.",
          response.status,
        )
        : new ReelUploadError(
          "REEL_UPLOAD_STORAGE",
          "Video storage couldn’t accept this upload. Your video is still selected; check your connection and tap Post to retry.",
          response.status,
        );
    } catch {
      failure = controller.signal.aborted
        ? new ReelUploadError(
          "REEL_UPLOAD_TIMEOUT",
          "The video upload took too long. Your video is still selected; tap Post again to request a fresh upload link.",
        )
        : new ReelUploadError(
          "REEL_UPLOAD_NETWORK",
          "The video couldn’t be uploaded to secure storage. Your video is still selected; check your connection and tap Post to retry.",
        );
      retry = !controller.signal.aborted;
    } finally {
      clearTimeout(timer);
    }

    if (!retry || attempt === MAX_ATTEMPTS) throw failure;
    await wait(attempt * 800);
  }
}
