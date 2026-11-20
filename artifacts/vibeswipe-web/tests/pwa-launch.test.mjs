import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/pwa-launch.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));

async function boot({ production = true, firstFailure = false, base = "/" } = {}) {
  const calls = [];
  const events = new Map();
  let showRecovery;
  let reloads = 0;
  let updates = 0;
  const help = { hidden: true };
  const document = {
    currentScript: {
      src: `https://example.com${base}pwa-launch.js?v=9`,
      dataset: { production: String(production) },
    },
    getElementById(id) {
      if (id === "startup-help") return help;
      if (id === "startup-retry") return { addEventListener(name, fn) { events.set(`retry:${name}`, fn); } };
    },
  };
  const window = {
    location: { reload() { reloads++; } },
    setTimeout(fn) { showRecovery = fn; },
    addEventListener(name, fn) { events.set(name, fn); },
  };
  const navigator = {
    // Deliberately not a Chrome user agent: the launcher must not gate by brand.
    userAgent: "SamsungBrowser",
    serviceWorker: {
      async register(url, options) {
        calls.push({ url, options });
        if (firstFailure && calls.length === 1) throw new Error("offline");
        return { async update() { updates++; } };
      },
    },
  };
  window.navigator = navigator;
  vm.runInNewContext(source, { document, window, navigator, URL, console: { warn() {} } });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  return { calls, events, help, showRecovery: () => showRecovery(), reloads: () => reloads, updates: () => updates, flush };
}

test("worker registration does not depend on React, Chrome or the window load event", async () => {
  const app = await boot();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].url, "https://example.com/service-worker.js");
  assert.equal(app.calls[0].options.scope, "/");
  assert.equal(app.calls[0].options.updateViaCache, "none");
  app.showRecovery();
  assert.equal(app.help.hidden, false);
  app.events.get("retry:click")();
  assert.equal(app.reloads(), 1);
});

test("failed registration retries when connectivity returns", async () => {
  const app = await boot({ firstFailure: true });
  app.events.get("online")();
  await app.flush();
  assert.equal(app.calls.length, 2);
  app.events.get("online")();
  await app.flush();
  assert.equal(app.updates(), 1);
});

test("subpath installs keep the worker inside the artifact scope", async () => {
  const app = await boot({ base: "/dating/" });
  assert.equal(app.calls[0].url, "https://example.com/dating/service-worker.js");
  assert.equal(app.calls[0].options.scope, "/dating/");
});

test("development does not register a caching worker", async () => {
  const app = await boot({ production: false });
  assert.equal(app.calls.length, 0);
});

test("manifest keeps the full app entry route and offers browser display fallback", async () => {
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/app");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.name, "VibeSwipes");
  assert.equal(manifest.short_name, "VibeSwipes");
  assert.ok(manifest.display_override.includes("browser"));
  for (const icon of manifest.icons) {
    assert.equal(new URL(icon.src, "https://example.com/").origin, "https://example.com");
    await access(new URL(`../public/${icon.src}`, import.meta.url));
  }
});
