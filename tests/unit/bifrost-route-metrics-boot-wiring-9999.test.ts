import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BOOT_PATH = join(here, "../../src/instrumentation-node.ts");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("startup wiring invokes bifrost route metric storage hydration", () => {
  const code = stripComments(readFileSync(BOOT_PATH, "utf8"));
  assert.match(
    code,
    /initializeBifrostRouteMetricsFromStorage\s*\(\s*\{\s*force:\s*true\s*\}\s*\)/,
    "instrumentation-node.ts must call initializeBifrostRouteMetricsFromStorage({ force: true }) during startup."
  );
});
