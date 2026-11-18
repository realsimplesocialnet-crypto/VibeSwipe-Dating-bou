import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/(tabs)/views.tsx", import.meta.url), "utf8");
const conversationSource = readFileSync(new URL("../app/chat/[matchId].tsx", import.meta.url), "utf8");

test("native chat conversations are flat rows with a subtle divider", () => {
  const styles = source.match(/row:\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(source, /styles\.row, \{ borderBottomColor: colors\.border \}/);
  assert.match(styles, /borderBottomWidth/);
  assert.doesNotMatch(styles, /borderRadius|backgroundColor|shadow|elevation/);
});

test("native conversation opens at newest message on every focus", () => {
  assert.match(conversationSource, /inverted=\{sortedMessages\.length > 0\}/);
  assert.match(conversationSource, /key=\{matchId\}/);
  assert.match(conversationSource, /useFocusEffect\(useCallback\(\(\) => \{\s*const frame = requestAnimationFrame\(\(\) => \{\s*listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
});
