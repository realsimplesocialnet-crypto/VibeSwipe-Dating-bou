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

test('Messages stays the conversation tab while Views opens separately under Activity', () => {
  assert.match(web, /href: '\/messages', label: 'Messages', icon: MessageCircle/);
  assert.doesNotMatch(web, /label: 'Views'/);
  assert.match(web, /function ViewsRoute\(\).*<InboundPeoplePage kind="views"/);
  assert.doesNotMatch(web, /link-matches-messages|link-messages-back/);
});

test('website Messages uses real match data, excludes demo and blocked profiles, and renders unread counts', () => {
  const messages = web.slice(web.indexOf('function MessagesPage()'), web.indexOf('function NotificationsPage()'));
  assert.match(messages, /useGetMatches/);
  assert.match(messages, /!m\.profile\.isDemo&&!m\.blockedByMe&&!m\.blockedMe/);
  assert.doesNotMatch(messages, /useGetDiscoverProfiles|useGetWhoViewedYou/);
  assert.match(messages, /Only mutual matches appear here\./);
  assert.match(messages, /extras\.unreadCount!>99\?'99\+':extras\.unreadCount/);
  assert.match(messages, /returnTo=%2Fmessages/);
});

test('native old Messages links redirect to the one tab instead of rendering a duplicate list', () => {
  const messages = readFileSync(new URL('../../vibeswipe/app/messages.tsx', import.meta.url), 'utf8');
  assert.match(messages, /<Redirect href="\/\(tabs\)\/views" \/>/);
  assert.doesNotMatch(messages, /<MessagesScreen/);
  const tabs = readFileSync(new URL('../../vibeswipe/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<NativeTabs\.Trigger\.Label>Messages<\/NativeTabs\.Trigger\.Label>/);
  assert.doesNotMatch(tabs, /title: 'Views'|<NativeTabs\.Trigger\.Label>Views</);
});

test('native Messages shows only real unblocked matches and uses the real unread badge count', () => {
  const messages = readFileSync(new URL('../../vibeswipe/app/(tabs)/views.tsx', import.meta.url), 'utf8');
  assert.match(messages, /export default function MessagesScreen/);
  assert.match(messages, /!m\.profile\.isDemo && !m\.blockedByMe && !m\.blockedMe/);
  assert.match(messages, /Only mutual matches appear here\./);
  assert.match(messages, /item\.unreadCount! > 99 \? "99\+" : item\.unreadCount/);
});
