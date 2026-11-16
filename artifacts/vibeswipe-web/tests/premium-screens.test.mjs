import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const likes = read('../src/components/social-hub.tsx');
const styles = read('../src/index.css');
const socialStyles = read('../src/components/social-hub.css');

test('web Likes uses the approved charcoal and gold palette and empty state', () => {
  assert.match(styles, /background:#0F0F12/);
  assert.match(socialStyles, /background:#1A1A1E/);
  assert.match(styles, /color:#C4A574/);
  assert.match(likes, /No new likes yet\./);
  assert.match(likes, /Keep swiping!/);
  assert.match(likes, /returnTo=\$\{rt\}/);
});

test('profiles opened from Likes show a large photo and Like Back without Super Like', () => {
  const member = app.slice(app.indexOf('function PublicProfile({'), app.indexOf('function WelcomeRoute('));
  assert.match(member, /const fromLikes=actionReturnTo==='\/likes'/);
  assert.match(member, /pp-avatar-hero/);
  assert.match(member, /fromLikes\?'Like Back':'Like to match'/);
  assert.match(member, /\{!fromLikes&&<button[^]*button-viewed-profile-super-like/);
});

test('My Profile uses gold accents and retains the verified badge', () => {
  assert.match(app, /<VerifiedBadge verified=\{profile\.isVerified\}/);
  assert.match(app, /bg-\[#C4A574\].*Main/);
  assert.match(styles, /--primary:41 41% 62%/);
});
