import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const web = source('../src/components/social-hub.tsx');
const app = source('../src/App.tsx');
const native = source('../../vibeswipe/components/SocialHub.tsx');
const activity = web.slice(web.indexOf('export function ActivityOverview'), web.indexOf('export function InboundPeoplePage'));
const inbound = web.slice(web.indexOf('export function InboundPeoplePage'), web.indexOf('export function MutualMatchesPage'));
const matches = web.slice(web.indexOf('export function MutualMatchesPage'));

test('Activity excludes chat-message notices and places its four summary cards first', () => {
  assert.doesNotMatch(activity, /new_message|sent you a message|button-message-notice/);
  assert.match(activity, /new_follow/);
  assert.match(activity, /new_super_like/);
  for (const path of ['/matches', '/likes', '/views']) assert.ok(activity.includes(`'${path}'`));
  assert.ok(activity.indexOf('aria-label="Summary"') < activity.indexOf('aria-label="New followers"'));
  assert.doesNotMatch(activity, /lastMessage|\/chat\//);
});

test('native Activity excludes chat-message notices and places its four summary cards first', () => {
  assert.doesNotMatch(native, /new_message|sent you a message|button-message-notice/);
  assert.match(native, /new_follow/);
  assert.match(native, /new_super_like/);
  assert.ok(native.indexOf('testID="activity-summary"') < native.indexOf('testID={`follow-notice-'));
  const tabs = source('../../vibeswipe/app/(tabs)/_layout.tsx');
  assert.match(tabs, /messageBadge = counts\?\.messages/);
  assert.match(tabs, /NativeTabs\.Trigger\.Label>Chats/);
});

test('Likes and Views use their dedicated real data and expose profile viewing, not chat', () => {
  assert.match(inbound, /useGetWhoLikedYou/);
  assert.match(inbound, /useGetWhoViewedYou/);
  assert.match(inbound, /enabled: isLikes/);
  assert.match(inbound, /enabled: !isLikes/);
  assert.match(inbound, /Liked you/);
  assert.match(inbound, /Viewed your profile/);
  assert.match(inbound, /readNotice\(r\.profile\.id/);
  assert.doesNotMatch(inbound, /new_message|sent you a message|button-message-notice/);
});

test('Matches shows only real unblocked mutual matches and no message previews', () => {
  assert.match(web, /filter\(x => !x\.profile\.isDemo && !x\.blockedByMe && !x\.blockedMe\)/);
  assert.match(matches, /activeMatches\(matches\.data\)/);
  assert.match(matches, /\/chat\/\$\{m\.id\}\?returnTo=%2Fmatches/);
  assert.doesNotMatch(matches, /lastMessage|useSendMessage|icebreaker/);
});

test('separate Likes and Views pages retain the Activity highlight without extra bottom tabs', () => {
  assert.match(app, /const activeLocation = \['\/matches', '\/views', '\/likes'\]\.includes\(location\) \? '\/notifications' : isReelsViewer \? '\/reels' : location/);
  assert.match(app, /path="\/likes" component=\{LikesRoute\}/);
  assert.match(app, /<ActivityOverview avatar=/);
  assert.match(app, /<MutualMatchesPage avatar=/);
  assert.doesNotMatch(app, /label: '(Likes|Views)'/);
});

test('native Activity uses a nested stack so Likes and Views return through Activity', () => {
  const layout = source('../../vibeswipe/app/(tabs)/activity/_layout.tsx');
  assert.match(layout, /<Stack screenOptions=\{\{ headerShown: false \}\}/);
  assert.match(source('../../vibeswipe/app/(tabs)/activity/likes.tsx'), /<InboundPeoplePage kind="likes"/);
  assert.match(source('../../vibeswipe/app/(tabs)/activity/views.tsx'), /<InboundPeoplePage kind="views"/);
  assert.match(source('../../vibeswipe/app/(tabs)/activity/index.tsx'), /ActivityOverview as default/);
  assert.match(source('../../vibeswipe/app/(tabs)/matches.tsx'), /MutualMatchesPage as default/);
  assert.doesNotMatch(native, /new_message|sent you a message|button-message-notice/);
});

test('native bottom navigation remains exactly the five selected tabs', () => {
  const tabs = source('../../vibeswipe/app/(tabs)/_layout.tsx');
  assert.deepEqual([...tabs.matchAll(/<NativeTabs\.Trigger\s+name="([^"]+)"([^>]*)>/g)]
    .filter(m => !/\bhidden\b/.test(m[2])).map(m => m[1]),
    ['index', 'matches', 'views', 'activity', 'profile']);
  assert.match(tabs, /title: 'Chats'/);
  assert.doesNotMatch(tabs, /title: 'Likes'|title: 'Views'/);
});
