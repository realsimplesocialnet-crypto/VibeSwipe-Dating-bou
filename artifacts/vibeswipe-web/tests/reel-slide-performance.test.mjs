import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const web = readFileSync(new URL("../src/components/reels/reel-slide.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../../vibeswipe/app/reels/[reelId].tsx", import.meta.url), "utf8");

test("web photo Reels preload the next two images before a swipe", () => {
  assert.match(web, /neighborIndexes = \[slideIndex - 1, slideIndex \+ 1, slideIndex \+ 2\]/);
  assert.match(web, /const image = new window\.Image\(\)/);
  assert.match(web, /loading=\{Math\.abs\(slide - slideIndex\) <= 1 \? "eager" : "lazy"\}/);
  assert.match(web, /decoding="async"/);
  assert.match(web, /fetchPriority=\{slide === slideIndex && active \? "high" : "auto"\}/);
});

test("web video Reels preload three protected posters and virtualize distant cards", () => {
  const feed = readFileSync(new URL("../src/pages/reels-feed.tsx", import.meta.url), "utf8");
  assert.match(web, /export const ReelSlide = memo/);
  assert.match(web, /useGetMediaPreview\(videoMediaId/);
  assert.match(web, /poster=\{posterUrl \|\| undefined\}/);
  assert.match(web, /preload=\{preload\}/);
  assert.match(web, /removeAttribute\("src"\)/);
  assert.match(web, /if \(!active \|\| pageHidden \|\| userPaused \|\| failed\) \{ element\.pause\(\)/);
  assert.match(web, /playsInline muted=\{Boolean\(reel\.soundtrack\) \|\| muted\} loop/);
  assert.match(feed, /const REEL_PRELOAD_AHEAD = 3/);
  assert.match(feed, /const REEL_MOUNT_BEHIND = 1/);
  assert.match(feed, /reel-slide-placeholder/);
  assert.match(feed, /IntersectionObserver/);
  assert.match(feed, /threshold: 0\.6/);
  assert.match(feed, /key=\{reel\.id\}/);
  assert.match(feed, /preload=\{index >= active && index <= active \+ 2 \? "auto" : "metadata"\}/);
  assert.match(feed, /posterEnabled=\{preloadAhead\}/);
  assert.match(feed, /active=\{index === active && activeVisibleReelId === reel\.id && !searchOpen\}/);
  assert.match(feed, /const \[muted, setMuted\] = useState\(true\)/);
  assert.match(feed, /onReelLike/);
  const timeUpdate = web.match(/onTimeUpdate=\{\(event\) => \{([\s\S]*?)\n      \}\}/)?.[1] ?? "";
  assert.match(timeUpdate, /updateProgress/);
  assert.doesNotMatch(timeUpdate, /setState|setProgress/);
});

test("native photo Reels cache adjacent authenticated images", () => {
  assert.match(native, /CachedImage\.prefetch\(neighbors, \{[\s\S]*cachePolicy: "memory-disk",[\s\S]*Authorization: `Bearer \$\{token\}`/);
  assert.match(native, /cachePolicy="memory-disk"/);
  assert.match(native, /priority=\{position === slideIndex \? "high" : "normal"\}/);
});
