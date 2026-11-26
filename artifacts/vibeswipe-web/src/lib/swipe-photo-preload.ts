// Decode the same photo URLs the swipe card will paint, and drop the ones that fall behind.

export type SwipeWarmImage = {
  src: string;
  decoding: "sync" | "async" | "auto";
  fetchPriority: "high" | "low" | "auto";
  decode?: () => Promise<void>;
};

const warmed = new Map<string, SwipeWarmImage>();

/** Network URL used by the swipe card for a plain photo. Empty for media: and demo: refs. */
export function swipeCardPhotoUrl(reference?: string | null): string {
  if (!reference || reference.startsWith("media:") || reference.startsWith("demo:")) return "";
  if (reference.startsWith("http")) return reference;
  return `/api/storage${reference.startsWith("/") ? reference : `/${reference}`}`;
}

export function warmSwipePhotoUrls(
  retainUrls: readonly string[],
  fetchUrls: readonly string[],
  createImage: () => SwipeWarmImage = createBrowserImage,
): string[] {
  const retain = new Set<string>();
  for (const url of retainUrls) if (url) retain.add(url);
  for (const url of fetchUrls) if (url) retain.add(url);

  for (const [url, image] of warmed) {
    if (retain.has(url)) continue;
    image.src = "data:,";
    warmed.delete(url);
  }

  for (const url of fetchUrls) {
    if (!url || warmed.has(url)) continue;
    const image = createImage();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = url;
    warmed.set(url, image);
    const pending = image.decode?.();
    if (pending) void pending.catch(() => undefined);
  }

  return [...warmed.keys()];
}

export function resetSwipePhotoWarmup(): void {
  warmSwipePhotoUrls([], []);
}

function createBrowserImage(): SwipeWarmImage {
  return new Image();
}
