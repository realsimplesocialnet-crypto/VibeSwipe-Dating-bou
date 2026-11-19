import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("web chat conversations use plain rows without divider lines or cards", () => {
  const list = source.slice(source.indexOf('data-testid="section-active-chats"'), source.indexOf("function NotificationsPage()"));
  assert.match(list, /className="space-y-0"/);
  assert.doesNotMatch(list, /border-b|msg-card|rounded-\[22px\]/);
  assert.match(list, /data-testid=\{`card-conversation-\$\{m\.id\}`\}/);
});

test("web chat opens at the latest message without a visible scroll animation", () => {
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /list\.scrollTop=list\.scrollHeight/);
  assert.match(source, /messageListRef=\{?useRef<HTMLDivElement>\(null\)/);
  assert.match(source, /onScroll=\{handleMessageListScroll\}[^>]*data-testid="chat-message-list"/);
  assert.match(source, /new ResizeObserver/);
});

test("sending a chat message does not blur the input before the tap submits", () => {
  assert.match(source, /<textarea ref=\{inputRef\}[^>]*data-testid="input-chat-message"/);
  assert.match(source, /function submitChatDraft\(\)\{[^}]*textSendInProgress\.current=true;void sendMessage\(draft\)/);
  assert.match(source, /<button type="submit" onMouseDown=\{event=>\{if\(document\.activeElement===inputRef\.current\)event\.preventDefault\(\)\}\} onTouchStart=\{event=>event\.preventDefault\(\)\} onTouchEnd=\{event=>\{event\.preventDefault\(\);submitChatDraft\(\)\}\}[^>]*data-testid="button-send-message"/);
  assert.match(source, /<form onSubmit=\{e=>\{e\.preventDefault\(\);submitChatDraft\(\)\}\}/);
});

test("explicit message actions focus the composer once without changing read-only chat entry", () => {
  const chatPage = source.slice(source.indexOf("function ChatPage"), source.indexOf("type MatchListExtras"));
  assert.match(chatPage, /autoFocusComposer=false/);
  assert.match(chatPage, /if\(!autoFocusComposer\|\|!chatReadyForAutofocus\|\|autoFocusConsumed\.current\)return/);
  assert.match(chatPage, /input\.focus\(\{preventScroll:true\}\)/);
  assert.match(chatPage, /url\.searchParams\.delete\('focusComposer'\)/);
  assert.match(source, /autoFocusComposer=\{query\.get\('focusComposer'\)==='1'\}/);

  // Profile Message, match celebrations, new-match cards and notification Send
  // Message buttons all explicitly invite composition.
  assert.match(source, /focusComposer:'1'/);
  assert.match(source, /returnTo=%2Fnotifications&focusComposer=1/);
  assert.match(source, /returnTo=%2Fmessages&focusComposer=1/);
  const discover = readFileSync(new URL("../src/components/discover-swipe-page.tsx", import.meta.url), "utf8");
  const socialHub = readFileSync(new URL("../src/components/social-hub.tsx", import.meta.url), "utf8");
  assert.match(discover, /returnTo=%2Fdiscover&focusComposer=1/);
  assert.match(socialHub, /returnTo=%2Flikes&focusComposer=1/);

  // Existing conversation links stay focused on reading message history.
  assert.match(source, /href=\{`\/chat\/\$\{m\.id\}\?returnTo=%2Fmessages`\} data-testid=\{`link-conversation-/);
});
