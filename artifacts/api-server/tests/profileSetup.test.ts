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
  occupation: "Other",
  occupationOther: "Community gardener",
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
  assert.equal(values.occupation, "Other");
  assert.equal(values.occupationOther, "Community gardener");
  assert.deepEqual(values.preferences, profileInput.preferences);
  assert.equal(values.updatedAt, savedAt);
});

test("older profile-save callers retain empty occupation defaults", () => {
  const legacyInput = SaveMyProfileBody.parse({
    ...profileInput,
    occupation: undefined,
    occupationOther: undefined,
  });
  const saved = buildProfileValues(signedInUserId, legacyInput, savedAt);

  assert.equal(saved.occupation, "");
  assert.equal(saved.occupationOther, "");
});

test("an account profile cannot be saved without at least one picture", () => {
  assert.equal(SaveMyProfileBody.safeParse({ ...profileInput, photos: [] }).success, false);
});

test("the uploaded picture reference is preserved for profile and Discover cards", () => {
  const saved = buildProfileValues(signedInUserId, profileInput, savedAt);
  assert.equal(saved.photos[0], profileInput.photos[0]);
});
