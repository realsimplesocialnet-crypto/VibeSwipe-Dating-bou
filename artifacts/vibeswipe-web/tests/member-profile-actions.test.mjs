import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const native = read('../../vibeswipe/app/profile/[profileId].tsx');
const member = app.slice(app.indexOf('function PublicProfile({'), app.indexOf('function WelcomeRoute('));

test('both member profiles expose real pass, like and Super Like actions with separate allowances', () => {
  for (const id of ['button-viewed-profile-pass', 'button-viewed-profile-like', 'button-viewed-profile-super-like']) assert.ok(member.includes(id));
  for (const id of ['public-profile-pass', 'public-profile-like', 'public-profile-super-like']) assert.ok(native.includes(id));
  for (const source of [member, native]) {
    assert.match(source, /useGetSuperLikeStatus/);
    assert.match(source, /useGetDailyLikeStatus/);
    assert.match(source, /reaction\.mutateAsync/);
    assert.match(source, /1500/);
    assert.doesNotMatch(source, /Monry John|New York, NY|Born July/);
  }
});

test('real gallery and age-privacy handling remain on member profiles', () => {
  for (const source of [member, native]) {
    assert.match(source, /showAge/);
    assert.match(source, /photos\[0\]/);
    assert.match(source, /public-profile-photo-viewer/);
  }
});

test('the shared match celebration is used on both Discover and member profiles', () => {
  for (const source of [member, native, read('../src/components/discover-swipe-page.tsx'), read('../../vibeswipe/app/(tabs)/index.tsx')]) {
    assert.match(source, /<MatchCelebration/);
    assert.match(source, /canMessage=/);
    assert.match(source, /onKeepSwiping=/);
  }
  for (const source of [read('../src/components/match-celebration.tsx'), read('../../vibeswipe/components/MatchCelebration.tsx')]) {
    assert.match(source, /Send a message/);
    assert.match(source, /Keep swiping/);
    assert.match(source, /canMessage/);
    assert.doesNotMatch(source, /Monry John/);
  }
});

test('Super Like has a separate Activity notice and is distinguished in incoming Likes', () => {
  for (const source of [read('../src/components/social-hub.tsx'), read('../../vibeswipe/components/SocialHub.tsx')]) {
    assert.match(source, /new_super_like/);
    assert.match(source, /Super Liked you/);
    assert.match(source, /super-like-notice-/);
    assert.match(source, /isSuperLike/);
  }
});

test('Edit Profile retains real photo controls and the existing save mutation', () => {
  const editor = app.slice(app.indexOf('function ProfilePage('), app.indexOf('function OwnProfileFrame('));
  for (const text of ['Main photo', 'button-remove-profile-photo-', 'button-add-profile-photo-slot-', 'button-save-profile', 'form.photos.length', 'useSaveMyProfile']) assert.ok(editor.includes(text), text);
  for (const text of ['photoPreviews', 'URL.createObjectURL(prepared)', 'fallbackSrc={photoPreviews[photo]}', 'New photos are kept after you tap Save profile']) assert.ok(editor.includes(text), text);
  const nativeEditor = read('../../vibeswipe/app/edit-profile.tsx');
  const picker = read('../../vibeswipe/components/MediaPicker.tsx');
  assert.match(nativeEditor, /variant="grid"/);
  assert.match(nativeEditor, /edit-profile-save/);
  assert.match(nativeEditor, /useSaveMyProfile/);
  for (const text of ['Main photo', 'removePhoto', 'add-profile-photo-slot-']) assert.ok(picker.includes(text), text);
});
