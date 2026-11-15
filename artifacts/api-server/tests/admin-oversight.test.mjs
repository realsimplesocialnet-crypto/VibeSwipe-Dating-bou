import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const posts = source("../src/routes/vibeswipe-admin-posts.ts");
const admin = source("../src/routes/vibeswipe-admin.ts");

test("post endpoints have their own verified administrator guard", () => {
  assert.match(posts, /router\.use\("\/vibeswipe\/admin\/posts", createAdminGuard/);
  assert.match(posts, /loadUser: id => clerkClient\.users\.getUser\(id\)/);
  assert.match(posts, /process\.env\.VIBESWIPE_ADMIN_EMAIL/);
  assert.match(posts, /GetAdminPostsQueryParams\.safeParse\(req\.query\)/);
});

test("post removal validates confirmation and atomically records the action", () => {
  const remove = posts.slice(posts.indexOf('router.post("/vibeswipe/admin/posts/:kind/:id/remove"'));
  assert.match(remove, /confirmation !== "REMOVE"/);
  assert.match(remove, /db\.transaction/);
  assert.match(remove, /\.for\("update"\)/);
  assert.match(remove, /tx\.delete\(reelsTable\)/);
  assert.match(remove, /tx\.delete\(storiesTable\)/);
  assert.match(remove, /tx\.insert\(adminAuditTable\)/);
});

test("private post bytes require an associated post and audit before streaming", () => {
  const media = posts.slice(posts.indexOf('router.get("/vibeswipe/admin/posts/media/:mediaId"'), posts.indexOf('router.post("/vibeswipe/admin/posts/:kind/:id/remove"'));
  assert.match(media, /isNull\(mediaAssetsTable\.matchId\)/);
  assert.match(media, /if \(!reel && !story\)/);
  assert.ok(media.indexOf('action: "inspect_post_media"') < media.indexOf("file.createReadStream()"));
  assert.match(media, /"Cache-Control", "private, no-store"/);
});

test("private chat reads are audited and general summaries never expose message text", () => {
  assert.match(admin, /lastMessage: null/);
  assert.match(admin, /await auditPrivateAccess\(req, "read_chat"/);
  assert.match(admin, /await auditPrivateAccess\(req, "export_chat"/);
  assert.match(admin, /await auditPrivateAccess\(req, "access_media"/);
});

test("active conversations count actual message activity rather than all matches", () => {
  assert.match(admin, /count\(distinct \$\{messagesTable\.matchId\}\)/);
  assert.match(admin, /activeChats: Number\(activeChats\?\.count/);
});
