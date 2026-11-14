import assert from 'node:assert/strict';
import test from 'node:test';
import { photoDimensions, uploadProfilePhotoBytes, validatePhotoFile } from '../src/lib/profile-photo-upload.ts';
import { userErrorMessage } from '../src/lib/user-errors.ts';

test('photo validation rejects empty, oversize and non-picture files', () => {
  assert.throws(() => validatePhotoFile({ size: 0, type: 'image/jpeg', name: 'photo.jpg' }), /empty/);
  assert.throws(() => validatePhotoFile({ size: 16 * 1024 * 1024, type: 'image/jpeg', name: 'photo.jpg' }), /15 MB/);
  assert.throws(() => validatePhotoFile({ size: 200, type: 'video/mp4', name: 'movie.mp4' }), /not a video/);
  assert.doesNotThrow(() => validatePhotoFile({ size: 200, type: '', name: 'photo.JPG' }));
});

test('phone pictures keep their aspect ratio without upscaling', () => {
  assert.deepEqual(photoDimensions(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(photoDimensions(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(photoDimensions(400, 500), { width: 400, height: 500 });
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

test('public errors explain recovery without exposing internal API responses', () => {
  assert.match(userErrorMessage({ status: 401 }, 'Fallback'), /Sign in again/);
  assert.match(userErrorMessage({ status: 429 }, 'Fallback'), /Wait a moment/);
  assert.match(userErrorMessage({ status: 500, data: { error: 'SQL database secret' } }, 'Fallback'), /try again shortly/);
  assert.equal(userErrorMessage(new Error('private internal error'), 'Safe fallback'), 'Safe fallback');
});
