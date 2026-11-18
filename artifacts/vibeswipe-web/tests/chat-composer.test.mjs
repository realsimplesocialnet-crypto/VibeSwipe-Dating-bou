// Source-contract regressions for controls that must never auto-send a message.
// These complement compilation; they do not replace signed-in device tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchChatsByPersonName } from '../src/lib/chat-search.ts';

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

test('Chats stays the conversation tab while Views opens separately under Activity', () => {
  assert.match(web, /href: '\/messages', label: 'Chats', icon: Inbox/);
  assert.doesNotMatch(web, /label: 'Views'/);
  assert.match(web, /function ViewsRoute\(\).*<InboundPeoplePage kind="views"/);
  assert.doesNotMatch(web, /link-matches-messages|link-messages-back/);
});

test('chat search prioritizes an exact person name over other partial name matches', () => {
  const chats = [
    { profile: { name: 'Monday John' } },
    { profile: { name: 'Monday' } },
    { profile: { name: 'John Monday' } },
  ];
  assert.deepEqual(searchChatsByPersonName(chats, ' monday '), [chats[1]]);
  assert.deepEqual(searchChatsByPersonName(chats, 'john'), [chats[0], chats[2]]);
});

test('website Chats uses real match data, excludes demo and blocked profiles, and renders unread counts', () => {
  const messages = web.slice(web.indexOf('function ChatsPage()'), web.indexOf('function NotificationsPage()'));
  assert.match(messages, /useGetMatches/);
  assert.match(messages, /!m\.profile\.isDemo&&!m\.blockedByMe&&!m\.blockedMe/);
  assert.doesNotMatch(messages, /useGetDiscoverProfiles|useGetWhoViewedYou/);
  assert.match(messages, /data-testid="input-search-chats"/);
  assert.match(messages, /searchChatsByPersonName\(list, search\)/);
  assert.match(messages, /filter === 'unread'/);
  assert.match(messages, /filter === 'new'/);
  assert.match(messages, /href="\/stories\/new\?returnTo=%2Fmessages"[^>]+data-testid="button-create-story-from-chats"/);
  assert.match(messages, /data-testid="chats-header"/);
  assert.match(messages, /<h1[^>]*>Chats<\/h1>/);
  assert.match(messages, /extras\.unreadCount!>99\?'99\+':extras\.unreadCount/);
  assert.match(messages, /returnTo=%2Fmessages/);
});

test('story composer returns to its entry screen when canceled or after posting', () => {
  const stories = readFileSync(new URL('../src/components/stories/stories-ui.tsx', import.meta.url), 'utf8');
  const composer = stories.slice(stories.indexOf('export function StoryComposerPage('));
  assert.match(web, /function StoryComposerRoute\(\)\{const returnTo=safeAppReturnPath\(new URLSearchParams\(window\.location\.search\)\.get\('returnTo'\),'\/discover'\);return <ShellPage><StoryComposerPage returnTo=\{returnTo\}\/><\/ShellPage>\}/);
  assert.match(composer, /onClick=\{\(\) => setLocation\(returnTo\)\} aria-label="Back"/);
  assert.match(composer, /window\.setTimeout\(\(\) => setLocation\(returnTo\), 700\)/);
  assert.doesNotMatch(composer, /setLocation\("\/discover"\)/);
});

test('story composer keeps media preview compact and prevents phone-width overflow', () => {
  const stories = readFileSync(new URL('../src/components/stories/stories-ui.tsx', import.meta.url), 'utf8');
  const composer = stories.slice(stories.indexOf('export function StoryComposerPage('));
  assert.match(composer, /overflow-x-hidden/);
  assert.match(composer, /story-media-preview relative mx-auto flex h-\[min\(34dvh,300px\)\] min-h-\[220px\] w-full max-w-\[360px\]/);
  assert.match(composer, /max-h-\[280px\] max-w-full object-contain md:max-h-\[390px\]/);
  assert.match(composer, /flex min-w-0 items-center justify-between gap-3/);
  assert.match(composer, /min-w-0 flex-1 truncate/);
});

test('native old Messages links redirect to the one tab instead of rendering a duplicate list', () => {
  const messages = readFileSync(new URL('../../vibeswipe/app/messages.tsx', import.meta.url), 'utf8');
  assert.match(messages, /<Redirect href="\/\(tabs\)\/views" \/>/);
  assert.doesNotMatch(messages, /<ChatsScreen/);
  const tabs = readFileSync(new URL('../../vibeswipe/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<NativeTabs\.Trigger\.Label>Chats<\/NativeTabs\.Trigger\.Label>/);
  assert.doesNotMatch(tabs, /title: 'Views'|<NativeTabs\.Trigger\.Label>Views</);
});

test('native Chats shows only real unblocked matches and uses the real unread badge count', () => {
  const messages = readFileSync(new URL('../../vibeswipe/app/(tabs)/views.tsx', import.meta.url), 'utf8');
  assert.match(messages, /export default function ChatsScreen/);
  assert.match(messages, /!m\.profile\.isDemo && !m\.blockedByMe && !m\.blockedMe/);
  assert.match(messages, /testID="input-search-chats"/);
  assert.match(messages, /profile\.name\.trim\(\)\.toLocaleLowerCase\(\) === query/);
  assert.match(messages, /filter === "unread"/);
  assert.match(messages, /filter === "new"/);
  assert.match(messages, /item\.unreadCount! > 99 \? "99\+" : item\.unreadCount/);
});
