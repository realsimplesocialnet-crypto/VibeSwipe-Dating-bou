import type { File } from "@google-cloud/storage";

const HEADER_BYTES = 64;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

export type UploadedMediaKind = "image" | "video" | "audio";

type DetectedFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "video/mp4"
  | "video/quicktime"
  | "audio/mp4"
  | "audio/aac"
  | "audio/wav";

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function isoBmffBrands(bytes: Uint8Array): Set<string> {
  const brands = new Set<string>();
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return brands;
  brands.add(ascii(bytes, 8, 12));
  for (let offset = 16; offset + 4 <= Math.min(bytes.length, HEADER_BYTES); offset += 4) {
    brands.add(ascii(bytes, offset, offset + 4));
  }
  return brands;
}

export function detectUploadedMediaFormat(bytes: Uint8Array): DetectedFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") {
    return "audio/wav";
  }

  const brands = isoBmffBrands(bytes);
  if (brands.size) {
    if ([...brands].some((brand) => /^(heic|heix|hevc|hevx|mif1|msf1|heif|heim|heis|hevm|hevs|mif2)$/i.test(brand))) {
      return "image/heic";
    }
    if (brands.has("qt  ")) return "video/quicktime";
    if ([...brands].some((brand) => /^(M4A |M4B |M4P |F4A |F4B )$/.test(brand))) {
      return "audio/mp4";
    }
    if ([...brands].some((brand) => /^(isom|iso2|iso4|iso5|iso6|iso8|mp41|mp42|mp71|avc1|M4V |dash|MSNV)$/.test(brand))) {
      return "video/mp4";
    }
  }

  if (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    (bytes[1] & 0xf6) === 0xf0
  ) {
    return "audio/aac";
  }
  return null;
}

export function uploadedMediaHeaderMatches(
  bytes: Uint8Array,
  mediaType: UploadedMediaKind,
  contentType: string,
): boolean {
  const detected = detectUploadedMediaFormat(bytes);
  if (!detected) return false;

  if (mediaType === "image") {
    return detected === contentType &&
      ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(contentType);
  }
  if (mediaType === "video") {
    return detected === contentType && ["video/mp4", "video/quicktime"].includes(contentType);
  }
  if (mediaType === "audio") {
    if (contentType === "audio/m4a") return detected === "audio/mp4";
    return detected === contentType &&
      ["audio/mp4", "audio/aac", "audio/wav"].includes(contentType);
  }
  return false;
}

/** Check the stored bytes and actual object size before media is published or served. */
export async function uploadedMediaFileMatches(
  file: File,
  mediaType: UploadedMediaKind,
  contentType: string,
): Promise<boolean> {
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : mediaType === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) return false;

  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of file.createReadStream({ start: 0, end: HEADER_BYTES - 1 })) {
    const bytes = Buffer.from(chunk);
    const remaining = HEADER_BYTES - length;
    chunks.push(bytes.subarray(0, remaining));
    length += Math.min(bytes.length, remaining);
    if (length >= HEADER_BYTES) break;
  }
  return uploadedMediaHeaderMatches(Buffer.concat(chunks, length), mediaType, contentType);
}
