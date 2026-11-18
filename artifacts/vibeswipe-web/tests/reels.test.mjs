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
  assert.match(feed, /const resumeParams = new URLSearchParams\(\{ returnTo \}\)/);
  assert.match(feed, /resumeParams\.set\("profileId", profileId\)/);
  assert.match(feed, /\/reels\/\$\{reels\[active\]\.id\}\?\$\{resumeParams\.toString\(\)\}/);
  assert.match(feed, /\/reels\/saved\?returnTo=\$\{encodeURIComponent\(resumePath\)\}/);
});

test("opening a profile Reel keeps swiping inside that person's Reel list", () => {
  const feed = read("../src/pages/reels-feed.tsx");
  const profileSection = read("../src/components/profile-reels-section.tsx");
  assert.match(profileSection, /profileId=\$\{encodeURIComponent\(reel\.creatorId\)\}/);
  assert.match(feed, /enabled: !profileId/);
  assert.match(feed, /getProfileReels\(\{ profileId/);
  assert.match(feed, /const pages = profileId \? profileFeed\.data\?\.pages : feed\.data\?\.pages/);
  assert.match(feed, /You’ve seen all of this person’s Reels/);
});

test("Reels search updates results while typing across captions and locations", () => {
  const feed = read("../src/pages/reels-feed.tsx");
  const route = read("../../api-server/src/routes/vibeswipe-reels.ts");
  const spec = read("../../../lib/api-spec/openapi.yaml");
  assert.match(feed, /data-testid="button-search-reels"/);
  assert.match(feed, /data-testid="button-search-reels" className="reels-search-trigger"/);
  assert.match(feed, /data-testid="input-search-reels"/);
  assert.match(feed, /placeholder="Search Reels"/);
  const css = read("../src/components/reels/reels.css");
  assert.match(css, /\.reels-search-trigger \{[^}]*border-radius: 0;[^}]*background: transparent;/);
  assert.match(css, /\.reels-search-field \{[^}]*border: 0; border-radius: 0; background: transparent;/);
  assert.match(feed, /q: debouncedSearchText/);
  assert.doesNotMatch(feed, /Search Reel captions, people, or places as you type/);
  assert.match(route, /reelSearchTerms\(query\.data\.q\)/);
  assert.match(route, /profilesTable\.city/);
  assert.match(spec, /name: q/);
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
    ["Discover", "Reels", "Chats", "Activity"]);
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

test("Reels composer states there is no duration cap and uses full-length processing", () => {
  const composer = read("../src/pages/reel-composer.tsx");
  assert.match(composer, /useTranscodeReelVideo/);
  assert.doesNotMatch(composer, /useTranscodeProfileVideo|REEL_MAX_SECONDS/);
  assert.match(composer, /no Reel duration limit/i);
  assert.match(composer, /500 MB/);
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
  assert.match(slide, /playsInline muted=\{muted\} loop/);
  assert.match(slide, /!active \|\| pageHidden \|\| userPaused/);
  assert.match(slide, /setBlocked\(true\)/);
  assert.match(slide, /name === "NotAllowedError" && !muted/);
  assert.match(slide, /element\.muted = true;\s*const mutedAttempt = element\.play\(\)/);
  assert.doesNotMatch(slide, /button-reel-autoplay-blocked|reel-blocked-play/);
  assert.doesNotMatch(slide, /Your browser paused autoplay/);
  const feed = read("../src/pages/reels-feed.tsx");
  assert.match(feed, /onAutoplayMuted=\{\(\) => setMuted\(true\)\}/);
  assert.match(feed, /visibilitychange/);
  assert.match(feed, /useState\(document\.visibilityState === "hidden"\)/);
  assert.match(feed, /getNextPageParam/);
});

test("tapping anywhere on a Reel toggles playback without hiding navigation", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const feed = read("../src/pages/reels-feed.tsx");
  const css = read("../src/components/reels/reels.css");
  assert.match(slide, /className="reel-tap" onClick=\{handleVideoTap\}/);
  assert.match(slide, /function handleVideoTap\(\)/);
  assert.match(slide, /now - previousTap\.at < 300/);
  const playbackHandler = slide.match(/function togglePlayback\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(playbackHandler, /element\.pause\(\)/);
  assert.match(playbackHandler, /element\.play\(\)/);
  assert.match(slide, /data-testid=\{`button-toggle-reel-playback-/);
  assert.doesNotMatch(slide, /reel-playback-control|onToggleNavigation/);
  assert.match(feed, /navigationVisible = !commentsFor && !searchOpen && !viewport\.keyboardOpen/);
  assert.doesNotMatch(feed, /setControlsVisible/);
  assert.match(css, /--reels-navigation-space/);
  assert.match(css, /\.reel-meta\.is-nav-visible \{ bottom: 22px/);
  assert.match(css, /data-navigation-visible="false"\]:not\(\[data-comments-open="true"\]\) \.reel-progress/);
});

test("Reel playback and sound use video taps without permanent top controls", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const feed = read("../src/pages/reels-feed.tsx");
  const css = read("../src/components/reels/reels.css");
  assert.match(slide, /onToggleSound\(\)/);
  assert.match(slide, /showFlash\(muted \? "sound-on" : "sound-off"\)/);
  assert.match(slide, /Volume2 size=\{34\}/);
  assert.match(slide, /VolumeX size=\{34\}/);
  assert.match(slide, /button-toggle-reel-sound-accessible-/);
  assert.doesNotMatch(feed, /button-reels-mute|reels-sound|Volume2|VolumeX/);
  assert.doesNotMatch(css, /\.reels-sound/);
  assert.doesNotMatch(slide, /button-reel-autoplay-blocked|reel-blocked-play/);
});

test("Reel creator details stay aligned with a prominent profile block", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const css = read("../src/components/reels/reels.css");
  const creatorIdentity = slide.slice(slide.indexOf("const creatorIdentity"), slide.indexOf("return <section"));
  assert.match(slide, /className="reel-identity flex min-w-0 items-center gap-2/);
  assert.match(creatorIdentity, /reel-creator-avatar-ring/);
  assert.match(creatorIdentity, /ReelAvatar reference=\{reel\.creatorPhoto\}/);
  assert.match(css, /\.reel-identity \{ position: relative; top: 0; gap: 10px/);
  assert.match(css, /\.reel-name \{ font-size: 18px/);
  assert.match(css, /\.reel-age \{ font-size: 15px/);
  assert.match(css, /\.reel-location \{ font-size: 12px/);
  assert.match(css, /\.reel-meta \{ position: absolute; left: 20px; right: 84px; bottom: calc\(env\(safe-area-inset-bottom\) \+ 22px\)/);
  assert.match(slide, /className=\{`reel-meta \$\{compact \? "is-compact" : ""\} \$\{navigationVisible \? "is-nav-visible" : ""\}`\}/);
});

test("Reels route is code-split and autoplay fallback shows no explanatory message", () => {
  const app = read("../src/App.tsx");
  const slide = read("../src/components/reels/reel-slide.tsx");
  assert.match(app, /const ReelsFeedPage = lazy\(\(\) => import\('@\/pages\/reels-feed'\)/);
  assert.match(app, /<Suspense fallback=/);
  assert.doesNotMatch(slide, /Your browser paused autoplay/);
  assert.doesNotMatch(slide, /reel-blocked-play|button-reel-autoplay-blocked/);
});

test("Reel views count as soon as playback starts, without requiring a watch-time threshold", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  assert.match(slide, /const viewRecorded = useRef\(false\)/);
  assert.match(slide, /onPlaying=\{\(event\) => \{[\s\S]*?!viewRecorded\.current && !element\.paused[\s\S]*?viewRecorded\.current = true;\s*onView\(\)/);
  assert.doesNotMatch(slide, /onPlay=\{onView\}/);
  assert.doesNotMatch(slide, /viewThreshold/);
});

test("watched Reels can be saved on Wi-Fi and reopened from the bounded offline cache", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const feed = read("../src/pages/reels-feed.tsx");
  const cache = read("../src/lib/offline-reels.ts");
  const worker = read("../public/service-worker.js");
  assert.match(slide, /currentTime \/ element\.duration >= 0\.85/);
  assert.doesNotMatch(slide, /button-save-reel-offline|<Download/);
  assert.match(feed, /cacheOffline\(reel, false\)/);
  assert.match(feed, /readOfflineReels/);
  assert.match(feed, /feed\.isError\) for \(const reel of offlineReels/);
  assert.match(cache, /Connect to Wi-Fi to save this video offline/);
  assert.match(worker, /MAX_OFFLINE_REELS = 3/);
  assert.match(worker, /MAX_OFFLINE_TOTAL_BYTES = 120 \* 1024 \* 1024/);
  assert.match(worker, /x-myage-offline-eligible/);
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

test("Reel action rail and profile grid show persisted like, comment, save and share counts", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const profile = read("../src/components/profile-reels-section.tsx");
  const mobileProfile = read("../../vibeswipe/components/ProfileReelsSection.tsx");
  for (const file of [slide, profile, mobileProfile]) {
    assert.match(file, /likeCount/);
    assert.match(file, /commentCount/);
    assert.match(file, /shareCount/);
  }
  for (const file of [profile, mobileProfile]) assert.match(file, /saveCount/);
  assert.match(profile, /text-profile-reel-interactions-\$\{reel\.id\}/);
  assert.match(mobileProfile, /text-profile-reel-interactions-\$\{reel\.id\}/);
  const nativeReel = read("../../vibeswipe/app/reels/[reelId].tsx");
  for (const id of ["button-like-reel", "button-comments-reel", "button-save-reel", "button-share-reel", "button-post-reel-comment"]) {
    assert.ok(nativeReel.includes(id), `native Reel action is missing ${id}`);
  }
  const rail = slide.slice(slide.indexOf("className={`reel-rail"), slide.indexOf("className={`reel-meta"));
  const actionOrder = ["button-like-reel-", "button-comments-reel-", "button-share-reel-", "button-save-reel-"]
    .map((id) => rail.indexOf(id));
  assert.ok(actionOrder.every((position, index) => position >= 0 && (index === 0 || position > actionOrder[index - 1])));
  assert.equal((rail.match(/data-testid=\{`button-/g) ?? []).length, 4);
  assert.doesNotMatch(rail, /button-message-creator|Follow|Remix|Download|Music|button-delete-reel/);
  assert.match(slide, /type=\"range\"[\s\S]*?onChange=\{\(event\) => seekVideo\(event\.currentTarget\.value\)\}/);
  assert.match(slide, /onTimeUpdate=\{\(event\) => \{[\s\S]*?setProgress\(\(element\.currentTime \/ element\.duration\) \* 100\)/);
  assert.match(slide, /element\.currentTime = \(nextProgress \/ 100\) \* element\.duration/);
  const css = read("../src/components/reels/reels.css");
  assert.match(css, /\.reel-rail button svg \{ height: 24px; width: 24px/);
  assert.match(css, /\.reel-rail button \{[^}]*height: 56px;[^}]*font-size: 12px/);
  assert.match(css, /\.reel-rail \{ gap: 4px; \}/);
  assert.match(css, /\.reels-feed-tabs button\.is-active::after[^}]*background: hsl\(var\(--primary\)\)/);
  assert.doesNotMatch(css, /\.reels-mobile-nav \.mobile-nav-indicator::before/);
  assert.match(css, /\.reels-mobile-nav \.mnav-item\.is-active \{ color: #f34e9a !important/);
  assert.match(css, /\.reels-mobile-nav \.mnav-item\.is-active \.mnav-label \{ color: #f34e9a/);
});

test("Reels put the creator photo beside the name and keep Follow off the rail", () => {
  const slide = read("../src/components/reels/reel-slide.tsx");
  const feed = read("../src/pages/reels-feed.tsx");
  const route = read("../../api-server/src/routes/vibeswipe-reels.ts");
  const spec = read("../../../lib/api-spec/openapi.yaml");
  const creatorIdentity = slide.slice(slide.indexOf("const creatorIdentity"), slide.indexOf("return <section"));
  assert.match(creatorIdentity, /reel-creator-avatar-ring/);
  assert.match(creatorIdentity, /ReelAvatar reference=\{reel\.creatorPhoto\}/);
  assert.doesNotMatch(slide, /button-follow-creator|reel-follow-button|reel-follow-badge|onFollow/);
  assert.doesNotMatch(feed, /toggleCreatorFollow|useFollowProfile|pendingCreatorFollows/);
  assert.match(slide, /data-testid=\{`link-reel-profile-\$\{reel\.id\}`\}/);
  assert.match(feed, /data-testid=\"button-reels-more\"/);
  assert.match(feed, /data-testid=\"link-reels-saved\"/);
  assert.match(feed, /data-testid=\"link-create-reel\"/);
  assert.match(feed, /data-testid=\{`button-delete-reel-\$\{activeReel\.id\}`\}/);
  assert.doesNotMatch(slide, /reel-search-suggestion|button-reel-search-suggestion|Search “/);
  assert.doesNotMatch(feed, /reelCaptionSearchSuggestion|searchSuggestion=|onSearchSuggestion/);
  assert.match(feed, /data-testid="button-search-reels"/);
  assert.doesNotMatch(feed, /useGetMatches|messageCreator|button-message-creator/);
  assert.doesNotMatch(slide, /button-message-creator|MessageSquare|button-follow-creator|reel-follow-button/);
  assert.match(read("../src/App.tsx"), /requested\.startsWith\('\/reels\/'\)/);
  assert.match(route, /creatorFollowedByMe: sql<boolean>`EXISTS/s);
  assert.match(spec, /creatorFollowedByMe: \{ type: boolean \}/);
});

test("Reels restore their full viewport and navigation after returning from an external share app", () => {
  const feed = read("../src/pages/reels-feed.tsx");
  const share = read("../src/components/reels/reel-share-sheet.tsx");
  assert.match(feed, /window\.addEventListener\("pageshow", refreshAfterResume\)/);
  assert.match(feed, /document\.addEventListener\("visibilitychange", refreshAfterResume\)/);
  assert.match(feed, /setAppNavigationVisible\(true\)/);
  assert.match(feed, /--reels-viewport-height/);
  assert.match(feed, /Math\.max\(height, window\.innerHeight\)/);
  assert.match(share, /onClose\(\);\s*void sharePromise\.then/);
  assert.match(share, /await send\.mutateAsync[\s\S]*?onClose\(\)/);
});

test("Reels UI copy contains no emoji", () => {
  for (const file of ["../src/pages/reels-feed.tsx", "../src/pages/reel-composer.tsx", "../src/pages/reels-library.tsx", "../src/components/reels/reel-slide.tsx", "../src/components/reels/reel-comments.tsx", "../src/components/reels/reel-share-sheet.tsx"]) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(read(file)), file);
  }
});
