import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../src/pages/admin.tsx", import.meta.url), "utf8");

test("admin authorization cache belongs to the active signed-in account", () => {
  assert.match(page, /queryKey: \[\.\.\.getGetAdminSessionQueryKey\(\), user\?\.id \?\? 'signed-out'\]/);
  assert.match(page, /previousAccount\.current !== user\?\.id/);
  const cleanup = page.slice(page.indexOf("const previousAccount"), page.indexOf("const doSignOut"));
  assert.match(cleanup, /clearAdmin\(qc\)/);
  assert.match(cleanup, /setUserId\(null\)/);
  assert.match(cleanup, /setChatId\(null\)/);
});
