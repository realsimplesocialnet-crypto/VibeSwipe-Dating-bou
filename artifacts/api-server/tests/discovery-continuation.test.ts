import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { discoveryExcludedIds } from "../src/lib/discovery-exclusions.ts";
import { continueDiscoveryDeck, createUseDiscoveryDeck } from "../../../lib/api-client-react/src/discovery-deck.ts";

test("exhaustion recycles only passes, never likes, Super Likes, self or either block direction", () => {
  const input = {
    viewerId: "me", includePassed: false, hasRequestedLocation: false, travelMode: true,
    reactions: [{ id: "passed", type: "pass" }, { id: "liked", type: "like" }, { id: "super", type: "super" }],
    blocks: [{ blockerId: "me", blockedId: "blocked" }, { blockerId: "blocked-me", blockedId: "me" }],
  };
  assert.equal(discoveryExcludedIds(input).has("passed"), true);
  const recycled = discoveryExcludedIds({ ...input, recyclePassed: true });
  assert.equal(recycled.has("passed"), false);
  for (const id of ["me", "liked", "super", "blocked", "blocked-me"]) assert.equal(recycled.has(id), true);
});

test("member search can find previously liked and matched people without exposing blocked accounts", () => {
  const searchable = discoveryExcludedIds({
    viewerId: "me",
    includePassed: true,
    hasRequestedLocation: true,
    travelMode: false,
    includePreviouslyReacted: true,
    reactions: [{ id: "liked", type: "like" }, { id: "passed", type: "pass" }],
    blocks: [{ blockerId: "blocked-me", blockedId: "me" }, { blockerId: "me", blockedId: "blocked" }],
  });
  assert.equal(searchable.has("me"), true);
  assert.equal(searchable.has("liked"), false);
  assert.equal(searchable.has("passed"), false);
  assert.equal(searchable.has("blocked"), true);
  assert.equal(searchable.has("blocked-me"), true);
});

test("more unseen members append without replacing the visible card", () => {
  const old = [{ id: "seen" }, { id: "current" }, { id: "tail" }];
  const next = continueDiscoveryDeck(old, [{ id: "new" }, { id: "tail" }], 1);
  assert.equal(next.index, 1);
  assert.equal(next.profiles[1].id, "current");
  assert.deepEqual(next.profiles.map(p => p.id), ["seen", "current", "new", "tail"]);
});

test("an exhausted stack can repeat skipped people over many rounds", () => {
  const skipped = [{ id: "a" }, { id: "b" }, { id: "c" }];
  let current = { profiles: skipped, index: 0 };
  for (let round = 0; round < 50; round++) {
    current.index = current.profiles.length;
    current = continueDiscoveryDeck(current.profiles, [...skipped, skipped[0]], current.index);
    assert.equal(current.index, 0);
    assert.equal(current.profiles.length, 3, "Cycles deduplicate and discard old history instead of growing forever");
  }
});

test("explicit refill works when React Query returns the identical cached array", () => {
  let saved: any;
  const state = ((initial: any) => {
    if (!saved) saved = initial;
    return [saved, (next: any) => { saved = typeof next === "function" ? next(saved) : next; }];
  }) as Parameters<typeof createUseDiscoveryDeck>[0];
  const hook = createUseDiscoveryDeck(state);
  const data = [{ id: "only-pass" }];
  let deck = hook(data, "filter1");
  deck.setIndex(1);
  deck = hook(data, "filter1");
  assert.equal(deck.profiles[deck.index], undefined);
  deck.refill(data);
  deck = hook(data, "filter1");
  assert.equal(deck.profiles[deck.index].id, "only-pass");
  const staleRefill = deck.refill;
  hook([], "filter2");
  staleRefill(data);
  assert.equal(hook([], "filter2").profiles.length, 0, "Ignore previous filters' delayed responses");
});

test("empty server results stay truthful rather than fabricating members", () => {
  const result = continueDiscoveryDeck([{ id: "liked" }], [], 1);
  assert.equal(result.profiles[result.index], undefined);
});

test("server fallback reuses all safety/location conditions and excludes existing matches", () => {
  const code = readFileSync(new URL("../src/routes/vibeswipe.ts", import.meta.url), "utf8");
  assert.match(code, /if \(!searchTerm && !candidates.length && reacted.some\(row => row.type === "pass"\)\)/);
  assert.match(code, /recyclePassed: true/);
  assert.match(code, /if \(!searchTerm\) for \(const id of matchedIds\) excludedIds.add\(id\)/);
  assert.match(code, /includePreviouslyReacted: Boolean\(searchTerm\)/);
  assert.match(code, /const smartDefault = !searchTerm && automaticDiscovery/);
  assert.match(code, /if \(searchTerm\) \{\s*candidates = await queryCandidates\(\[\], 50\)/);
  assert.match(code, /candidates = await loadCandidates\(\)/);
  for (const condition of ["profilesTable.deactivated, false", "profilesTable.adminSuspended, false",
    "profilesTable.incognito, false", "gte(profilesTable.age, ageMin)", "lte(profilesTable.age, ageMax)",
    "eq(profilesTable.gender, gender)"]) assert.ok(code.includes(condition));
  assert.match(code, /r\.created_at.*r\.from_user_id/);
});

test("prefetch responses cannot restart a cycle with a profile liked after the request began", () => {
  for (const path of [
    "../../../artifacts/vibeswipe-web/src/components/discover-swipe-page.tsx",
    "../../../artifacts/vibeswipe/app/(tabs)/index.tsx",
  ]) {
    const code = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(code, /const exhausted = index >= profiles.length/);
    assert.match(code, /if \(exhausted && !result.isError\) refill\(result.data\)/);
  }
});
