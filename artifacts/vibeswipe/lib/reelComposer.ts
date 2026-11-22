export const REEL_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const REEL_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const REEL_SLIDE_MIN_COUNT = 1;
export const REEL_SLIDE_MAX_COUNT = 10;
export const REEL_CAPTION_MAX_LENGTH = 300;

export type ReelMediaMetadata = {
  name?: string | null;
  mimeType?: string | null;
};

export type ReelVideoContentType = "video/mp4" | "video/quicktime";
export type ReelPhotoContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic";

export type ReelVideoUploadCache = {
  uri: string;
  mediaId: string | null;
  processed: boolean;
};

function extensionOf(name?: string | null) {
  const cleanName = name?.split(/[?#]/, 1)[0] ?? "";
  return cleanName.slice(cleanName.lastIndexOf(".") + 1).toLowerCase();
}

function normalizedMimeType(mimeType?: string | null) {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

export function getReelVideoContentType({
  name,
  mimeType,
}: ReelMediaMetadata): ReelVideoContentType | null {
  const mime = normalizedMimeType(mimeType);
  if (mime === "video/mp4" || mime === "video/quicktime") {
    return mime as ReelVideoContentType;
  }
  if (mime && mime !== "application/octet-stream") return null;

  const extension = extensionOf(name);
  if (extension === "mp4") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  return null;
}

export function getReelPhotoContentType({
  name,
  mimeType,
}: ReelMediaMetadata): ReelPhotoContentType | null {
  const mime = normalizedMimeType(mimeType);
  if (["image/jpeg", "image/png", "image/webp", "image/heic"].includes(mime)) {
    return mime as ReelPhotoContentType;
  }
  if (mime && mime !== "application/octet-stream") return null;

  const extension = extensionOf(name);
  if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (["heic", "heif"].includes(extension)) return "image/heic";
  return null;
}

export function validateReelVideo(size: number, contentType: string | null) {
  if (!contentType) return "Choose an MP4 or MOV video.";
  if (!Number.isFinite(size) || size < 1) return "The video file size could not be read.";
  if (size > REEL_VIDEO_MAX_BYTES) return "Choose a video smaller than 500 MB.";
  return null;
}

export function validateReelPhoto(size: number, contentType: string | null) {
  if (!contentType) return "Use JPG, PNG, WebP, or HEIC photos.";
  if (!Number.isFinite(size) || size < 1) return "A photo file size could not be read.";
  if (size > REEL_PHOTO_MAX_BYTES) return "Each photo must be 15 MB or smaller.";
  return null;
}

export function validateReelSlides(
  slides: Array<{ size: number; contentType: string | null }>,
) {
  if (slides.length < REEL_SLIDE_MIN_COUNT) return "Choose at least 1 photo.";
  if (slides.length > REEL_SLIDE_MAX_COUNT) return "Choose up to 10 photos.";

  for (const slide of slides) {
    const problem = validateReelPhoto(slide.size, slide.contentType);
    if (problem) return problem;
  }
  return null;
}

export async function ensureReelVideoProcessed(
  uri: string,
  cache: { current: ReelVideoUploadCache | null },
  upload: () => Promise<string>,
  process: (mediaId: string) => Promise<unknown>,
) {
  if (cache.current?.uri !== uri) {
    cache.current = { uri, mediaId: null, processed: false };
  }

  const entry = cache.current;
  if (!entry.mediaId) entry.mediaId = await upload();
  if (!entry.processed) {
    await process(entry.mediaId);
    entry.processed = true;
  }
  return entry.mediaId;
}

export async function ensureReelSlidesUploaded(
  uris: string[],
  cache: Map<string, string>,
  upload: (uri: string) => Promise<string>,
) {
  const mediaIds: string[] = [];
  for (const uri of uris) {
    let mediaId = cache.get(uri);
    if (!mediaId) {
      mediaId = await upload(uri);
      cache.set(uri, mediaId);
    }
    mediaIds.push(mediaId);
  }
  return mediaIds;
}
