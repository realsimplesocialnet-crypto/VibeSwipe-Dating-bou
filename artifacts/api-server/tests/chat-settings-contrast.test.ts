import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../../vibeswipe-web/src/App.tsx", import.meta.url), "utf8");

test("chat settings dialog keeps readable text on its dark surface in light mode", () => {
  assert.match(app, /bg-\[#211d25\][^>]*style=\{\{ color: "#fbf5f7" \}\}/);
  assert.match(app, /brand text-2xl font-bold" style=\{\{ color: "#fbf5f7" \}\}/);
  assert.match(app, /text-\[#b6a8af\] hover:bg-white\/5/);
});
