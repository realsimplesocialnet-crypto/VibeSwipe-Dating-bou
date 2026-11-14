import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { build } from "esbuild";

const route = readFileSync(new URL("../src/routes/vibeswipe.ts", import.meta.url), "utf8");
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the generated send request reaches the canonical server endpoint with the typed message", async () => {
  const compiled = await build({
    entryPoints: [new URL("../../../lib/api-client-react/src/generated/api.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const client = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
  const originalFetch = globalThis.fetch;
  const matchId = "123e4567-e89b-42d3-a456-426614174000";
  const message = { id: "message-test", matchId, senderId: "sender-test", content: "Hello from a new match", createdAt: new Date().toISOString(), isRead: false };
  let sent = false;
  globalThis.fetch = async (input, init) => {
    sent = true;
    assert.equal(String(input), `/api/vibeswipe/matches/${matchId}/messages`);
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { content: message.content });
    return new Response(JSON.stringify(message), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  try {
    assert.deepEqual(await client.sendMessage(matchId, { content: message.content }), message);
    assert.ok(sent);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached clients and current clients use the same protected send handler", () => {
  assert.match(route, /\["\/vibeswipe\/matches\/:matchId\/messages", "\/vibeswipe\/matches\/:matchId"\]/);
  const start = route.indexOf('// Keep cached website/PWA clients');
  const handler = route.slice(start, route.indexOf('\nrouter.delete(', start));
  assert.match(handler, /getMatchForUser/);
  assert.match(handler, /isBlockedBetween/);
  assert.match(handler, /\.insert\(messagesTable\)/);
  assert.match(handler, /pg_notify/);
  assert.match(handler, /status\(201\)/);
});

test("attachment-only sends omit empty text on both website and native", () => {
  const web = read("../../vibeswipe-web/src/App.tsx");
  const native = read("../../vibeswipe/app/chat/[matchId].tsx");
  assert.match(web, /content\.trim\(\)\?\{content:content\.trim\(\)\}:\{\}/);
  assert.match(native, /content\.trim\(\) \? \{ content: content\.trim\(\) \} : \{\}/);
});
