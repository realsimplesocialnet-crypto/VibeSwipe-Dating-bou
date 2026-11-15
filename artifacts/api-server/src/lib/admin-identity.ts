/**
 * A stored profile can outlive its authentication account. Keep that profile
 * reviewable, without disguising authentication-provider outages as missing data.
 */
export async function loadAdminIdentity<T>(lookup: () => Promise<T>): Promise<T | null> {
  try {
    return await lookup();
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) return null;
    throw error;
  }
}
