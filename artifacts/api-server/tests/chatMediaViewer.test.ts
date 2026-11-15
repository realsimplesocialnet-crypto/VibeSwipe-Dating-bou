import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = new URL("../../../", import.meta.url);
const source = (file: string) => readFile(new URL(file, root), "utf8");

test("actual photo and video bubble rendering exposes only local preview bytes, never the original URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "myage-chat-media-"));
  try {
    const output = join(directory, "preview.cjs");
    await build({
      stdin: {
        contents: `
          import React from "react";
          import {renderToStaticMarkup} from "react-dom/server";
          import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
          import {ChatMediaMessage} from "./src/components/chat-media-message.tsx";
          export const markup = type => { const client = new QueryClient({defaultOptions:{queries:{gcTime:Infinity,retry:false}}}); try { return renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(ChatMediaMessage,{
            reference:"media:private-media-id", fullUrl:"https://private.invalid/full-original", type
          }))); } finally { client.clear(); } };
        `,
        resolveDir: new URL("artifacts/vibeswipe-web/", root).pathname,
      },
      bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile: output,
      define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
      // One React instance for react-dom/server, React Query and the component.
      alias: { react: new URL("artifacts/vibeswipe-web/node_modules/react", root).pathname, "react-dom": new URL("artifacts/vibeswipe-web/node_modules/react-dom", root).pathname, "@tanstack/react-query": new URL("artifacts/vibeswipe-web/node_modules/@tanstack/react-query", root).pathname },
    });
    const { markup } = (await import(pathToFileURL(output).href)).default;
    for (const type of ["image", "video"]) {
      const html = markup(type);
      assert.match(html, /data-testid="chat-media-preview"/);
      assert.match(html, /Loading preview/);
      assert.doesNotMatch(html, /private\.invalid|private-media-id|<video|role="dialog"/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("web viewer gates the authenticated media component behind the explicit Load action", async () => {
  const component = await source("artifacts/vibeswipe-web/src/components/chat-media-message.tsx");
  assert.match(component, /loaded \? <LoadedMedia/);
  assert.equal((component.match(/setLoaded\(true\)/g) ?? []).length, 1);
  assert.match(component, /data-testid="button-load-chat-media" onClick=\{\(\) => setLoaded\(true\)\}/);
  assert.match(component, /function close\(\) \{ setOpen\(false\); setLoaded\(false\); \}/);
  assert.match(component, /useGetProfileMedia\(id/);
  assert.match(component, /URL.revokeObjectURL\(url\)/);
  assert.match(component, /onClick=\{show\}/);
  assert.match(component, /onTouchEnd=/);
  assert.match(component, /!start.moved/);
  assert.match(component, /event.preventDefault\(\); event.stopPropagation\(\); show\(\)/);
});

test("native media refreshes authorization only after Load and cancels a pending load when closed", async () => {
  const component = await source("artifacts/vibeswipe/components/ChatMediaMessage.tsx");
  assert.match(component, /loaded \? type === "image"/);
  assert.equal((component.match(/setLoaded\(true\)/g) ?? []).length, 1);
  assert.match(component, /const freshToken = await getToken\(\)/);
  assert.match(component, /if \(request !== generation.current\) return/);
  assert.match(component, /function close\(\) \{ generation.current\+\+/);
  assert.match(component, /profileImageSource\(reference, token\)/);
  assert.match(component, /presentationStyle="fullScreen" onRequestClose=\{close\}/);
  assert.match(component, /accessibilityLabel="Close media"/);
});

test("both chat message lists gate pictures/videos while keeping dedicated audio controls", async () => {
  const [web, native, audio] = await Promise.all([
    source("artifacts/vibeswipe-web/src/App.tsx"),
    source("artifacts/vibeswipe/app/chat/[matchId].tsx"),
    source("artifacts/vibeswipe-web/src/components/chat-audio-message.tsx"),
  ]);
  const bubble = await source("artifacts/vibeswipe-web/src/components/chat-message-bubble.tsx");
  assert.match(web, /<ChatMessageBubble key=\{m.id\}/);
  assert.match(bubble, /<ChatMediaMessage reference=\{message.mediaReference!\}/);
  assert.doesNotMatch(web, /<MediaImage reference=\{m.mediaReference\}/);
  assert.doesNotMatch(web, /<video controls src=\{mediaUrl\(m.mediaReference\)\}/);
  assert.match(bubble, /<ChatAudioMessage url=\{mediaUrl\(message.mediaReference!\)\}/);
  assert.match(audio, /<audio ref=\{player\} data-voice-note preload="none"/);
  const media = await source("artifacts/vibeswipe-web/src/components/chat-media-message.tsx");
  assert.match(media, /useGetMediaPreview\(id/);
  assert.match(native, /<ChatMediaMessage reference=\{item.mediaReference!\}/);
  assert.match(native, /<ChatAudioMessage reference=/);
  assert.doesNotMatch(native, /setViewingMedia|styles.imagePreview/);
});
