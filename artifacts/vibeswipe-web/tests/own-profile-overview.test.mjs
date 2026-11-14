import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const start = app.indexOf('function OwnProfileOverview(');
const overview = app.slice(start, app.indexOf('\nfunction ', start + 1));
const native = read('../../vibeswipe/app/(tabs)/profile.tsx');

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
