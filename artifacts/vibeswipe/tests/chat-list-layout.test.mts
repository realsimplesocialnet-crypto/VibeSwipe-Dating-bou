import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/(tabs)/views.tsx", import.meta.url), "utf8");

test("native chat conversations are flat rows with a subtle divider", () => {
  const styles = source.match(/row:\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(source, /styles\.row, \{ borderBottomColor: colors\.border \}/);
  assert.match(styles, /borderBottomWidth/);
  assert.doesNotMatch(styles, /borderRadius|backgroundColor|shadow|elevation/);
});
