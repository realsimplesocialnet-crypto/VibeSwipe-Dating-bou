import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceBetweenCities,
  findRealTravelCity,
  resolveDiscoveryGpsLocation,
  resolveDiscoveryLocation,
  resolvePreferredDiscoveryArea,
  searchRealTravelCities,
} from "../src/lib/travelCities.ts";
import { City } from "country-state-city";

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

test("GPS resolves to the nearest supported city without returning coordinates", () => {
  const lagos = (City.getCitiesOfCountry("NG") ?? []).find(
    (city) => city.name === "Lagos" && city.stateCode === "LA",
  );
  assert.ok(lagos?.latitude && lagos.longitude);
  const resolved = resolveDiscoveryGpsLocation(
    Number(lagos.latitude),
    Number(lagos.longitude),
    "NG",
  );
  assert.deepEqual(resolved, {
    country: { code: "NG", name: "Nigeria" },
    state: { code: "LA", name: "Lagos" },
    city: { code: "Lagos", name: "Lagos" },
  });
  assert.ok(resolved && !("latitude" in resolved) && !("longitude" in resolved));
});

test("GPS resolver rejects invalid coordinates and coordinates outside mapped land", () => {
  assert.equal(resolveDiscoveryGpsLocation(91, 0, "NG"), null);
  assert.equal(resolveDiscoveryGpsLocation(0, 181, "NG"), null);
  assert.equal(resolveDiscoveryGpsLocation(0, 0, "INVALID"), null);
});
