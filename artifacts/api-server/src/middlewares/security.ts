import { createHash } from "node:crypto";
import { getAuth } from "@clerk/express";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { pool } from "@workspace/db";
import { configuredOrigins, isAllowedOrigin, rateLimitRules } from "../lib/securityPolicy";

const allowedOrigins = configuredOrigins(process.env);

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-XSS-Protection", "0");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
  }
  next();
};

export const isOriginAllowed = (origin: string): boolean =>
  isAllowedOrigin(origin, allowedOrigins);

export const enforceSameOriginWrites: RequestHandler = (req, res, next) => {
  const origin = req.get("Origin");
  const hasBearerToken = /^Bearer\s+\S+/i.test(req.get("Authorization") ?? "");
  if (
    origin &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) &&
    !hasBearerToken &&
    !isOriginAllowed(origin)
  ) {
    res.status(403).json({ error: "This request origin is not allowed." });
    return;
  }
  next();
};

async function incrementWindow(key: string, windowMs: number): Promise<number> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO vibeswipe_api_rate_limits (bucket_key, window_started_at, attempts)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_started_at)
     DO UPDATE SET attempts = vibeswipe_api_rate_limits.attempts + 1
     RETURNING attempts`,
    [key, windowStart],
  );
  return Number(result.rows[0]?.attempts ?? 1);
}

function digestKey(bucket: string, subject: string): string {
  return createHash("sha256").update(`${bucket}:${subject}`).digest("hex");
}

export const rateLimitSensitiveApiRequests: RequestHandler = async (req, res, next) => {
  const rules = rateLimitRules(req.method, req.path);
  if (rules.length === 0) {
    next();
    return;
  }

  const userId = getAuth(req).userId;
  const ip = req.ip || "unknown";
  const applicableRules = rules.filter((rule) => rule.subject === "ip" || userId);
  try {
    const counts = await Promise.all(applicableRules.map((rule) => {
      const subject = rule.subject === "user" ? userId! : ip;
      return incrementWindow(digestKey(`${rule.bucket}:${rule.subject}`, subject), rule.windowMs)
        .then((attempts) => ({ rule, attempts }));
    }));

    const blocked = counts.find(({ rule, attempts }) => attempts > rule.limit);
    if (blocked) {
      const windowStart = Math.floor(Date.now() / blocked.rule.windowMs) * blocked.rule.windowMs;
      const retrySeconds = Math.max(1, Math.ceil((windowStart + blocked.rule.windowMs - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retrySeconds));
      res.setHeader("RateLimit-Limit", String(blocked.rule.limit));
      res.setHeader("RateLimit-Remaining", "0");
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "API rate-limit storage is unavailable");
    res.status(503).json({ error: "This action is temporarily unavailable. Please try again." });
  }
};

export const safeRequestErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Request is too large." });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is invalid." });
    return;
  }
  req.log.error({ err: error }, "Unhandled API request error");
  res.status(500).json({ error: "An unexpected error occurred." });
};
