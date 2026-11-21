// Shared Reels helpers. Kept framework-free so they can be unit tested.
export const REEL_MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SHARED_REEL = new RegExp(`/reels/(${UUID})(?![0-9a-f-])`, "i");

export function reelMediaUrl(reference?: string | null): string {
  if (!reference?.startsWith("media:")) return "";
  return `/api/vibeswipe/media/${encodeURIComponent(reference.slice(6))}`;
}

export function reelVideoContentType(file: { type: string; name: string }): "video/mp4" | "video/quicktime" | null {
  if (file.type === "video/mp4" || file.type === "video/quicktime") return file.type;
  if (!file.type || file.type === "application/octet-stream") {
    if (/\.mp4$/i.test(file.name)) return "video/mp4";
    if (/\.mov$/i.test(file.name)) return "video/quicktime";
  }
  return null;
}

/** Returns a user-facing problem with a chosen file, or null when it can be uploaded. */
export function reelFileProblem(file: { type: string; name: string; size: number }): string | null {
  if (!reelVideoContentType(file)) return "Choose an MP4 or MOV video. Other formats are not supported yet.";
  if (file.size > REEL_MAX_SOURCE_BYTES) return "Choose a video that is 500 MB or smaller.";
  if (file.size <= 0) return "This video file is empty.";
  return null;
}

export function reelShareUrl(origin: string, basePath: string, reelId: string): string {
  return `${origin}${basePath.replace(/\/$/, "")}/reels/${reelId}`;
}

export function reelShareMessage(url: string, creatorName: string): string {
  return `Shared a Reel from ${creatorName}: ${url}`;
}

export function sharedReelId(content: string | null | undefined): string | null {
  return content ? SHARED_REEL.exec(content)?.[1]?.toLowerCase() ?? null : null;
}

export function safeReelReturnPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/discover";
}

/** Preserve the library's caller through Saved/Posted and individual-video round trips. */
export function reelLibraryNavigation(search: string, tab: "saved" | "posted") {
  const params = new URLSearchParams(search);
  const returnTo = safeReelReturnPath(params.get("returnTo") ?? "/reels");
  const libraryParams = new URLSearchParams({ returnTo });
  if (tab === "posted") libraryParams.set("tab", "posted");
  return { returnTo, here: `/reels/saved?${libraryParams.toString()}` };
}

export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

