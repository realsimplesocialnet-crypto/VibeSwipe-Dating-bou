import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMessagePushPayload,
  isAllowedWebPushEndpoint,
  isValidExpoPushToken,
} from "../src/lib/vibeswipePushPayload.ts";

test("message push includes the sender, a readable preview, and chat route", () => {
  const payload = buildMessagePushPayload({
    matchId: "match-123",
    senderName: " Ada ",
    content: "  Hi   there.  ",
  });
  assert.equal(payload.title, "Ada");
  assert.equal(payload.body, "Hi there.");
  assert.equal(payload.data.matchId, "match-123");
  assert.equal(payload.data.url, "chat/match-123");
});

test("media-only messages receive a useful preview and long previews are capped", () => {
  assert.equal(
    buildMessagePushPayload({
      matchId: "match-1",
      senderName: "Sam",
      content: "",
      mediaType: "audio",
    }).body,
    "Sent a voice note",
  );
  assert.equal(
    buildMessagePushPayload({
      matchId: "match-1",
      senderName: "Sam",
      content: "x".repeat(200),
    }).body.length,
    138,
  );
});

test("web push accepts supported push services but rejects unsafe endpoints", () => {
  assert.equal(
    isAllowedWebPushEndpoint("https://web.push.apple.com/device/example"),
    true,
  );
  assert.equal(
    isAllowedWebPushEndpoint("https://fcm.googleapis.com/fcm/send/example"),
    true,
  );
  assert.equal(isAllowedWebPushEndpoint("http://fcm.googleapis.com/send"), false);
  assert.equal(isAllowedWebPushEndpoint("https://127.0.0.1/internal"), false);
  assert.equal(isAllowedWebPushEndpoint("https://example.com/push"), false);
});

test("Expo push tokens must use the platform token format", () => {
  assert.equal(isValidExpoPushToken("ExponentPushToken[abc123_xyz]"), true);
  assert.equal(isValidExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isValidExpoPushToken("https://example.com/token"), false);
});
