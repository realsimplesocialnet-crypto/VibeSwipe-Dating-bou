import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  resetSwipePhotoWarmup,
  swipeCardPhotoUrl,
  warmSwipePhotoUrls,
  type SwipeWarmImage,
} from "../src/lib/swipe-photo-preload.ts";

type FakeImage = SwipeWarmImage & { decoded: number };

function fakeImage(): FakeImage {
  const image: FakeImage = {
    src: "",
    decoding: "auto",
    fetchPriority: "auto",
    decoded: 0,
    decode() {
      image.decoded += 1;
      return Promise.resolve();
    },
  };
  return image;
}

describe("swipe photo preload", { concurrency: 1 }, () => {
  test("plain photo URLs match the swipe card", () => {
    assert.equal(swipeCardPhotoUrl(undefined), "");
    assert.equal(swipeCardPhotoUrl("media:abc"), "");
    assert.equal(swipeCardPhotoUrl("demo:person"), "");
    assert.equal(swipeCardPhotoUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
    assert.equal(swipeCardPhotoUrl("http://cdn.example/a.jpg"), "http://cdn.example/a.jpg");
    assert.equal(swipeCardPhotoUrl("/photos/a.jpg"), "/api/storage/photos/a.jpg");
    assert.equal(swipeCardPhotoUrl("photos/a.jpg"), "/api/storage/photos/a.jpg");
  });

  test("upcoming photo bytes are decoded at low priority and cards far behind are released", () => {
    resetSwipePhotoWarmup();
    const created: FakeImage[] = [];
    const urls = Array.from({ length: 8 }, (_, index) => `https://cdn.example/${index}.jpg`);
    const held = warmSwipePhotoUrls(urls.slice(0, 5), urls.slice(1, 5), () => {
      const image = fakeImage();
      created.push(image);
      return image;
    });
    assert.deepEqual(held, urls.slice(1, 5));
    assert.equal(created.length, 4);
    for (const image of created) {
      assert.equal(image.fetchPriority, "low");
      assert.equal(image.decoding, "async");
      assert.equal(image.decoded, 1);
    }

    const afterSwipe = warmSwipePhotoUrls(urls.slice(1, 6), urls.slice(2, 6), () => {
      const image = fakeImage();
      created.push(image);
      return image;
    });
    assert.deepEqual(afterSwipe, urls.slice(1, 6));
    assert.equal(created.length, 5);
    assert.equal(created[0].src, urls[1]);

    const afterJump = warmSwipePhotoUrls(urls.slice(5, 8), urls.slice(6, 8), () => {
      const image = fakeImage();
      created.push(image);
      return image;
    });
    assert.deepEqual(afterJump, [urls[5], urls[6], urls[7]]);
    assert.equal(created[0].src, "data:,");
    assert.equal(created[1].src, "data:,");
    assert.equal(created[4].src, urls[5]);
    resetSwipePhotoWarmup();
    assert.equal(created[4].src, "data:,");
  });

  test("discover warms those URLs inside the existing prefetch and does not spinner over a cached deck", () => {
    const page = readFileSync(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../src/components/discover-swipe-card.tsx", import.meta.url), "utf8");
    const effect = page.slice(page.indexOf("const upcoming = profiles.slice"), page.indexOf("const worldwide"));
    assert.match(effect, /warmSwipePhotoUrls\(/);
    assert.match(effect, /swipeCardPhotoUrl\(candidate\.photos\?\.\[0\]\)/);
    assert.match(effect, /upcoming\.slice\(1\)/);
    assert.match(card, /swipeCardPhotoUrl\(profile\.photos\?\.\[0\]\)/);
    assert.match(page, /const hasCachedProfiles = profiles\.length > 0 \|\| \(discover\.data\?\.length \?\? 0\) > 0/);
    assert.match(page, /if \(discover\.isLoading && !hasCachedProfiles\)/);
    assert.match(page, /if \(discover\.isError && !discover\.data\)/);
    const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
    assert.match(css, /@keyframes pageIn \{ from \{ opacity:0 \} to \{ opacity:1 \} \}/);
    assert.doesNotMatch(css, /translateY\(8px\)/);
    assert.match(css, /\[data-kept-tab\] \.page-in \{ animation: none; \}/);
    assert.match(css, /scrollbar-gutter:stable/);
    const router = readFileSync(new URL("../src/lib/router-compat.tsx", import.meta.url), "utf8");
    assert.match(router, /"\/reels"/);
    assert.match(router, /"\/notifications"/);
  });
});
