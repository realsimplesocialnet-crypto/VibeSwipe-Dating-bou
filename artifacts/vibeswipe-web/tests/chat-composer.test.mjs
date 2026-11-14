// Source-contract regressions for controls that must never auto-send a message.
// These complement compilation; they do not replace signed-in device tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const web = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const native = readFileSync(new URL('../../vibeswipe/app/chat/[matchId].tsx', import.meta.url), 'utf8');

test('website question selection only updates and focuses the draft', () => {
  const handler = web.slice(web.indexOf('function applySuggestion('), web.indexOf('return <div className={`chat-surface'));
  assert.match(handler, /setDraft\(question\)/);
  assert.match(handler, /\.focus\(\)/);
  assert.doesNotMatch(handler, /sendMessage\(|mutate(?:Async)?\(/);
  assert.match(web, /onClick=\{\(\)=>applySuggestion\(i\.question\)\}/);
});

test('native question selection does not send until the Send button is pressed', () => {
  const card = native.slice(native.indexOf('testID={`chat-suggestion-${index}`}'));
  const handler = card.slice(0, card.indexOf('</Pressable>'));
  assert.match(handler, /setDraft\(prompt\.question\)/);
  assert.match(handler, /inputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(handler, /\bsend\(|mutate(?:Async)?\(/);
  assert.match(native, /testID="send-chat-message"[^>]+onPress=\{\(\) => void send\(draft\)\}/);
});

test('the website header opens the real match profile and retains its conversation return path', () => {
  assert.match(web, /const profileHref=`\/profile\/\$\{match\.profile\.id\}\?returnTo=\$\{encodeURIComponent\(selfPath\)\}`/);
  assert.match(web, /<Link href=\{profileHref\}[^>]+data-testid="link-chat-profile"/);
});

test('the native header opens the real match profile without sending anything', () => {
  const header = native.slice(native.indexOf('testID="chat-profile-header"'));
  const action = header.slice(0, header.indexOf('style={styles.headerProfile}'));
  assert.match(action, /pathname: "\/profile\/\[profileId\]"/);
  assert.match(action, /profileId: match\.profile\.id/);
  assert.doesNotMatch(action, /\bsend\(|mutate(?:Async)?\(/);
});

test('website visitor cards use real profiles and location, without view timestamps', () => {
  const visitors = web.slice(web.indexOf('function VisitorsPage()'), web.indexOf('function ViewsRoute()'));
  assert.match(visitors, /useGetWhoViewedYou/);
  assert.match(visitors, /profile\.name/);
  assert.match(visitors, /profile\.age/);
  assert.match(visitors, /profile\.city/);
  assert.doesNotMatch(visitors, /viewedAt|toLocaleString|toLocaleDateString|timeAgo/);
  assert.match(web, /function ViewsRoute\(\).*<VisitorsPage\/>/);
  assert.match(web, /href="\/messages" data-testid="link-matches-messages"/);
});

test('native visitor cards omit dates and Messages stays independently accessible', () => {
  const visitors = readFileSync(new URL('../../vibeswipe/app/(tabs)/views.tsx', import.meta.url), 'utf8');
  const section = visitors.slice(visitors.indexOf('export default function VisitorsScreen()'), visitors.indexOf('const visitorStyles'));
  assert.match(section, /profile\.city/);
  assert.match(section, /profile\.name/);
  assert.doesNotMatch(section, /viewedAt|toLocaleString|toLocaleDateString|formatTime/);
  const messages = readFileSync(new URL('../../vibeswipe/app/messages.tsx', import.meta.url), 'utf8');
  assert.match(messages, /<MessagesScreen \/>/);
  assert.match(messages, /Back to Matches/);
});
