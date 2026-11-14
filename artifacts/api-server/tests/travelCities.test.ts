import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceBetweenCities,
  findRealTravelCity,
  resolveDiscoveryLocation,
  resolvePreferredDiscoveryArea,
  searchRealTravelCities,
} from "../src/lib/travelCities.ts";

test("travel city search returns canonical real city names", () => {
  assert.equal(findRealTravelCity(" lagos "), "Lagos");
  assert.equal(findRealTravelCity("Port Harcourt"), "Port Harcourt");
  assert.equal(findRealTravelCity("Not a real city name"), null);
  assert.ok(searchRealTravelCities("port").some((city) => city.name === "Port Harcourt"));
  assert.deepEqual(searchRealTravelCities("x"), []);
});

test("discovery uses travel city when active and home city when cleared", () => {
  assert.deepEqual(resolveDiscoveryLocation({
    travelMode: true,
    travelCity: "Lagos",
    requestedCity: "Accra",
    requestedCountry: "Ghana",
    homeCity: "Port Harcourt",
  }), { country: null, city: "Lagos" });
  assert.deepEqual(resolveDiscoveryLocation({
    travelMode: false,
    travelCity: null,
    requestedCountry: "Ghana",
    homeCity: "Port Harcourt",
  }), { country: "Ghana", city: null });
  assert.deepEqual(resolveDiscoveryLocation({
    travelMode: false,
    travelCity: null,
    requestedCountry: "Ghana",
    requestedCity: "Accra",
    homeCity: "Port Harcourt",
  }), { country: "Ghana", city: "Accra" });
  assert.deepEqual(resolveDiscoveryLocation({
    travelMode: true,
    travelCity: null,
    requestedCity: "Accra",
    requestedCountry: "Ghana",
    homeCity: "Port Harcourt",
  }), { country: null, city: "Port Harcourt" });
  assert.deepEqual(resolveDiscoveryLocation({
    travelMode: false,
    travelCity: null,
    homeCity: "Port Harcourt",
  }), { country: null, city: "Port Harcourt" });
});

test("discovery defaults to the registered city and keeps its state boundary", () => {
  assert.deepEqual(resolvePreferredDiscoveryArea({
    travelMode: false,
    travelCity: null,
    homeCountry: "Nigeria",
    homeState: "Rivers",
    homeCity: "Port Harcourt",
  }), {
    scope: "city",
    country: "Nigeria",
    state: "Rivers",
    city: "Port Harcourt",
    radiusKm: null,
  });
});

test("saved discovery area overrides home location and preserves the selected scope", () => {
  assert.deepEqual(resolvePreferredDiscoveryArea({
    travelMode: false,
    travelCity: null,
    homeCountry: "Nigeria",
    homeState: "Rivers",
    homeCity: "Port Harcourt",
    preference: {
      scope: "state",
      country: "Ghana",
      state: "Greater Accra",
      city: null,
      radiusKm: null,
    },
  }), {
    scope: "state",
    country: "Ghana",
    state: "Greater Accra",
    city: null,
    radiusKm: null,
  });
});

test("distance radius can resolve real city-center distances", () => {
  const distance = distanceBetweenCities(
    { country: "Nigeria", state: "Rivers", city: "Port Harcourt" },
    { country: "Nigeria", state: "Lagos", city: "Lagos" },
  );
  assert.ok(distance !== null && distance > 400 && distance < 700);
});
