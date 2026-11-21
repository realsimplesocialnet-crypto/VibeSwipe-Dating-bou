import assert from "node:assert/strict";
import { test } from "node:test";
import { canDownloadReel } from "../src/lib/reel-download-permissions.ts";
import { createReelPhotoArchive } from "../src/lib/reel-photo-archive.ts";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

test("explicit Reel download choices override the profile default", () => {
  assert.equal(canDownloadReel(true, "slides", false), true);
  assert.equal(canDownloadReel(false, "video", true), false);
});

test("legacy video Reels inherit profile settings, while old photo posts stay unavailable", () => {
  assert.equal(canDownloadReel(null, "video", true), true);
  assert.equal(canDownloadReel(undefined, "video", false), false);
  assert.equal(canDownloadReel(null, "slides", true), false);
});

test("photo downloads are streamed as a ZIP archive", async () => {
  const archive = createReelPhotoArchive();
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const complete = pipeline(archive, sink);
  archive.append(Buffer.from("first photo"), { name: "photo-01.jpg" });
  archive.append(Buffer.from("second photo"), { name: "photo-02.jpg" });
  await archive.finalize();
  await complete;

  const zip = Buffer.concat(chunks);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.includes(Buffer.from("photo-01.jpg")));
  assert.ok(zip.includes(Buffer.from("photo-02.jpg")));
  assert.ok(zip.includes(Buffer.from("first photo")));
  assert.ok(zip.includes(Buffer.from("second photo")));
});
