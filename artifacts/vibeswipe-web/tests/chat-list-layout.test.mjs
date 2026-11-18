import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("web chat conversations use flat rows instead of separate cards", () => {
  const list = source.slice(source.indexOf('data-testid="section-active-chats"'), source.indexOf("function NotificationsPage()"));
  assert.match(list, /border-b border-border py-4/);
  assert.doesNotMatch(list, /msg-card[^"]*rounded-\[22px\]/);
  assert.match(list, /data-testid=\{`card-conversation-\$\{m\.id\}`\}/);
});
