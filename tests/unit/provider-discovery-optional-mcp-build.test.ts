import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const providerDiscoveryPath = join(__dirname, "../../src/lib/a2a/skills/providerDiscovery.ts");
const source = readFileSync(providerDiscoveryPath, "utf8");

test("DAST-W1: optional MCP discovery is excluded from static backend-only resolution", () => {
  assert.match(
    source,
    /const mcpModuleSpec: string = [^;]+;/,
    "optional MCP discovery must keep the module specifier computed rather than a literal import"
  );
  assert.doesNotMatch(
    source,
    /import\(\s*["']\.\.\/\.\.\/mcp\/client\.js["']\s*\)/,
    "backend-only builds must not statically resolve the absent optional MCP client"
  );
  assert.match(
    source,
    /import\(\s*\/\* webpackIgnore: true \*\/\s*mcpModuleSpec\s*\)/,
    "the optional MCP dynamic import must opt out of Next/Turbopack static resolution"
  );
  assert.match(
    source,
    /import\([\s\S]*?mcpModuleSpec[\s\S]*?\)\.catch\(/,
    "missing optional MCP infrastructure must remain runtime-tolerant"
  );
});
