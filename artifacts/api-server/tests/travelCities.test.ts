import assert from "node:assert/strict";
import test from "node:test";
import { findRealTravelCity, resolveDiscoveryCity, searchRealTravelCities } from "../src/lib/travelCities.ts";

test("travel city search returns canonical real city names", () => {
  assert.equal(findRealTravelCity(" lagos "), "Lagos");
  assert.equal(findRealTravelCity("Port Harcourt"), "Port Harcourt");
  assert.equal(findRealTravelCity("Not a real city name"), null);
  assert.ok(searchRealTravelCities("port").some((city) => city.name === "Port Harcourt"));
  assert.deepEqual(searchRealTravelCities("x"), []);
});

test("discovery uses travel city when active and home city when cleared", () => {
  assert.equal(resolveDiscoveryCity({
    travelMode: true,
    travelCity: "Lagos",
    requestedCity: "Accra",
    homeCity: "Port Harcourt",
  }), "Lagos");
  assert.equal(resolveDiscoveryCity({
    travelMode: false,
    travelCity: null,
    homeCity: "Port Harcourt",
  }), "Port Harcourt");
  assert.equal(resolveDiscoveryCity({
    travelMode: true,
    travelCity: null,
    requestedCity: "Accra",
    homeCity: "Port Harcourt",
  }), "Port Harcourt");
});
