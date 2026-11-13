import assert from "node:assert/strict";
import test from "node:test";
import { SaveMyProfileBody } from "../../../lib/api-zod/src/generated/api.ts";
import { buildProfileValues } from "../src/lib/profileSetup.ts";

const signedInUserId = "user_clerk_onboarding_test";
const savedAt = new Date("2026-11-13T12:00:00.000Z");
const profileInput = SaveMyProfileBody.parse({
  name: "Sam Rivera",
  age: 29,
  gender: "Non-binary",
  lookingFor: "Everyone",
  bio: "Loves live music.",
  city: "Toronto",
  country: "Canada",
  state: "Ontario",
  interests: ["Music", "coffee", "travel"],
  photos: ["media:00000000-0000-4000-8000-000000000001"],
  videoUrl: null,
  preferences: {
    ageMin: 24,
    ageMax: 38,
    gender: "Everyone",
    distanceKm: 100,
  },
});

test("profile persistence takes its owner from the authenticated user, not the body", () => {
  const requestBody = { ...profileInput, id: "somebody-else" };
  const values = buildProfileValues(
    signedInUserId,
    requestBody,
    savedAt,
  );

  assert.equal(values.id, signedInUserId);
  assert.equal(values.name, "Sam Rivera");
  assert.equal(values.bio, "Loves live music.");
  assert.deepEqual(values.photos, profileInput.photos);
  assert.deepEqual(values.preferences, profileInput.preferences);
  assert.equal(values.updatedAt, savedAt);
});
