export class PhotoUploadError extends Error {
  readonly userMessage: string;
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'PhotoUploadError';
    this.code = code;
    this.status = status;
    this.userMessage = message;
  }
}

export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/x-heic,image/x-heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

export type PhotoFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

export function sniffPhotoFormat(bytes: Uint8Array): PhotoFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
    const brands = new Set<string>();
    for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
      brands.add(String.fromCharCode(...bytes.subarray(offset, offset + 4)));
    }
    if ([...brands].some(brand => /^(heic|heix|hevc|hevx|mif1|msf1|heif|heim|heis|hevm|hevs|mif2)$/i.test(brand))) return 'image/heic';
  }
  return null;
}

export async function readPhotoBytes(file: File): Promise<Uint8Array> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length) return bytes;
  } catch {
    // Android's document/photo providers may expose a stream before a stable buffer.
  }
  try {
    const reader = file.stream().getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    if (total) {
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    }
  } catch {
    // Report one actionable message below rather than a browser-specific exception.
  }
  throw new PhotoUploadError('PHOTO_READ', 'Your phone couldn’t provide the photo data. Choose the photo again or save a copy to your device first.');
}

export function validatePhotoFile(file: Pick<File, 'size' | 'type' | 'name'>): void {
  if (file.size < 1) throw new PhotoUploadError('PHOTO_EMPTY', 'This photo is empty. Choose another picture.');
  if (file.size > 15 * 1024 * 1024) throw new PhotoUploadError('PHOTO_SIZE', 'Choose a photo smaller than 15 MB.');
  // MIME type and file name are unreliable for Android Photo Picker results.
  // The actual bytes are checked with sniffPhotoFormat before upload instead.
}

export function photoDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function photoUploadCanRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string') return true;
  return !/^PHOTO_(TYPE|EMPTY|SIZE|FORMAT|DECODE|HEIC_CONVERT)$/.test(error.code);
}

/** Read the picker file, verify its actual format, convert, and resize it before upload. */
export async function prepareProfilePhoto(file: File): Promise<File> {
  validatePhotoFile(file);
  const bytes = await readPhotoBytes(file);
  let format = sniffPhotoFormat(bytes);
  if (!format) {
    throw new PhotoUploadError('PHOTO_FORMAT', 'This file is not a readable JPG/JPEG, PNG, WebP, or HEIC/HEIF image. Choose another photo.');
  }
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  let sourceBlob: Blob = new Blob([stableBytes.buffer], { type: format });
  if (format === 'image/heic') {
    try {
      const { heicTo } = await import('heic-to');
      sourceBlob = await heicTo({ blob: sourceBlob, type: 'image/jpeg', quality: 0.9 });
      format = 'image/jpeg';
    } catch {
      throw new PhotoUploadError('PHOTO_HEIC_CONVERT', 'This HEIC/HEIF photo could not be converted on this device. Save or export it as a JPEG and try again.');
    }
  }
  const decodedFile = new File([sourceBlob], file.name, { type: format, lastModified: file.lastModified });
  let bitmap: ImageBitmap | undefined;
  let image: HTMLImageElement | undefined;
  let url: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(decodedFile);
      } catch {
        // Safari and older mobile browsers can decode the same supported file
        // through an image element even when createImageBitmap is unavailable.
      }
    }
    if (!bitmap) {
      url = URL.createObjectURL(decodedFile);
      image = new Image();
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new PhotoUploadError('PHOTO_DECODE_TIMEOUT', 'This picture took too long to open. Choose another photo.')), 20_000);
        image!.onload = () => resolve();
        image!.onerror = () => reject(new PhotoUploadError('PHOTO_DECODE', 'This photo couldn’t be opened. Choose a readable JPG/JPEG, PNG, WebP, or HEIC/HEIF picture.'));
        image!.src = url!;
      });
    }
    const source = bitmap ?? image!;
    const sourceWidth = bitmap?.width ?? image!.naturalWidth;
    const sourceHeight = bitmap?.height ?? image!.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new PhotoUploadError('PHOTO_DECODE', 'This photo couldn’t be opened. Choose a readable JPG/JPEG, PNG, WebP, or HEIC/HEIF picture.');
    const canvas = document.createElement('canvas');
    const dimensions = photoDimensions(sourceWidth, sourceHeight);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoUploadError('PHOTO_PREPARE', 'Your browser couldn’t prepare this picture. Try another photo or reopen this screen.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new PhotoUploadError('PHOTO_PREPARE', 'This picture could not be prepared. Choose another photo.')), 'image/jpeg', .85);
    });
    return new File([blob], 'profile-photo.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    if (timer) clearTimeout(timer);
    bitmap?.close();
    if (url) URL.revokeObjectURL(url);
  }
}

type UploadOptions = {
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  onAttempt?: (attempt: number) => void;
  timeoutMs?: number;
};

/** Repeating a PUT to the same signed object is safe; do not create extra assets. */
export async function uploadProfilePhotoBytes(url: string, file: Blob, options: UploadOptions = {}): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= 3; attempt++) {
    options.onAttempt?.(attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
    let retry = true;
    let failure: PhotoUploadError;
    try {
      const response = await fetcher(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file, signal: controller.signal });
      if (response.ok) return;
      retry = response.status === 408 || response.status === 429 || response.status >= 500;
      failure = response.status === 401 || response.status === 403
        ? new PhotoUploadError('PHOTO_PERMISSION', 'The photo upload link was rejected or expired. Retry the upload to get a new link.', response.status)
        : new PhotoUploadError('PHOTO_STORAGE', 'The photo service couldn’t accept your upload. Retry the upload or choose another picture.', response.status);
    } catch {
      failure = controller.signal.aborted
        ? new PhotoUploadError('PHOTO_TIMEOUT', 'Your photo upload timed out. Check your connection, then retry the upload.')
        : new PhotoUploadError('PHOTO_NETWORK', 'Your browser couldn’t reach photo storage. Check your connection, then retry the upload. Your form is still here.');
    } finally {
      clearTimeout(timer);
    }
    if (!retry || attempt === 3) throw failure;
    await wait(attempt * 800);
  }
}
