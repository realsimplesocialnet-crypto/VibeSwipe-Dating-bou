import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const start = app.indexOf('function OwnProfileOverview(');
const overview = app.slice(start, app.indexOf('\nfunction ', start + 1));
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

test('My Profile displays the actual account identity, interests and uploaded photos', () => {
  for (const field of ['profile.name', 'profile.age', 'profile.city', 'profile.bio', 'profile.occupation', 'profile.interests', 'profile.photos']) assert.ok(overview.includes(field), field);
  for (const field of ['user.name', 'user.age', 'user.city', 'user.bio', 'user.occupation', 'user.interests', 'user.photos']) assert.ok(native.includes(field), field);
  for (const source of [overview, native]) assert.doesNotMatch(source, /Monf Jou|Enjoying life, good music/);
});

test('My Profile retains separate working Settings and Edit Profile destinations', () => {
  assert.match(overview, /href="\/settings\?returnTo=%2Fprofile"/);
  assert.match(overview, /href="\/profile\/edit\?returnTo=%2Fprofile"/);
  assert.match(overview, /<Settings\b/);
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

test('short profile screens compact the portrait while keeping photos and saved videos available', () => {
  assert.match(css, /@container own-profile \(max-height:620px\)/);
  assert.match(css, /@container own-profile \(max-height:500px\)/);
  assert.match(css, /grid-template-columns:64px minmax\(0,1fr\)/);
  assert.match(overview, /<ProfileReelsSection[^>]*own/);
  assert.match(readFileSync(new URL('../src/components/profile-reels-section.tsx', import.meta.url), 'utf8'), /id: "saved"/);
  assert.doesNotMatch(overview, /op-ghost mt-3/);
  assert.match(overview, /data-testid="link-manage-photos"/);
  assert.match(overview, /profile\.photos\.slice\(0,6\)/);
  assert.match(app, /onProfile \? \(lightMode \? "#fde4ec" : "#3a2232"\)/);
});
