#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VITEST_IMPORT = /(?:from\s+|import\s*)["']vitest["']/;
const NODE_TEST_IMPORT = /(?:from\s+|import\s*)["']node:test["']/;
const BUN_TEST_IMPORT = /(?:from\s+|import\s*)["']bun:test["']/;

export function discoverTopLevelUnitTests(root = process.cwd()) {
  const unitDir = path.join(root, "tests/unit");
  const manifest = { node: [], vitest: [], bun: [] };
  if (!fs.existsSync(unitDir)) return manifest;

  for (const name of fs.readdirSync(unitDir).sort()) {
    if (!name.endsWith(".test.ts")) continue;
    const relativePath = path.posix.join("tests/unit", name);
    const source = fs.readFileSync(path.join(unitDir, name), "utf8");
    const importsVitest = VITEST_IMPORT.test(source);
    const importsNodeTest = NODE_TEST_IMPORT.test(source);
    const importsBunTest = BUN_TEST_IMPORT.test(source);
    const runnerCount = [importsVitest, importsNodeTest, importsBunTest].filter(Boolean).length;
    if (runnerCount > 1) {
      throw new Error(
        `${relativePath} imports more than one of Vitest, node:test, and bun:test`
      );
    }
    if (importsVitest) manifest.vitest.push(relativePath);
    else if (importsBunTest) manifest.bun.push(relativePath);
    else manifest.node.push(relativePath);
  }
  return manifest;
}

function main() {
  const manifest = discoverTopLevelUnitTests();
  const runner = process.argv[2];
  if (runner === "--node") console.log(manifest.node.join("\n"));
  else if (runner === "--vitest") console.log(manifest.vitest.join("\n"));
  else if (runner === "--bun") console.log(manifest.bun.join("\n"));
  else {
    console.error("Usage: unit-test-manifest.mjs --node|--vitest|--bun");
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
