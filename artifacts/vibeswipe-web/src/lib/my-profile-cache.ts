import type { Profile } from "@workspace/api-client-react";

const PROFILE_CACHE_KEY = "myage:my-profile-cache:v1";
const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedProfile = {
  userId: string;
  savedAt: number;
  profile: Profile;
};

export type CachedMyProfile = {
  profile: Profile;
  savedAt: number;
};

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<Profile>;
  return typeof profile.id === "string"
    && typeof profile.name === "string"
    && (profile.age === null || typeof profile.age === "number")
    && Array.isArray(profile.photos)
    && Array.isArray(profile.interests);
}

export function readCachedMyProfile(userId: string): CachedMyProfile | undefined {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as Partial<CachedProfile>;
    if (
      typeof cached.savedAt !== "number"
      || Date.now() - cached.savedAt > PROFILE_CACHE_TTL_MS
      || cached.userId !== userId
      || !isProfile(cached.profile)
    ) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return undefined;
    }
    return { profile: cached.profile, savedAt: cached.savedAt };
  } catch {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      // Storage may be unavailable in a restricted browser context.
    }
    return undefined;
  }
}

export function writeCachedMyProfile(userId: string, profile: Profile) {
  if (!userId || !isProfile(profile)) return;
  try {
    const cached: CachedProfile = { userId, savedAt: Date.now(), profile };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // A full or disabled local store must not block the network-backed app.
  }
}

export function clearCachedMyProfile(userId?: string | null) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return;
    if (!userId || (JSON.parse(raw) as Partial<CachedProfile>).userId === userId) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      // Ignore unavailable storage while clearing an account's cache.
    }
  }
}
