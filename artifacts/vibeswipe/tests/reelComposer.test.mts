import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureReelSlidesUploaded,
  ensureReelVideoProcessed,
  getReelPhotoContentType,
  getReelVideoContentType,
  REEL_PHOTO_MAX_BYTES,
  REEL_VIDEO_MAX_BYTES,
  validateReelSlides,
  validateReelVideo,
} from "../lib/reelComposer.ts";

test("native Reel video validation accepts MP4 and MOV within the size limit", () => {
  assert.equal(
    getReelVideoContentType({ name: "clip.mp4", mimeType: "application/octet-stream" }),
    "video/mp4",
  );
  assert.equal(getReelVideoContentType({ mimeType: "video/quicktime" }), "video/quicktime");
  assert.equal(validateReelVideo(REEL_VIDEO_MAX_BYTES, "video/mp4"), null);
  assert.match(validateReelVideo(REEL_VIDEO_MAX_BYTES + 1, "video/mp4") ?? "", /500 MB/);
  assert.match(validateReelVideo(1, null) ?? "", /MP4 or MOV/);
});

test("native photo posts accept 1–10 supported small photos", () => {
  const photo = { size: REEL_PHOTO_MAX_BYTES, contentType: "image/jpeg" };
  assert.equal(validateReelSlides([photo]), null);
  assert.equal(validateReelSlides(Array.from({ length: 10 }, () => photo)), null);
  assert.match(
    validateReelSlides(Array.from({ length: 11 }, () => photo)) ?? "",
    /up to 10/,
  );
  assert.match(
    validateReelSlides([photo, { size: REEL_PHOTO_MAX_BYTES + 1, contentType: "image/png" }]) ?? "",
    /15 MB/,
  );
  assert.equal(getReelPhotoContentType({ name: "photo.heic" }), "image/heic");
  assert.equal(getReelPhotoContentType({ mimeType: "image/avif" }), null);
});

test("video processing retries reuse uploaded media and retry only failed processing", async () => {
  const cache: { current: null | { uri: string; mediaId: string | null; processed: boolean } } = {
    current: null,
  };
  let uploads = 0;
  let processAttempts = 0;

  await assert.rejects(
    ensureReelVideoProcessed(
      "file:///reel.mp4",
      cache,
      async () => {
        uploads += 1;
        return "media-video";
      },
      async () => {
        processAttempts += 1;
        throw new Error("temporary processing error");
      },
    ),
    /temporary processing error/,
  );

  assert.deepEqual(cache.current, {
    uri: "file:///reel.mp4",
    mediaId: "media-video",
    processed: false,
  });
  assert.equal(
    await ensureReelVideoProcessed(
      "file:///reel.mp4",
      cache,
      async () => {
        uploads += 1;
        return "duplicate-media";
      },
      async () => {
        processAttempts += 1;
      },
    ),
    "media-video",
  );
  assert.equal(uploads, 1);
  assert.equal(processAttempts, 2);
  assert.equal(cache.current?.processed, true);
});

test("slideshow upload retries keep successful uploads and preserve slide order", async () => {
  const cache = new Map<string, string>();
  let failSecondPhoto = true;
  const upload = async (uri: string) => {
    if (uri === "photo-two" && failSecondPhoto) {
      failSecondPhoto = false;
      throw new Error("temporary upload error");
    }
    return `media-${uri}`;
  };

  await assert.rejects(
    ensureReelSlidesUploaded(["photo-one", "photo-two"], cache, upload),
    /temporary upload error/,
  );
  assert.equal(cache.get("photo-one"), "media-photo-one");
  assert.deepEqual(
    await ensureReelSlidesUploaded(["photo-one", "photo-two"], cache, upload),
    ["media-photo-one", "media-photo-two"],
  );
  assert.equal(cache.size, 2);
});
