import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/member-search-page.tsx", import.meta.url), "utf8");

test("member search explains when the empty result is caused by searching for yourself", () => {
  assert.match(source, /useGetMyProfile/);
  assert.match(source, /isSearching\s*&&[\s\S]*?myProfile\.data\?\.name[\s\S]*?includes\(debouncedQuery\.toLocaleLowerCase\(\)\)/);
  assert.match(source, /Your own profile isn’t shown in member search\./);
  assert.match(source, /"No members found"/);
});

test("member search shows eligible people immediately before a query is entered", () => {
  assert.match(source, /const isSearching = debouncedQuery\.length >= 1/);
  assert.match(source, /isSearching \? \{ q: debouncedQuery \} : \{\}/);
  assert.doesNotMatch(source, /enabled:\s*debouncedQuery\.length\s*>=\s*1/);
  assert.match(source, /aria-label=\{isSearching \? "Search results" : "People"\}/);
});

test("member-name search starts at one character and returns matches while typing", () => {
  const openapi = readFileSync(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../../artifacts/api-server/src/routes/vibeswipe.ts", import.meta.url), "utf8");
  assert.match(openapi, /name: q[\s\S]*?minLength: 1/);
  assert.match(route, /if \(searchTerm\)[\s\S]*?ilike\(profilesTable\.name, `%\$\{escapedSearch\}%`\)/);
  assert.match(route, /normalizedName\.startsWith\(normalizedSearch\)/);
});
