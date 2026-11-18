export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowMs: number;
  subject: "user" | "ip";
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NOISY_WRITE_PATHS = [
  /\/vibeswipe\/presence$/,
  /\/vibeswipe\/matches\/[^/]+\/typing$/,
  /\/vibeswipe\/matches\/[^/]+\/read$/,
  /\/vibeswipe\/notifications\/read$/,
];

function asOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function configuredOrigins(env: NodeJS.ProcessEnv): Set<string> {
  const origins = new Set<string>();
  const add = (raw: string | undefined) => {
    for (const value of raw?.split(",") ?? []) {
      const origin = asOrigin(value);
      if (origin) origins.add(origin);
    }
  };

  add(env.VIBESWIPE_WEB_ORIGINS);
  add(env.REPLIT_DOMAINS);
  add(env.REPLIT_DEV_DOMAIN);

  if (env.NODE_ENV !== "production") {
    for (const origin of [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://localhost:20207",
      "http://localhost:8081",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:4173",
      "http://127.0.0.1:20207",
      "http://127.0.0.1:8081",
    ]) origins.add(origin);
  }
  return origins;
}

export function isAllowedOrigin(origin: string, allowedOrigins: ReadonlySet<string>): boolean {
  const normalized = asOrigin(origin);
  return normalized !== null && allowedOrigins.has(normalized);
}

export function rateLimitRules(method: string, path: string): RateLimitRule[] {
  const normalizedMethod = method.toUpperCase();
  if (!path.startsWith("/api/vibeswipe/")) return [];

  if (normalizedMethod === "GET" && /^\/api\/vibeswipe\/admin\/export(?:\/|$)/.test(path)) {
    return [
      { bucket: "admin-export", limit: 10, windowMs: HOUR, subject: "user" },
      { bucket: "admin-export", limit: 25, windowMs: HOUR, subject: "ip" },
    ];
  }
  if (!WRITE_METHODS.has(normalizedMethod)) return [];
  if (NOISY_WRITE_PATHS.some((pattern) => pattern.test(path))) return [];

  if (/^\/api\/vibeswipe\/verification\/sessions\/?$/.test(path)) {
    return [
      { bucket: "verification", limit: 5, windowMs: HOUR, subject: "user" },
      { bucket: "verification", limit: 20, windowMs: HOUR, subject: "ip" },
    ];
  }
  if (/^\/api\/vibeswipe\/verification(?:\/|$)/.test(path)) {
    return [
      { bucket: "verification-completion", limit: 10, windowMs: HOUR, subject: "user" },
      { bucket: "verification-completion", limit: 30, windowMs: HOUR, subject: "ip" },
    ];
  }
  if (/^\/api\/vibeswipe\/reports(?:\/|$)/.test(path)) {
    return [
      { bucket: "reports", limit: 10, windowMs: HOUR, subject: "user" },
      { bucket: "reports", limit: 30, windowMs: HOUR, subject: "ip" },
    ];
  }
  if (/^\/api\/vibeswipe\/admin\/actions(?:\/|$)/.test(path)) {
    return [
      { bucket: "admin-actions", limit: 20, windowMs: 15 * MINUTE, subject: "user" },
      { bucket: "admin-actions", limit: 50, windowMs: 15 * MINUTE, subject: "ip" },
    ];
  }
  if (/^\/api\/vibeswipe\/safety\/location-share\/?$/.test(path)) {
    return [
      { bucket: "location-share-create", limit: 5, windowMs: HOUR, subject: "user" },
      { bucket: "location-share-create", limit: 20, windowMs: HOUR, subject: "ip" },
    ];
  }
  if (/^\/api\/vibeswipe\/(?:uploads|stories\/uploads|reels\/uploads)(?:\/|$)/.test(path)) {
    return [
      { bucket: "uploads", limit: 30, windowMs: HOUR, subject: "user" },
      { bucket: "uploads", limit: 100, windowMs: HOUR, subject: "ip" },
    ];
  }

  return [
    { bucket: "api-writes", limit: 300, windowMs: 15 * MINUTE, subject: "user" },
    { bucket: "api-writes", limit: 600, windowMs: 15 * MINUTE, subject: "ip" },
  ];
}
