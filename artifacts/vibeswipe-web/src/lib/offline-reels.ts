import type { Reel } from "@workspace/api-client-react";
import { reelMediaUrl } from "@/lib/reels";

export const OFFLINE_REEL_CACHE = "myage-offline-reels-v1";
const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type OfflineCacheReply = {
  ok: boolean;
  message: string;
};

type OfflineReelRecord = {
  reel: Reel;
  savedAt: number;
  bytes: number;
};

function networkType(): string {
  const connection = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return connection?.type?.toLowerCase() ?? "unknown";
}

export function isOfflineReelWifi(): boolean {
  return networkType() === "wifi";
}

export async function readOfflineReels(): Promise<Reel[]> {
  if (typeof caches === "undefined") return [];
  try {
    const cache = await caches.open(OFFLINE_REEL_CACHE);
    const keys = await cache.keys();
    const metadataKeys = keys.filter((key) => new URL(key.url).pathname.includes("/__offline-reels/"));
    const records: OfflineReelRecord[] = [];
    for (const key of metadataKeys) {
      const response = await cache.match(key);
      if (!response) continue;
      const record = await response.json() as OfflineReelRecord;
      if (!record?.reel?.id || !record.reel.videoReference || !Number.isFinite(record.savedAt)) continue;
      if (Date.now() - record.savedAt > MAX_OFFLINE_AGE_MS) continue;
      const mediaUrl = new URL(reelMediaUrl(record.reel.videoReference), window.location.origin).href;
      if (!(await cache.match(mediaUrl))) continue;
      records.push(record);
    }
    return records
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(({ reel }) => ({ ...reel, likedByMe: false, savedByMe: false, isOwner: false, createdAt: String(reel.createdAt) }));
  } catch {
    return [];
  }
}

export async function saveReelForOffline(reel: Reel, manual = false): Promise<OfflineCacheReply> {
  if (!navigator.onLine) return { ok: false, message: "You’re offline. Only videos saved earlier can play." };
  if (networkType() === "cellular") return { ok: false, message: "Connect to Wi-Fi to save this video offline." };

  const unknownNetwork = networkType() !== "wifi";
  if (!manual && unknownNetwork) return { ok: false, message: "" };
  if (manual && unknownNetwork && !window.confirm("Your browser cannot confirm Wi-Fi. Save only if you are connected to Wi-Fi. This downloads the full video and uses device storage.")) {
    return { ok: false, message: "", };
  }
  if (!("serviceWorker" in navigator)) return { ok: false, message: "Offline video saving is not available in this browser." };

  let worker: ServiceWorker | null = navigator.serviceWorker.controller;
  if (!worker) {
    const registration = await navigator.serviceWorker.getRegistration(new URL(import.meta.env.BASE_URL, window.location.origin).href);
    worker = registration?.active ?? registration?.waiting ?? null;
  }
  if (!worker) return { ok: false, message: "Offline saving is not ready yet. Refresh the app and try again." };

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      resolve({ ok: false, message: "Saving took too long. Keep the app open and try again on Wi-Fi." });
    }, 120_000);
    channel.port1.onmessage = (event: MessageEvent<OfflineCacheReply>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    worker!.postMessage({
      type: "myage:cache-reel-offline",
      reel,
      mediaUrl: new URL(reelMediaUrl(reel.videoReference), window.location.origin).href,
      manual,
      confirmedWifi: networkType() === "wifi",
      confirmedUnknownWifi: manual && unknownNetwork,
    }, [channel.port2]);
  });
}
