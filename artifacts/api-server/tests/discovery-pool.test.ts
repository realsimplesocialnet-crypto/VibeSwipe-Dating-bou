import assert from "node:assert/strict";
import test from "node:test";
import { Country } from "country-state-city";
import { automaticDiscovery, continent, countryCode, discoveryTier, minimumDiscoveryPool, smartDiscoveryPool } from "../src/lib/discovery-pool.ts";
import { reconcileDiscoveryDeck } from "../../../lib/api-client-react/src/discovery-deck.ts";

const member = (id: string, country: string) => ({ id, country });
async function pool(rows: ReturnType<typeof member>[], home = "India", threshold = 20) {
  return smartDiscoveryPool(threshold, async (tier, limit, excluded) =>
    rows.filter(p => !excluded.includes(p.id) && (tier === 2 || discoveryTier(home, p.country) === tier)).slice(0, limit));
}
test("zero local members expands first to the same continent, then worldwide", async () => {
  const rows = [member("ng", "Nigeria"), member("pk", "Pakistan"), member("uk", "UK")];
  assert.deepEqual((await pool(rows)).map(p => p.id), ["pk", "ng", "uk"]);
});
test("a small local pool stays first even when foreign profiles arrive first", async () => {
  const rows = [member("ng", "Nigeria"), member("pk", "Pakistan"), member("in", "India")];
  assert.deepEqual((await pool(rows)).map(p => p.id), ["in", "pk", "ng"]);
});
test("twenty eligible locals stop worldwide fill and more locals naturally take precedence", async () => {
  const locals = Array.from({ length: 20 }, (_, n) => member(`in${n}`, "India"));
  const foreign = [member("ng", "Nigeria"), member("pk", "Pakistan")];
  assert.equal((await pool([...foreign, ...locals.slice(0, 19)])).length, 20);
  assert.equal((await pool([...foreign, ...locals])).every(p => p.country === "India"), true);
});
test("pool threshold is configurable and rejects invalid configuration", async () => {
  assert.equal(minimumDiscoveryPool(undefined), 20);
  assert.equal(minimumDiscoveryPool("30"), 30);
  for (const value of ["0", "101", "1.5", "NaN", ""]) assert.throws(() => minimumDiscoveryPool(value));
  assert.equal((await pool([member("in", "India"), member("pk", "Pakistan")], "India", 1)).length, 1);
});
test("country aliases and ISO codes rank correctly and every supported country has a continent", () => {
  assert.equal(countryCode("IN"), "IN");
  assert.equal(discoveryTier("USA", "United States"), 0);
  assert.equal(discoveryTier("India", "PK"), 1);
  assert.equal(discoveryTier("India", "Nigeria"), 2);
  assert.equal(discoveryTier(null, "India"), 2);
  for (const c of Country.getAllCountries()) assert.ok(continent(c.name), `Missing continent: ${c.isoCode}`);
});
test("manual country/city, saved location, and travel mode never widen automatically", () => {
  assert.equal(automaticDiscovery({ travelMode: false }), true);
  assert.equal(automaticDiscovery({ travelMode: false, requestedCountry: "India" }), false);
  assert.equal(automaticDiscovery({ travelMode: false, requestedCity: "Mumbai" }), false);
  assert.equal(automaticDiscovery({ travelMode: false, preference: { scope: "country", country: "India" } }), false);
  assert.equal(automaticDiscovery({ travelMode: true }), false);
});
test("unknown home location can still fill from worldwide and never duplicates members", async () => {
  const result = await pool([member("one", "Nigeria"), member("two", "India")], "");
  assert.equal(result.length, 2);
  assert.equal(new Set(result.map(p => p.id)).size, 2);
});
test("refresh preserves the displayed profile while putting newly local members next", () => {
  const old = [member("seen", "India"), member("current", "Nigeria"), member("old-next", "UK")];
  const incoming = [member("new-local", "India"), member("current", "Nigeria"), member("world", "Nigeria")];
  assert.deepEqual(reconcileDiscoveryDeck(old, incoming, 1).map(p => p.id), ["seen", "current", "new-local", "world"]);
  // Crossing the threshold must not move the current photo mid-swipe.
  assert.deepEqual(reconcileDiscoveryDeck(old, [incoming[0]], 1).map(p => p.id), ["seen", "current", "new-local"]);
});
test("exhausted decks pick up fresh members without skipping or repeating reacted profiles", () => {
  const old = [member("seen", "India")];
  const fresh = member("new", "Pakistan");
  assert.deepEqual(reconcileDiscoveryDeck(old, [fresh], 1).map(p => p.id), ["seen", "new"]);
  assert.deepEqual(reconcileDiscoveryDeck(old, [old[0], fresh, fresh], 1).map(p => p.id), ["seen", "new"]);
  assert.deepEqual(reconcileDiscoveryDeck([fresh], [], 0), []);
});
