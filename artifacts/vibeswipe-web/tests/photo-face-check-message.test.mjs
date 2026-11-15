import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { userErrorMessage } from "../src/lib/user-errors.ts";
const expected = "This photo doesn’t match your verified face. Please upload a photo of yourself.";
test("photo mismatch is displayed exactly without exposing arbitrary server errors", () => {
  assert.equal(userErrorMessage({ status: 422, data: { error: expected } }, "Upload failed"), expected);
  assert.equal(userErrorMessage({ status: 422, data: { error: "private provider diagnostic" } }, "Upload failed"), "Upload failed");
});
test("verification consent stays meaningful without naming its implementation provider", () => {
  for (const path of ["../src/pages/face-verification.tsx", "../../vibeswipe/app/verify-profile.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /Luxand/i);
    assert.match(source, /I agree to have my photo and live selfie checked to confirm this is me/);
  }
});
