import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDiscoveryLocationStatus,
  geolocationFailureMessage,
  locationPermissionFailureMessage,
} from "../../../lib/api-client-react/src/discovery-location.ts";

test("location permission denials preserve manual location selection", () => {
  assert.match(geolocationFailureMessage(1), /Choose a location manually/);
  assert.match(locationPermissionFailureMessage(true), /Choose a location manually/);
  assert.match(locationPermissionFailureMessage(false), /Open Settings/);
});

test("unavailable and timed-out GPS requests explain the manual fallback", () => {
  assert.match(geolocationFailureMessage(2), /could not be determined/);
  assert.match(geolocationFailureMessage(3), /took too long/);
});

test("resolved city feedback does not reveal GPS coordinates", () => {
  const message = formatDiscoveryLocationStatus({
    country: { code: "NG", name: "Nigeria" },
    state: { code: "LA", name: "Lagos" },
    city: { code: "Lagos", name: "Lagos" },
  });
  assert.equal(message, "Using nearest supported city: Lagos, Lagos, Nigeria. GPS coordinates are not saved.");
  assert.doesNotMatch(message, /-?\d+\.\d+/);
});
