import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatCount, reelFileProblem, reelLibraryNavigation, reelMediaUrl, reelShareMessage, reelShareUrl, safeReelReturnPath, sharedReelId } from "../src/lib/reels.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Saved Reels goes back to its caller and defaults to Reels, never a hardcoded Profile", () => {
  assert.equal(reelLibraryNavigation("", "saved").returnTo, "/reels");
  for (const caller of ["/reels", `/reels/${id}?returnTo=%2Fnotifications`, "/profile"]) {
    const search = `?returnTo=${encodeURIComponent(caller)}`;
    for (const tab of ["saved", "posted"]) {
      const navigation = reelLibraryNavigation(search, tab);
      assert.equal(navigation.returnTo, caller);
      const roundTripSearch = navigation.here.slice(navigation.here.indexOf("?"));
      assert.equal(reelLibraryNavigation(roundTripSearch, tab).returnTo, caller);
      assert.equal(new URLSearchParams(roundTripSearch).get("tab"), tab === "posted" ? "posted" : null);
    }
  }
  assert.equal(reelLibraryNavigation("?returnTo=https%3A%2F%2Fevil.example", "saved").returnTo, "/discover");
  const library = read("../src/pages/reels-library.tsx");
  assert.match(library, /onClick=\{\(\) => setLocation\(returnTo\)\}/);
  assert.ok(!library.includes('setLocation("/profile")'));
});

test("opening Saved Reels carries the currently watched video and its original back destination", () => {
  const feed = read("../src/pages/reels-feed.tsx");
  assert.match(feed, /\/reels\/\$\{reels\[active\]\.id\}\?returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(feed, /\/reels\/saved\?returnTo=\$\{encodeURIComponent\(resumePath\)\}/);
});

test("Reels entry stays in navigation and saved videos are reached inside Reels", () => {
  const app = read("../src/App.tsx");
  assert.match(app, /href: '\/reels', label: 'Reels'/);
  assert.ok(!read("../src/components/discover-swipe-page.tsx").includes("link-open-reels"));
  assert.ok(!app.includes("link-profile-saved-reels"));
  assert.ok(read("../src/pages/reels-feed.tsx").includes('data-testid="link-reels-saved"'));
});

test("five bottom tabs keep Reels while Matches is reached through Activity", () => {
  const app = read("../src/App.tsx");
  const navigation = app.split("const navItems = [")[1].split("];")[0];
  assert.deepEqual([...navigation.matchAll(/label: '([^']+)'/g)].map(m => m[1]),
    ["Discover", "Reels", "Messages", "Activity"]);
  assert.match(app, /data-testid="mobile-nav-profile"/);
  assert.ok(!navigation.includes("href: '/matches'"));
  const activity = read("../src/components/social-hub.tsx");
  assert.match(activity, /key: 'matches', href: '\/matches', label: 'Matches'/);
  assert.match(activity, /<Head title="Matches" back \/>/);
});

test("a shared Reel message carries an openable link the chat recognises", () => {
  const url = reelShareUrl("https://vibe.example", "/", id);
  assert.equal(url, `https://vibe.example/reels/${id}`);
  assert.equal(sharedReelId(reelShareMessage(url, "Amara")), id);
  assert.equal(sharedReelId("see /reels/not-a-reel"), null);
  assert.equal(sharedReelId(null), null);
});

test("only supported, bounded videos are accepted for upload", () => {
  assert.equal(reelFileProblem({ name: "a.mp4", type: "video/mp4", size: 1024 }), null);
  assert.equal(reelFileProblem({ name: "a.MOV", type: "", size: 1024 }), null);
  assert.match(reelFileProblem({ name: "a.webm", type: "video/webm", size: 1024 }), /MP4 or MOV/);
  assert.match(reelFileProblem({ name: "a.mp4", type: "video/mp4", size: 501 * 1024 * 1024 }), /500 MB/);
  assert.match(reelFileProblem({ name: "a.jpg", type: "image/jpeg", size: 10 }), /MP4 or MOV/);
});

test("Reels composer uses full-length processing rather than the short profile-video endpoint", () => {
  const composer = read("../src/pages/reel-composer.tsx");
  assert.match(composer, /useTranscodeReelVideo/);
  assert.doesNotMatch(composer, /useTranscodeProfileVideo|REEL_MAX_SECONDS/);
  assert.match(composer, /3 minutes or longer/);
});

test("media urls stay on the protected endpoint and return paths stay in-app", () => {
  assert.equal(reelMediaUrl(`media:${id}`), `/api/vibeswipe/media/${id}`);
  assert.equal(reelMediaUrl("https://elsewhere.example/v.mp4"), "");
  assert.equal(safeReelReturnPath("//evil.example"), "/discover");
  assert.equal(safeReelReturnPath("/chat/abc"), "/chat/abc");
  assert.equal(formatCount(1280), "1.3K");
});

test("Reels viewer keeps autoplay muted, inline and paused offscreen or hidden", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  assert.match(slide, /playsInline muted loop/);
  assert.match(slide, /!active \|\| pageHidden \|\| userPaused/);
  assert.match(slide, /setBlocked\(true\)/);
  const feed = read("../src/pages/reels-feed.tsx");
  assert.match(feed, /visibilitychange/);
  assert.match(feed, /useState\(true\)/);
  assert.match(feed, /getNextPageParam/);
});

test("Reels routes sit outside the main navigation shell and comments sit below the video", () => {
  const app = read("../src/App.tsx");
  assert.match(app, /<Route path="\/reels" component=\{ReelsRoute\}\/>/);
  assert.ok(!/'\/reels'/.test(app.split("const showMainNavigation")[1].split("\n")[0]));
  const feed = read("../src/pages/reels-feed.tsx");
  assert.ok(feed.indexOf("<ReelComments") > feed.indexOf('className="reels-stage"'));
  const css = read("../src/components/reels/reels.css");
  assert.match(css, /\.reel-comments \{ flex: 0 0 auto/);
});

test("Reels UI copy contains no emoji", () => {
  for (const file of ["../src/pages/reels-feed.tsx", "../src/pages/reel-composer.tsx", "../src/pages/reels-library.tsx", "../src/components/reels/reel-slide.tsx", "../src/components/reels/reel-comments.tsx", "../src/components/reels/reel-share-sheet.tsx"]) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(read(file)), file);
  }
});
