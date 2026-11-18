export type ReelFeedPointer = { createdAt: Date; id: string };
export type ReelFeedLane = "older" | "recent";
export type ReelFeedMixCursor = {
  cutoff: Date;
  older: ReelFeedPointer | null;
  recent: ReelFeedPointer | null;
  nextLane: ReelFeedLane;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodePointer(pointer: ReelFeedPointer | null): [number, string] | null {
  return pointer ? [pointer.createdAt.getTime(), pointer.id] : null;
}

function decodePointer(value: unknown): ReelFeedPointer | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [timestamp, id] = value;
  if (!Number.isSafeInteger(timestamp) || typeof id !== "string" || !UUID.test(id)) return undefined;
  const createdAt = new Date(timestamp);
  return Number.isNaN(createdAt.getTime()) ? undefined : { createdAt, id };
}

/** Compact cursor keeps both lanes stable across infinite-scroll pages. */
export function encodeReelFeedMixCursor(cursor: ReelFeedMixCursor): string {
  return Buffer.from(JSON.stringify({
    v: 1,
    c: cursor.cutoff.getTime(),
    o: encodePointer(cursor.older),
    r: encodePointer(cursor.recent),
    n: cursor.nextLane === "recent" ? "r" : "o",
  })).toString("base64url");
}

export function decodeReelFeedMixCursor(value: string | undefined): ReelFeedMixCursor | null {
  if (!value || value.length > 400) return null;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (data.v !== 1 || !Number.isSafeInteger(data.c) || (data.n !== "o" && data.n !== "r")) return null;
    const older = decodePointer(data.o);
    const recent = decodePointer(data.r);
    if (older === undefined || recent === undefined) return null;
    const cutoff = new Date(data.c as number);
    if (Number.isNaN(cutoff.getTime())) return null;
    return { cutoff, older, recent, nextLane: data.n === "r" ? "recent" : "older" };
  } catch {
    return null;
  }
}

export function mixReelFeedLanes<T>(
  older: readonly T[],
  recent: readonly T[],
  limit: number,
  startLane: ReelFeedLane = "older",
): { items: T[]; olderUsed: number; recentUsed: number; nextLane: ReelFeedLane } {
  const items: T[] = [];
  let olderUsed = 0;
  let recentUsed = 0;
  let lane = startLane;

  while (items.length < limit && (olderUsed < older.length || recentUsed < recent.length)) {
    if (lane === "older" && olderUsed >= older.length) lane = "recent";
    else if (lane === "recent" && recentUsed >= recent.length) lane = "older";

    if (lane === "older") items.push(older[olderUsed++]);
    else items.push(recent[recentUsed++]);

    lane = lane === "older" ? "recent" : "older";
  }

  return { items, olderUsed, recentUsed, nextLane: lane };
}
