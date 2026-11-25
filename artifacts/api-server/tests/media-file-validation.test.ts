import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { File } from "@google-cloud/storage";
import test from "node:test";
import {
  detectUploadedMediaFormat,
  uploadedMediaFileMatches,
  uploadedMediaHeaderMatches,
} from "../src/lib/media-file-validation.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "binary");
const heic = Buffer.from("....ftypheic\x00\x00\x00\x00mif1", "binary");
const mp4 = Buffer.from("....ftypisom\x00\x00\x00\x00mp42", "binary");
const quicktime = Buffer.from("....ftypqt  \x00\x00\x00\x00qt  ", "binary");
const m4a = Buffer.from("....ftypM4A \x00\x00\x00\x00M4A ", "binary");
const wav = Buffer.from("RIFF\x10\x00\x00\x00WAVEfmt ", "binary");
const aac = Buffer.from([0xff, 0xf1, 0x50, 0x80]);

function mockFile(bytes: Buffer): File {
  return {
    getMetadata: async () => [{ size: String(bytes.length) }],
    createReadStream: () => Readable.from([bytes]),
  } as unknown as File;
}

test("detects supported image, video, and audio signatures from bytes", () => {
  assert.equal(detectUploadedMediaFormat(jpeg), "image/jpeg");
  assert.equal(detectUploadedMediaFormat(png), "image/png");
  assert.equal(detectUploadedMediaFormat(webp), "image/webp");
  assert.equal(detectUploadedMediaFormat(heic), "image/heic");
  assert.equal(detectUploadedMediaFormat(mp4), "video/mp4");
  assert.equal(detectUploadedMediaFormat(quicktime), "video/quicktime");
  assert.equal(detectUploadedMediaFormat(m4a), "audio/mp4");
  assert.equal(detectUploadedMediaFormat(wav), "audio/wav");
  assert.equal(detectUploadedMediaFormat(aac), "audio/aac");
  assert.equal(detectUploadedMediaFormat(Buffer.from("<script>alert(1)</script>")), null);
});

test("rejects declared types that do not match the file bytes", () => {
  assert.equal(uploadedMediaHeaderMatches(jpeg, "image", "image/jpeg"), true);
  assert.equal(uploadedMediaHeaderMatches(jpeg, "image", "image/png"), false);
  assert.equal(uploadedMediaHeaderMatches(jpeg, "video", "video/mp4"), false);
  assert.equal(uploadedMediaHeaderMatches(mp4, "video", "video/mp4"), true);
  assert.equal(uploadedMediaHeaderMatches(m4a, "audio", "audio/m4a"), true);
  assert.equal(uploadedMediaHeaderMatches(wav, "audio", "audio/aac"), false);
});

test("validates actual stored bytes and enforces the server-side size cap", async () => {
  assert.equal(await uploadedMediaFileMatches(mockFile(jpeg), "image", "image/jpeg"), true);
  assert.equal(await uploadedMediaFileMatches(mockFile(Buffer.from("<html>")), "image", "image/jpeg"), false);
  const oversized = {
    getMetadata: async () => [{ size: String(15 * 1024 * 1024 + 1) }],
    createReadStream: () => Readable.from([jpeg]),
  } as unknown as File;
  assert.equal(await uploadedMediaFileMatches(oversized, "image", "image/jpeg"), false);
});
