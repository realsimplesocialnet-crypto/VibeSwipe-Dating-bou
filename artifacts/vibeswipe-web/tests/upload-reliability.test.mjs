import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PROFILE_PHOTO_ACCEPT, photoDimensions, photoUploadCanRetry, prepareProfilePhoto, readPhotoBytes, sniffPhotoFormat, uploadProfilePhotoBytes, validatePhotoFile, validatePreparedPhoto } from '../src/lib/profile-photo-upload.ts';
import { userErrorMessage } from '../src/lib/user-errors.ts';

test('photo picker accepts JPEG, JPG, PNG and WebP, including generic mobile MIME types', () => {
  assert.match(PROFILE_PHOTO_ACCEPT, /image\/jpeg/);
  assert.match(PROFILE_PHOTO_ACCEPT, /image\/png/);
  assert.match(PROFILE_PHOTO_ACCEPT, /image\/webp/);
  assert.match(PROFILE_PHOTO_ACCEPT, /\.jpg/);
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'image/jpeg', name: 'photo.jpeg' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'image/jpg', name: 'photo.jpg' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'image/png', name: 'photo.png' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'image/webp', name: 'photo.webp' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'application/octet-stream', name: 'photo.webp' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'application/x-android-uri', name: 'picker-file.jpg' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'application/octet-stream', name: 'IMG_1234' }));
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'image/heic', name: 'photo.heic' }));
});

test('photo validation checks size before inspecting the actual file bytes', () => {
  assert.throws(() => validatePhotoFile({ size: 0, type: 'image/jpeg', name: 'photo.jpg' }), /empty/);
  assert.throws(() => validatePhotoFile({ size: 16 * 1024 * 1024, type: 'image/jpeg', name: 'photo.jpg' }), /15 MB/);
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: 'application/x-android-uri', name: 'picker-file' }));
  assert.equal(sniffPhotoFormat(new Uint8Array([0, 1, 2, 3])), null);
});

test('photo format is detected from file bytes rather than trusting picker MIME metadata', () => {
  assert.equal(sniffPhotoFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(sniffPhotoFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffPhotoFormat(Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')])), 'image/webp');
  assert.equal(sniffPhotoFormat(Uint8Array.from([...Buffer.from([0, 0, 0, 24]), ...Buffer.from('ftyp'), ...Buffer.from('heic'), 0, 0, 0, 0])), 'image/heic');
  assert.equal(sniffPhotoFormat(Uint8Array.from([1, 2, 3, 4])), null);
});

test('photo picker reads Android-style streams when arrayBuffer is unavailable', async () => {
  const blob = new Blob(['phone photo bytes']);
  const file = {
    arrayBuffer: async () => { throw new Error('array buffer not available'); },
    stream: () => blob.stream(),
  };
  assert.equal(Buffer.from(await readPhotoBytes(file)).toString(), 'phone photo bytes');
});

test('photo picker uses FileReader when Android WebView File and stream reads fail', async () => {
  const originalFileReader = globalThis.FileReader;
  globalThis.FileReader = class {
    result = null;
    onload = null;
    onerror = null;
    onabort = null;
    readAsArrayBuffer() {
      this.result = new TextEncoder().encode('photo bytes from picker').buffer;
      this.onload?.();
    }
  };
  try {
    const file = {
      arrayBuffer: async () => new ArrayBuffer(0),
      stream: () => new ReadableStream({ start(controller) { controller.close(); } }),
    };
    assert.equal(Buffer.from(await readPhotoBytes(file)).toString(), 'photo bytes from picker');
  } finally {
    if (originalFileReader === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = originalFileReader;
  }
});

test('photo picker can prepare a previewable file through the image decoder when bytes are unavailable', async () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = globalThis.document?.createElement;
  const originalDocument = globalThis.document;
  let imageLoads = 0;
  URL.createObjectURL = () => `blob:picker-test-${imageLoads}`;
  URL.revokeObjectURL = () => {};
  globalThis.Image = class {
    naturalWidth = 900;
    naturalHeight = 1200;
    onload = null;
    onerror = null;
    set src(_value) { imageLoads++; queueMicrotask(() => this.onload?.()); }
  };
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect() {},
        drawImage() {},
      }),
      toBlob(callback) { callback(new Blob(['jpeg image bytes'], { type: 'image/jpeg' })); },
    }),
  };
  try {
    const files = Array.from({ length: 3 }, (_, index) => {
      const file = new File([`picker placeholder ${index}`], `slide-${index}.jpg`, { type: 'image/jpeg' });
      file.arrayBuffer = async () => new ArrayBuffer(0);
      file.stream = () => new ReadableStream({ start(controller) { controller.close(); } });
      return file;
    });
    const prepared = await Promise.all(files.map(prepareProfilePhoto));
    assert.equal(prepared.length, 3);
    assert.ok(prepared.every((photo) => photo.type === 'image/jpeg' && photo.name === 'profile-photo.jpg' && photo.size > 0));
    assert.equal(imageLoads, 6);
  } finally {
    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    if (originalDocument === undefined) delete globalThis.document;
    else {
      originalDocument.createElement = originalCreateElement;
      globalThis.document = originalDocument;
    }
  }
});

test('photo slides are prepared before preview and upload uses the prepared files', () => {
  const composer = readFileSync(new URL('../src/pages/reel-composer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /mapWithConcurrency\(candidates, 2, async \(photo, index\)[\s\S]*?prepareProfilePhoto\(photo\)/);
  assert.match(composer, /const urls = slideFiles\.map\(\(item\) => URL\.createObjectURL\(item\)\)/);
  assert.match(composer, /uploadProfileMediaBytes|uploadProfilePhotoBytes\(signed\.uploadURL, photo/);
  assert.match(composer, /slideFiles\.length !== 1/);
  assert.match(composer, /validatePreparedPhoto\(photo\)/);
});

test('post preflight rejects a broken photo and accepts a prepared JPEG', async () => {
  const validJpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], 'prepared.jpg', { type: 'image/jpeg' });
  const brokenPhoto = new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' });
  await assert.doesNotReject(validatePreparedPhoto(validJpeg));
  await assert.rejects(validatePreparedPhoto(brokenPhoto), (error) => error.code === 'PHOTO_FORMAT');
});

test('phone pictures keep their aspect ratio without upscaling', () => {
  assert.deepEqual(photoDimensions(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(photoDimensions(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(photoDimensions(400, 500), { width: 400, height: 500 });
});

test('photo retry is offered for recoverable failures, not bad files', () => {
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_NETWORK' }), true);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_PERMISSION' }), true);
  assert.equal(photoUploadCanRetry({ status: 503 }), true);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_TYPE' }), false);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_FORMAT' }), false);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_HEIC_CONVERT' }), false);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_DECODE' }), false);
  assert.equal(photoUploadCanRetry({ code: 'PHOTO_SIZE' }), false);
});

test('a temporary storage failure retries the same PUT and succeeds', async () => {
  const calls = [];
  const photo = new Blob(['picture'], { type: 'image/jpeg' });
  await uploadProfilePhotoBytes('https://example.com/object', photo, {
    wait: async () => {},
    fetcher: async (url, init) => { calls.push([url, init]); return new Response(null, { status: calls.length < 3 ? 503 : 200 }); },
  });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(([url, init]) => url === 'https://example.com/object' && init.body === photo && init.method === 'PUT'));
});

test('rejected signed links do not retry indefinitely or leak their URL', async () => {
  let calls = 0;
  await assert.rejects(uploadProfilePhotoBytes('https://example.com/object?secret=hidden', new Blob(), {
    wait: async () => {},
    fetcher: async () => { calls++; return new Response(null, { status: 403 }); },
  }), error => error.code === 'PHOTO_PERMISSION' && !error.message.includes('hidden'));
  assert.equal(calls, 1);
});

test('network failures retry only three times and give a useful message', async () => {
  let calls = 0;
  await assert.rejects(uploadProfilePhotoBytes('https://example.com/object', new Blob(), {
    wait: async () => {},
    fetcher: async () => { calls++; throw new TypeError('Failed to fetch'); },
  }), error => error.code === 'PHOTO_NETWORK' && /form is still here/.test(error.message));
  assert.equal(calls, 3);
});

test('photo upload cancellation stops retrying so signup can leave the photo step', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(uploadProfilePhotoBytes('https://example.com/object', new Blob(['picture']), {
    signal: controller.signal,
    wait: async () => {},
    fetcher: async (_url, init) => {
      calls++;
      controller.abort();
      assert.equal(init.signal.aborted, true);
      throw new DOMException('Aborted', 'AbortError');
    },
  }), error => error.code === 'PHOTO_CANCELLED');
  assert.equal(calls, 1);
});

test('public errors explain recovery without exposing internal API responses', () => {
  assert.match(userErrorMessage({ status: 401 }, 'Fallback'), /Sign in again/);
  assert.match(userErrorMessage({ status: 429 }, 'Fallback'), /Wait a moment/);
  assert.match(userErrorMessage({ status: 500, data: { error: 'SQL database secret' } }, 'Fallback'), /try again shortly/);
  assert.equal(userErrorMessage(new Error('private internal error'), 'Safe fallback'), 'Safe fallback');
});
