import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_SETUP,
  asSetupData,
  buildProfileInput,
  getOnboardingDraftLoadState,
  getOnboardingStepError,
  runProfileCompletionOnce,
  type SetupData,
} from "../lib/onboardingProfile.ts";

const completeSetup: SetupData = {
  ...EMPTY_SETUP,
  firstName: "  Sam ",
  lastName: " Rivera  ",
  age: "29",
  gender: "Non-binary",
  lookingFor: "Everyone",
  photos: ["media:photo-one"],
  bio: "  Loves live music. ",
  country: "Canada",
  countryCode: "CA",
  countrySource: "manual",
  state: "Ontario",
  stateCode: "ON",
  city: "Toronto",
  interests: ["Music", "Coffee", "Travel"],
  occupation: "Other",
  occupationOther: "Community gardener",
  ageMin: "24",
  ageMax: "38",
  distanceKm: 100,
};

test("each required onboarding screen rejects missing or invalid input", () => {
  const cases: Array<{ step: number; patch: Partial<SetupData> }> = [
    { step: 0, patch: { firstName: " " } },
    { step: 1, patch: { lastName: "" } },
    { step: 2, patch: { age: "17" } },
    { step: 3, patch: { gender: "" } },
    { step: 5, patch: { photos: [] } },
    { step: 5, patch: { photos: ["media:one", "media:two"] } },
    { step: 0, patch: { countryCode: "", countrySource: "" } },
  ];

  for (const { step, patch } of cases) {
    assert.ok(
      getOnboardingStepError(step, { ...completeSetup, ...patch }),
      `expected step ${step} to reject ${JSON.stringify(patch)}`,
    );
  }
});

test("valid steps accept the required details and one profile photo without dating preferences", () => {
  for (const step of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    assert.equal(getOnboardingStepError(step, completeSetup), null);
  }
  assert.equal(getOnboardingStepError(4, { ...completeSetup, lookingFor: "" }), null);
  assert.equal(getOnboardingStepError(9, { ...completeSetup, ageMin: "", ageMax: "", distanceKm: -1 }), null);
});

test("the final profile payload saves selected hobbies and occupation", () => {
  assert.deepEqual(buildProfileInput(completeSetup), {
    name: "Sam Rivera",
    age: 29,
    gender: "Non-binary",
    lookingFor: "Everyone",
    bio: "Loves live music.",
    country: "Canada",
    state: null,
    city: "",
    interests: ["Music", "Coffee", "Travel"],
    occupation: "Other",
    occupationOther: "Community gardener",
    photos: ["media:photo-one"],
    videoUrl: null,
    preferences: {
      ageMin: 24,
      ageMax: 38,
      gender: "Everyone",
      distanceKm: 100,
    },
  });
});

test("saved drafts upgrade older comma-separated hobbies without losing them", () => {
  const restored = asSetupData({ interests: "Music, coffee, travel" });
  assert.deepEqual(restored.interests, ["Music", "coffee", "travel"]);
  assert.equal(restored.occupation, "Prefer not to say");
});

test("onboarding draft failures and timeouts show a retry state instead of loading forever", () => {
  assert.equal(
    getOnboardingDraftLoadState({
      hydrated: false,
      failed: false,
      timedOut: false,
    }),
    "loading",
  );
  assert.equal(
    getOnboardingDraftLoadState({
      hydrated: false,
      failed: true,
      timedOut: false,
    }),
    "retry",
  );
  assert.equal(
    getOnboardingDraftLoadState({
      hydrated: false,
      failed: false,
      timedOut: true,
    }),
    "retry",
  );
  assert.equal(
    getOnboardingDraftLoadState({
      hydrated: true,
      failed: true,
      timedOut: true,
    }),
    "ready",
  );
});

test("concurrent completion attempts submit once and failed saves can be retried", async () => {
  const guard = { current: false };
  let saveCount = 0;
  let releaseSave!: () => void;
  const save = () => {
    saveCount += 1;
    return new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
  };

  const first = runProfileCompletionOnce(guard, save);
  const second = runProfileCompletionOnce(guard, save);
  assert.equal(saveCount, 1);
  releaseSave();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);

  const retryGuard = { current: false };
  await assert.rejects(
    runProfileCompletionOnce(retryGuard, async () => {
      throw new Error("temporary save failure");
    }),
    /temporary save failure/,
  );
  assert.equal(retryGuard.current, false);
  assert.equal(
    await runProfileCompletionOnce(retryGuard, async () => {}),
    true,
  );
});
