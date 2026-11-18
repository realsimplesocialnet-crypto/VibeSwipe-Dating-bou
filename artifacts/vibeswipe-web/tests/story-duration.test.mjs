import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/stories/stories-ui.tsx", import.meta.url), "utf8");

test("Story uploads enforce the one-minute video limit in the composer", () => {
  assert.match(source, /STORY_VIDEO_MAX_SECONDS = 60/);
  assert.match(source, /duration > STORY_VIDEO_MAX_SECONDS/);
  assert.match(source, /Story videos must be 60 seconds or shorter/);
  assert.match(source, /video up to 60 seconds/);
});
