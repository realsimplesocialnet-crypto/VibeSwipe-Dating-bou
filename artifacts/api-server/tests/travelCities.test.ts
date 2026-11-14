import assert from "node:assert/strict";
import test from "node:test";
import { findRealTravelCity, resolveDiscoveryLocation, searchRealTravelCities } from "../src/lib/travelCities.ts";

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
