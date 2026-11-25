import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isPathInside, resolveStaticFilePath } = require("../server/static-path.cjs") as {
  isPathInside: (root: string, target: string) => boolean;
  resolveStaticFilePath: (root: string, requestPath: string) => string | null;
};

test("static server resolves nested assets inside the build directory", () => {
  const root = "/app/static-build";
  assert.equal(resolveStaticFilePath(root, "/assets/app.js"), join(root, "assets", "app.js"));
  assert.equal(resolveStaticFilePath(root, "/assets/%E2%9C%93.js"), join(root, "assets", "✓.js"));
});

test("static server rejects encoded, plain, and malformed traversal paths", () => {
  const root = "/app/static-build";
  for (const requestPath of [
    "/../../etc/passwd",
    "/%2e%2e/%2e%2e/etc/passwd",
    "/assets/%2e%2e/%2e%2e/secret",
    "/..%2f..%2fsecret",
    "/%00secret",
    "/%",
  ]) {
    assert.equal(resolveStaticFilePath(root, requestPath), null, requestPath);
  }
});

test("containment is based on path segments, not a matching string prefix", () => {
  assert.equal(isPathInside("/app/static-build", "/app/static-build/index.html"), true);
  assert.equal(isPathInside("/app/static-build", "/app/static-build-evil/secret"), false);
  assert.equal(isPathInside("/app/static-build", "/app/secret"), false);
});
