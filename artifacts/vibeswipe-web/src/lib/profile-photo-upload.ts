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

export function validatePhotoFile(file: Pick<File, 'size' | 'type' | 'name'>): void {
  if (file.size < 1) throw new PhotoUploadError('PHOTO_EMPTY', 'This photo is empty. Choose another picture.');
  if (file.size > 15 * 1024 * 1024) throw new PhotoUploadError('PHOTO_SIZE', 'Choose a photo smaller than 15 MB.');
  const imageType = /^image\/(jpeg|jpg|png|webp|heic|heif|gif|avif)$/i.test(file.type);
  const imageName = /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name);
  if (!imageType && !(!file.type && imageName)) {
    throw new PhotoUploadError('PHOTO_TYPE', 'Choose a JPEG, PNG, WebP, or another supported picture—not a video or document.');
  }
}

export function photoDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function photoUploadCanRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string') return true;
  return !/^PHOTO_(TYPE|EMPTY|SIZE|DECODE)$/.test(error.code);
}

/** Decode locally and resize phone-camera files before sending any bytes. */
export async function prepareProfilePhoto(file: File): Promise<File> {
  validatePhotoFile(file);
  const url = URL.createObjectURL(file);
  const image = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new PhotoUploadError('PHOTO_DECODE_TIMEOUT', 'This picture took too long to open. Choose another photo.')), 20_000);
      image.onload = () => resolve();
      image.onerror = () => reject(new PhotoUploadError('PHOTO_DECODE', 'Your browser couldn’t open this photo. Choose a JPEG or PNG picture.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new PhotoUploadError('PHOTO_DECODE', 'This picture could not be read. Choose another photo.');
    const canvas = document.createElement('canvas');
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoUploadError('PHOTO_PREPARE', 'Your browser couldn’t prepare this picture. Try another photo or reopen this screen.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new PhotoUploadError('PHOTO_PREPARE', 'This picture could not be prepared. Choose another photo.')), 'image/jpeg', .85);
    });
    return new File([blob], 'profile-photo.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    if (timer) clearTimeout(timer);
    URL.revokeObjectURL(url);
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
