import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { buildReelCommentReplyPushPayload, buildReelLikePushPayload } from "../src/lib/vibeswipePushPayload.ts";

const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("Reel like alert identifies the actor and links to the exact video", () => {
  const payload = buildReelLikePushPayload(" Jojo ", "abc-123");
  assert.equal(payload.body, "Jojo liked your video");
  assert.equal(payload.data.type, "reel_like");
  assert.equal(payload.data.reelId, "abc-123");
  assert.equal(payload.data.url, "reels/abc-123?returnTo=%2Fnotifications");
  assert.equal(buildReelLikePushPayload("", "id").body, "Someone liked your video");
});

test("Reel comment reply alert opens the exact reply", () => {
  const payload = buildReelCommentReplyPushPayload(" Jojo ", "reel-123", "comment-456");
  assert.equal(payload.title, "New reply to your comment");
  assert.equal(payload.body, "Jojo replied to your comment");
  assert.equal(payload.data.type, "reel_comment_reply");
  assert.equal(payload.data.url, "reels/reel-123?commentId=comment-456&returnTo=%2Fnotifications");
});

test("likes and notices are atomic, deduplicated, preference-aware, and never sent to self", () => {
  const route = source("artifacts/api-server/src/routes/vibeswipe-reels.ts");
  assert.match(route, /db\.transaction/);
  assert.match(route, /kind !== "like" \|\| !inserted\.length \|\| reel\.userId === userId/);
  assert.match(route, /recipient\.notifyLikes \?\? recipient\.notifyMatches/);
  assert.match(route, /type: "reel_like", reelId: reel\.id/);
  assert.match(route, /return notices\.length > 0/);
  const schema = source("artifacts/api-server/src/lib/reels-schema.ts");
  assert.match(schema, /CREATE UNIQUE INDEX.*recipient_id, actor_id, reel_id.*type = 'reel_like'/);
});

test("background worker displays a distinct Reel alert without replacing message alerts", async () => {
  const handlers = new Map();
  const shown: { title: string; options: { tag: string; data: { url: string } } }[] = [];
  runInNewContext(source("artifacts/vibeswipe-web/public/service-worker.js"), {
    URL,
    self: {
      registration: { scope: "https://example.test/", showNotification: async (title: string, options: any) => shown.push({ title, options }) },
      addEventListener: (event: string, handler: unknown) => handlers.set(event, handler),
      clients: { matchAll: async () => [] },
    },
  });
  let work: Promise<unknown> | undefined;
  handlers.get("push")({
    data: { json: () => buildReelLikePushPayload("Jojo", "reel1") },
    waitUntil: (promise: Promise<unknown>) => { work = promise; },
  });
  await work;
  assert.equal(shown[0].title, "New Reel like");
  assert.equal(shown[0].options.tag, "reel-like-reel1");
  assert.equal(shown[0].options.data.url, "reels/reel1?returnTo=%2Fnotifications");
  handlers.get("push")({
    data: { json: () => buildReelCommentReplyPushPayload("Jojo", "reel1", "comment1") },
    waitUntil: (promise: Promise<unknown>) => { work = promise; },
  });
  await work;
  assert.equal(shown[1].title, "New reply to your comment");
  assert.equal(shown[1].options.tag, "reel-comment-reply-comment1");
  assert.equal(shown[1].options.data.url, "reels/reel1?commentId=comment1&returnTo=%2Fnotifications");
});

test("Activity shows Reel likes in the actual web and native screens", () => {
  for (const file of ["artifacts/vibeswipe-web/src/components/social-hub.tsx", "artifacts/vibeswipe/components/SocialHub.tsx"]) {
    const screen = source(file);
    assert.match(screen, /reel-like-notice-/);
    assert.match(screen, /liked your video/);
    assert.match(screen, /mark\.mutateAsync\(\{ notificationId: n\.id \}\)/);
  }
});

test("Reel comments support profile links, replies, and reply notifications", () => {
  const comments = source("artifacts/vibeswipe-web/src/components/reels/reel-comments.tsx");
  const commentStyles = source("artifacts/vibeswipe-web/src/components/reels/reels.css");
  const feed = source("artifacts/vibeswipe-web/src/pages/reels-feed.tsx");
  const notificationPage = source("artifacts/vibeswipe-web/src/App.tsx");
  const activity = source("artifacts/vibeswipe-web/src/components/social-hub.tsx");
  const route = source("artifacts/api-server/src/routes/vibeswipe-reels.ts");
  const schema = source("artifacts/api-server/src/lib/reels-schema.ts");
  assert.match(comments, /link-reel-comment-profile-/);
  assert.match(comments, /parentCommentId: replyingTo\.id/);
  assert.match(comments, /label: `@/);
  assert.match(comments, /commentsById\.get\(reply\.parentCommentId\)/);
  assert.match(comments, /expanded \? "Less" : "More"/);
  assert.match(comments, /scrollHeight > element\.clientHeight/);
  assert.match(commentStyles, /-webkit-line-clamp: 3/);
  assert.equal((comments.match(/authorId === creatorId/g) ?? []).length, 2);
  assert.match(feed, /creatorId=\{commentReel\.creatorId\}/);
  assert.match(feed, /focusCommentId=\{initialCommentId\}/);
  assert.match(notificationPage, /n\.type === 'reel_comment_reply' && n\.commentId/);
  assert.match(activity, /n\.type === 'reel_comment_reply'/);
  assert.match(route, /isNull\(reelCommentsTable\.parentCommentId\)/);
  assert.match(route, /type: "reel_comment_reply"/);
  assert.match(schema, /parent_comment_id uuid REFERENCES vibeswipe_reel_comments\(id\) ON DELETE CASCADE/);
  assert.match(schema, /comment_id uuid REFERENCES vibeswipe_reel_comments\(id\) ON DELETE CASCADE/);
});
