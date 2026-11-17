import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const native = read('../../vibeswipe/app/profile/[profileId].tsx');
const member = app.slice(app.indexOf('function PublicProfile({'), app.indexOf('function WelcomeRoute('));
const nativeChat = read('../../vibeswipe/app/chat/[matchId].tsx');
const apiIndex = read('../../api-server/src/index.ts');

test('member profiles preserve separate follow and dating actions', () => {
  assert.match(member, /<ProfileSocialActions[^>]*datingAction=\{datingAction\}/);
  const webActions = read('../src/components/social-hub.tsx');
  assert.match(webActions, /following \? 'Following' : followsYou \? 'Follow back' : 'Follow'/);
  assert.match(webActions, /\{datingAction\}/);
  assert.match(native, /testID=\{matchId \? "public-profile-message" : "public-profile-like"\}/);
  assert.match(native, /await reaction\.mutateAsync/);
  assert.match(native, /await unlike\.mutateAsync/);
  for (const source of [member, native]) assert.doesNotMatch(source, /Monry John|New York, NY|Born July/);
});

test('matched profiles replace swipe actions with a link to their existing chat', () => {
  assert.match(member, /profileMatch=matches\.data\?\.find/);
  assert.match(member, /datingAction/);
  assert.match(native, /profileMatch = matches\.data\?\.find/);
  assert.match(native, /public-profile-message/);
  assert.match(member, /profileMatch\?/);
  assert.match(native, /profileMatch\?\.blockedByMe/);
});

test('video calling controls and signaling are removed from both apps', () => {
  for (const source of [app, nativeChat]) {
    assert.doesNotMatch(source, /button-start-video-call|Start video call|useVideoCall/);
  }
  assert.doesNotMatch(apiIndex, /attachVideoCallSignaling/);
});

test('real gallery and age-privacy handling remain on member profiles', () => {
  for (const source of [member, native]) {
    assert.match(source, /showAge/);
    assert.match(source, /photos\[0\]/);
    assert.match(source, /public-profile-photo-viewer/);
  }
});

test('public profiles group identity and actions, compact details, and browse media in grids', () => {
  assert.match(member, /pp-identity-panel/);
  assert.match(member, /<ProfileSocialActions profileId=\{profile\.id\}/);
  assert.match(member, /pp-facts/);
  assert.match(member, /public-profile-gallery.*pp-gallery-grid/s);
  assert.match(member, /<ProfileReelsSection[^>]*layout="grid"/);
  assert.match(native, /styles\.identityPanel/);
  assert.match(native, /<ProfileFollowStats profileId=\{user\.id\}/);
  assert.match(native, /public-profile-photo-grid/);
  assert.match(native, /<ProfileReelsSection[^>]*layout="grid"/);
  const webReels = read('../src/components/profile-reels-section.tsx');
  const nativeReels = read('../../vibeswipe/components/ProfileReelsSection.tsx');
  const webStyles = read('../src/index.css');
  for (const source of [webReels, nativeReels]) {
    assert.match(source, /layout\?: "carousel" \| "grid"/);
    assert.match(source, /profile-reels-grid|profile-reels-grid/);
    assert.match(source, /button-load-more-profile-reels/);
  }
  assert.match(webStyles, /\.public-profile \.pp-reel-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(webReels, /layout = "carousel"/);
  assert.match(nativeReels, /layout = "carousel"/);
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
