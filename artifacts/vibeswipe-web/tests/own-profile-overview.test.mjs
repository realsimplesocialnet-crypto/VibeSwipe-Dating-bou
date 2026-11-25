import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const profilePage = read('../src/components/profile-page.tsx');
const start = profilePage.indexOf('function OwnProfileOverview(');
const overview = profilePage.slice(start, profilePage.indexOf('\nfunction ', start + 1));
const native = read('../../vibeswipe/app/(tabs)/profile.tsx');
const css = read('../src/index.css');

test('My Profile omits the branding header rather than leaving an empty logo row', () => {
  const shell = app.slice(app.indexOf('function AppShell('), app.indexOf('function Gate('));
  assert.doesNotMatch(shell, /<header\b|<Brand\b|vibe<span/);
  assert.doesNotMatch(overview, /<Brand\b|vibe<span/);
});

test('branding is absent from signed-in screens while public welcome and sign-in keep it', () => {
  const discover = read('../src/components/discover-swipe-page.tsx');
  assert.doesNotMatch(discover, /icon\.png|>vibe<span/);
  for (const path of ['../../vibeswipe/components/SocialHub.tsx', '../../vibeswipe/components/NotificationsList.tsx', '../../vibeswipe/app/(tabs)/views.tsx']) {
    assert.doesNotMatch(read(path), />M<\/Text>|>vibe<Text/);
  }
  const loading = app.slice(app.indexOf('function RequiredProfile('), app.indexOf('function ShellPage('));
  assert.doesNotMatch(loading, /<Brand\b/);
  const admin = read('../src/components/admin/admin-shell.tsx');
  assert.doesNotMatch(admin.slice(admin.indexOf('export function AdminShell(')), /<AdminWordmark\b/);
  assert.match(app, /<Route path="\/sign-in\/\*\?">[\s\S]*?<Brand\/>/);
  assert.match(read('../../vibeswipe/components/OnboardingWelcome.tsx'), /styles\.wordmark/);
  assert.match(css, /\.app-shell:not\(\.discover-shell\):not\(\.profile-shell\) \{ padding-top:env\(safe-area-inset-top,0px\); \}/);
});

test('My Profile shows one main profile picture and the actual account details', () => {
  for (const field of ['profile.name', 'profile.age', 'profile.city', 'profile.bio', 'profile.occupation', 'profile.interests']) assert.ok(overview.includes(field), field);
  for (const field of ['user.name', 'user.age', 'user.city', 'user.bio', 'user.occupation', 'user.interests']) assert.ok(native.includes(field), field);
  assert.match(overview, /profile\.photos\?\.\[0\]/);
  assert.match(native, /<ProfileAvatar profile=\{user\}/);
  for (const source of [overview, native]) assert.doesNotMatch(source, /Monf Jou|Enjoying life, good music/);
});

test('My Profile retains separate working Settings and Edit Profile destinations', () => {
  assert.match(overview, /href="\/settings\?returnTo=%2Fprofile"/);
  assert.match(overview, /href="\/profile\/edit\?returnTo=%2Fprofile"/);
  assert.match(overview, /<Settings\b/);
  const editLink = overview.match(/<Link href="\/profile\/edit\?returnTo=%2Fprofile" data-testid="button-edit-profile"[^>]*>([\s\S]*?)<\/Link>/);
  assert.ok(editLink, 'Edit Profile link remains available');
  assert.match(editLink[0], /aria-label="Edit profile" title="Edit profile"/);
  assert.match(editLink[1], /<Pencil size=\{18\}\s+aria-hidden="true"\s*\/>/);
  assert.doesNotMatch(editLink[1], /Edit profile/i);
  assert.match(css, /\.own-profile \.op-edit \{[^}]*position:fixed;[^}]*width:68px;[^}]*height:68px;/s);
  assert.match(overview, /href="\/discover" data-testid="link-profile-back"/);
  assert.match(native, /router\.push\("\/settings"\)/);
  assert.match(native, /router\.push\("\/edit-profile"\)/);
  assert.match(native, /name="settings"/);
});

test('Profile bars blend into the background and reserve space rather than cover photos', () => {
  assert.match(app, /location==='\/profile'\?'profile-shell'/);
  assert.match(css, /\.app-shell\.profile-shell \{[^}]*bottom:0;[^}]*display:flex;[^}]*flex-direction:column;/s);
  assert.match(css, /\.app-shell\.profile-shell > nav \{[^}]*position:relative;[^}]*flex-shrink:0;[^}]*border:0;[^}]*background:transparent;/s);
  assert.match(css, /\.app-shell\.profile-shell > main \{[^}]*flex:1;[^}]*min-height:0;[^}]*padding-bottom:0;/s);
  assert.doesNotMatch(css, /\.own-profile\.op-fit \{[^}]*100dvh/);
  assert.match(css, /\.own-profile\.op-fit \{[^}]*padding-bottom:0;[^}]*container:own-profile \/ size;/s);
});

test('short profile screens keep the portrait, Reels and saved videos available', () => {
  assert.match(css, /@container own-profile \(max-height:620px\)/);
  assert.match(css, /@container own-profile \(max-height:500px\)/);
  assert.match(css, /@container own-profile \(max-height:620px\) \{[\s\S]*?\.op-hero-photo \{ aspect-ratio:16 \/ 9; max-height:220px;/);
  assert.match(overview, /<ProfileReelsSection[^>]*own/);
  assert.match(readFileSync(new URL('../src/components/profile-reels-section.tsx', import.meta.url), 'utf8'), /id: "saved"/);
  assert.doesNotMatch(overview, /op-ghost mt-3/);
  assert.doesNotMatch(overview, /profile-photo-strip|<h3 className="op-label">\{t\("Photos"\)\}/);
  assert.match(overview, /data-testid="profile-main-photo"/);
  assert.match(overview, /main profile photo/);
  assert.match(overview, /About me/);
  assert.match(overview, /<MapPin size=\{16\}/);
  assert.match(app, /onProfile \? \(lightMode \? "#fde4ec" : "#3a2232"\)/);
});

test('profile editors offer one round profile picture and replace it instead of adding a gallery', () => {
  const editor = read('../src/components/profile-page.tsx');
  const nativeEditor = read('../../vibeswipe/app/edit-profile.tsx');
  const nativePicker = read('../../vibeswipe/components/MediaPicker.tsx');
  assert.match(editor, /data-testid="profile-edit-main-photo"/);
  assert.match(editor, /Change profile picture/);
  assert.match(editor, /form\.photos\[0\] \? "1\/1" : "0\/1"/);
  assert.doesNotMatch(editor, /Add up to 6 photos|Array\.from\(\{ length: 6 \}/);
  assert.match(nativeEditor, /maxPhotos=\{1\}/);
  assert.match(nativeEditor, /replaceSinglePhoto/);
  assert.match(nativePicker, /uploadedReferences\.slice\(0, 1\)/);
});

test('own profile sections use a continuous surface and retain the media grid', () => {
  assert.match(css, /\.own-profile \.op-card \{ background:transparent; box-shadow:none; border:0; \}/);
  assert.match(css, /\.own-profile \.op-section \{ background:transparent; border:0; border-radius:0; padding:0; box-shadow:none; \}/);
  assert.match(css, /\.own-profile \.sh-profile-social-compact \.sh-profile-stat \{[^}]*border:0;[^}]*background:transparent;/s);
  assert.match(css, /\.own-profile \.pp-media-tabs-list \{ border-bottom:0; \}/);
  assert.match(css, /\.own-profile \.pp-media-state \{[^}]*border:0;[^}]*background:transparent;/s);
  assert.match(css, /\.pp-reel-grid \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/);
  assert.doesNotMatch(overview, /profile-photo-strip/);
});
