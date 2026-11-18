import assert from "node:assert/strict";
import test from "node:test";
import { reelSearchSuggestion } from "../src/lib/reel-search-suggestion.ts";

test("suggests a concise topic and city from the Reel caption", () => {
  assert.equal(
    reelSearchSuggestion({
      caption: "How our guest left our 2 bedroom Duplex Apartment 😭",
      creatorLocation: "Kubwa, Abuja, Nigeria",
    }),
    "2 bedroom duplex apartment in kubwa",
  );
});

test("suggests searchable words from a topical Reel caption", () => {
  assert.equal(
    reelSearchSuggestion({
      caption: "Government conversation about housing",
      creatorLocation: "Abuja, Nigeria",
    }),
    "government conversation housing in abuja",
  );
});

test("omits generic captions rather than showing an irrelevant search prompt", () => {
  assert.equal(
    reelSearchSuggestion({ caption: "Good vibes only ❤️", creatorLocation: "Lagos, Nigeria" }),
    null,
  );
  assert.equal(
    reelSearchSuggestion({ caption: "May the rest of the year bring us unforgettable blessings", creatorLocation: "Lagos, Nigeria" }),
    null,
  );
  assert.equal(
    reelSearchSuggestion({ caption: "I want do videos", creatorLocation: "Nigeria" }),
    null,
  );
});
