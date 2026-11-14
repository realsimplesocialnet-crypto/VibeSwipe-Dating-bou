import assert from "node:assert/strict";
import test from "node:test";
import { removedProfilePhotoMediaIds } from "../src/lib/profileMediaReferences.ts";

test("profile photo removal keeps retained order and returns only removed media ids", () => {
  const removed = removedProfilePhotoMediaIds(
    ["media:main", "media:second", "media:second", "/legacy-photo.jpg"],
    ["media:second", "media:replacement"],
  );

  assert.deepEqual(removed, ["main"]);
});

test("profile photo removal returns no assets when the photo list is unchanged", () => {
  assert.deepEqual(
    removedProfilePhotoMediaIds(["media:main"], ["media:main"]),
    [],
  );
});
