import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Run from any directory: node artifacts/api-server/scripts/run-reel-safety-checks.mjs
// Workspace DB dependencies must be bundled, not externalized as undeclared API dependencies.
const cwd = fileURLToPath(new URL("..", import.meta.url));
for (const name of ["check-reel-safety", "check-reel-publication"]) {
  const outfile = resolve(cwd, `dist/${name}.mjs`);
  await build({
    absWorkingDir: cwd, entryPoints: [`scripts/${name}.ts`], outfile,
    bundle: true, platform: "node", format: "esm",
    external: ["@huggingface/transformers", "@google-cloud/storage", "pino", "pg-native", "drizzle-orm"],
    banner: { js: 'import {createRequire} from "node:module"; const require=createRequire(import.meta.url);' },
  });
  execFileSync(process.execPath, [outfile], { cwd, stdio: "inherit" });
}
