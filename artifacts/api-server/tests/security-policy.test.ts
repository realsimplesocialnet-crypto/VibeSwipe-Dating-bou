import test from "node:test";
import assert from "node:assert/strict";
import { configuredOrigins, isAllowedOrigin, rateLimitRules } from "../src/lib/securityPolicy.ts";

test("production CORS origins are exact configured hosts only", () => {
  const origins = configuredOrigins({
    NODE_ENV: "production",
    REPLIT_DOMAINS: "myage.example,app.myage.example",
    VIBESWIPE_WEB_ORIGINS: "https://dashboard.myage.example",
  });

  assert.deepEqual([...origins].sort(), [
    "https://app.myage.example",
    "https://dashboard.myage.example",
    "https://myage.example",
  ]);
  assert.equal(isAllowedOrigin("https://myage.example", origins), true);
  assert.equal(isAllowedOrigin("https://attacker.example", origins), false);
  assert.equal(isAllowedOrigin("https://myage.example.attacker.example", origins), false);
});

test("development CORS adds only known local development origins", () => {
  const origins = configuredOrigins({ NODE_ENV: "development" });
  assert.equal(isAllowedOrigin("http://localhost:5173", origins), true);
  assert.equal(isAllowedOrigin("http://localhost:9999", origins), false);
});

test("sensitive write routes have durable account and IP limits", () => {
  const verification = rateLimitRules("POST", "/api/vibeswipe/verification/sessions");
  assert.deepEqual(verification.map(({ limit, windowMs, subject }) => ({ limit, windowMs, subject })), [
    { limit: 5, windowMs: 3_600_000, subject: "user" },
    { limit: 20, windowMs: 3_600_000, subject: "ip" },
  ]);

  const reports = rateLimitRules("POST", "/api/vibeswipe/reports");
  assert.equal(reports.find((rule) => rule.subject === "user")?.limit, 10);

  const uploads = rateLimitRules("POST", "/api/vibeswipe/stories/uploads/request-url");
  assert.equal(uploads.find((rule) => rule.subject === "user")?.limit, 30);

  const verificationImage = rateLimitRules("POST", "/api/vibeswipe/verification/sessions/123");
  assert.equal(verificationImage.find((rule) => rule.subject === "user")?.limit, 10);
  const locationShare = rateLimitRules("POST", "/api/vibeswipe/safety/location-share");
  assert.equal(locationShare.find((rule) => rule.subject === "user")?.limit, 5);
});

test("ordinary writes are capped while high-frequency chat updates are excluded", () => {
  assert.equal(rateLimitRules("POST", "/api/vibeswipe/reactions")[0]?.limit, 300);
  assert.deepEqual(rateLimitRules("PUT", "/api/vibeswipe/matches/123/typing"), []);
  assert.deepEqual(rateLimitRules("GET", "/api/vibeswipe/reports"), []);
  assert.equal(rateLimitRules("GET", "/api/vibeswipe/admin/export")[0]?.limit, 10);
  assert.deepEqual(rateLimitRules("POST", "/api/healthz"), []);
});

