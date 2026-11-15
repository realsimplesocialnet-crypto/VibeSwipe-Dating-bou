import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('../src/components/admin/chat-drawer.tsx', import.meta.url), 'utf8');
const chats = readFileSync(new URL('../src/components/admin/sections/chats.tsx', import.meta.url), 'utf8');

test('conversation contents are not requested until explicit admin acknowledgement', () => {
  assert.match(drawer, /const \[openedChatId, setOpenedChatId\] = useState\(''\)/);
  assert.match(drawer, /const opened = openedChatId === chatId/);
  assert.match(drawer, /enabled: opened/);
  assert.match(drawer, /onClick=\{\(\) => setOpenedChatId\(chatId\)\}[^>]*data-testid="button-acknowledge-chat-access"/);
  assert.match(drawer, /\{!opened \? <section/);
});

test('the pre-access notice explains restricted and logged admin access', () => {
  const notice = drawer.slice(drawer.indexOf('data-testid="chat-access-notice"'), drawer.indexOf('</section>'));
  assert.match(notice, /Restricted admin access/);
  assert.match(notice, /Conversation contents and attachments are private/);
  assert.match(notice, /admin access is logged/);
  assert.match(notice, /I understand, open conversation/);
});

test('chat list does not preview message content', () => {
  assert.doesNotMatch(chats, /c\.lastMessage\b/);
  assert.match(chats, /c\.userAName/);
  assert.match(chats, /c\.userBName/);
  assert.match(chats, /c\.messageCount/);
  assert.match(chats, /c\.lastMessageAt/);
  assert.match(chats, /latest activity only/);
});

test('exports and media controls remain inside the explicitly opened conversation view', () => {
  assert.match(drawer, /if \(!opened\) return;/);
  assert.match(drawer, /const media = useAdminObjectUrl\(id, show && !!id\)/);
  assert.match(drawer, /<audio src=\{media\.url\} controls/);
});
