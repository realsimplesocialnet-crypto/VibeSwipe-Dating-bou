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
