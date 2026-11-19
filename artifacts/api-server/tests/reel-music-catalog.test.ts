import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getReelSoundtrack, REEL_MUSIC_CATALOG } from "../src/lib/reel-music-catalog.ts";

test("the free Reel music catalog is valid, attributable, and keyless", () => {
  assert.ok(REEL_MUSIC_CATALOG.length >= 5);
  assert.equal(new Set(REEL_MUSIC_CATALOG.map((track) => track.id)).size, REEL_MUSIC_CATALOG.length);

  for (const track of REEL_MUSIC_CATALOG) {
    assert.match(track.audioUrl, /^https:\/\/upload\.wikimedia\.org\/.*\.mp3$/);
    assert.equal(track.license, "CC BY 3.0");
    assert.equal(track.licenseUrl, "https://creativecommons.org/licenses/by/3.0/");
    assert.match(track.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(track.attribution, /Jason Shaw/);
  }

  assert.equal(getReelSoundtrack(REEL_MUSIC_CATALOG[0].id)?.id, REEL_MUSIC_CATALOG[0].id);
  assert.equal(getReelSoundtrack("not-in-the-catalog"), null);
  assert.equal(getReelSoundtrack(null), null);
});

test("Reel posts accept a selected catalog track ID", () => {
  const apiSpec = readFileSync(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/routes/vibeswipe-reels.ts", import.meta.url), "utf8");
  assert.match(apiSpec, /soundtrackId: \{ type: \["string", "null"\]/);
  assert.match(route, /getReelSoundtrack\(body\.data\.soundtrackId\)/);
  assert.match(route, /soundtrack,\s+durationSeconds:/);
});

test("Reel posting keeps controls while removing instructional paragraphs", () => {
  const composer = readFileSync(new URL("../../vibeswipe-web/src/pages/reel-composer.tsx", import.meta.url), "utf8");
  assert.match(composer, /Record or choose a video/);
  assert.match(composer, /Who can see this Reel\?/);
  assert.match(composer, /data-testid="select-reel-audience"/);
  assert.doesNotMatch(composer, /There is no Reel duration limit|Music replaces the video’s original sound|Creator and license credit will appear|Anyone can view it|Mutual followers only|A private account is visible only|Choose a free track for your Reel/);
});
