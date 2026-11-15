import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseByteRange } from "../src/lib/byte-range.ts";

test("whole files and Safari's two-byte probe", () => {
  assert.equal(parseByteRange(undefined, 100), undefined);
  assert.deepEqual(parseByteRange("bytes=0-1", 100), { start: 0, end: 1 });
});
test("open, capped, and suffix ranges", () => {
  assert.deepEqual(parseByteRange("bytes=25-", 100), { start: 25, end: 99 });
  assert.deepEqual(parseByteRange("bytes=50-999", 100), { start: 50, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-20", 100), { start: 80, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-200", 100), { start: 0, end: 99 });
});
test("malformed, multiple, and unsatisfiable ranges fail safely", () => {
  for (const value of ["bytes=-", "bytes=-0", "bytes=100-", "bytes=9-2",
    "bytes=0-1,2-3", "bytes=foo-bar", "bytes=9007199254740993-"])
    assert.equal(parseByteRange(value, 100), "invalid", value);
  assert.equal(parseByteRange("bytes=0-1", 0), "invalid");
});
