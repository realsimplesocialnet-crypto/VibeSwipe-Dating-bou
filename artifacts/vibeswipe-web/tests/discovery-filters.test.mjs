import assert from "node:assert/strict";
import test from "node:test";
import { clearDiscoveryLocation, discoveryFilterParams, validDiscoveryAges } from "../src/lib/discovery-filters.ts";

const selected = { ageMin: 28, ageMax: 35, gender: "Woman", country: { code: "NG", name: "Nigeria" }, state: { code: "BA", name: "Bauchi" }, city: "", includePassed: false };
test("untouched discovery keeps the real saved age and gender preferences on the server", () => {
  assert.deepEqual(discoveryFilterParams(null), {});
});
test("age, gender, country and state are submitted together", () => {
  assert.deepEqual(discoveryFilterParams(selected), { ageMin: 28, ageMax: 35, gender: "Woman", country: "Nigeria", state: "Bauchi" });
});
test("a whole-country search has neither a stale city nor a state", () => {
  assert.deepEqual(discoveryFilterParams({ ...selected, state: null }), { ageMin: 28, ageMax: 35, gender: "Woman", country: "Nigeria" });
});
test("clearing location filters removes country, state, city, and passed-profile overrides", () => {
  const cleared = clearDiscoveryLocation({ ...selected, city: "Bauchi", includePassed: true });
  assert.equal(cleared.country, null);
  assert.equal(cleared.state, null);
  assert.equal(cleared.city, "");
  assert.equal(cleared.includePassed, false);
  assert.deepEqual(discoveryFilterParams(cleared), { ageMin: 28, ageMax: 35, gender: "Woman" });
});
test("passed profiles require an explicit opt-in and a selected country", () => {
  assert.equal(discoveryFilterParams({ ...selected, includePassed: true }).includePassed, "true");
  assert.equal(discoveryFilterParams({ ...selected, country: null, includePassed: true }).includePassed, undefined);
});
test("invalid and reversed age ranges cannot be applied", () => {
  assert.equal(validDiscoveryAges(18, 120), true);
  for (const [min, max] of [[17, 35], [22, 121], [40, 30], [0, 35], [22.5, 35], [NaN, 35]]) assert.equal(validDiscoveryAges(min, max), false);
});
