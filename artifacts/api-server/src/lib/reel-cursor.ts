// Pure helpers shared by the Reels routes and their tests.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeReelCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeReelCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(iso ?? "");
  if (!id || !UUID.test(id) || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

export function cleanReelCaption(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

export function reelLocation(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

/** A processed upload can become a Reel only when it is the caller's own, unattached, transcoded video. */
export function reelAssetProblem(asset: {
  ownerId: string; mediaType: string; contentType: string; durationSeconds: number | null; matchId: string | null;
} | undefined, userId: string): string | null {
  if (!asset || asset.ownerId !== userId || asset.matchId) return "This video upload is not available to your account.";
  if (asset.mediaType !== "video") return "Reels must be videos.";
  if (asset.contentType !== "video/mp4" || asset.durationSeconds === null) return "Your video is still processing. Try posting again in a moment.";
  return null;
}
