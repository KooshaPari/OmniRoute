import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const PROVIDER_DISCOVERY = path.join(process.cwd(), "src/lib/a2a/skills/providerDiscovery.ts");

test("optional MCP discovery hides the absent module from Turbopack resolution", () => {
  const source = readFileSync(PROVIDER_DISCOVERY, "utf8");

  assert.match(
    source,
    /function getOptionalMcpClientModuleId\(\): string \{[\s\S]*return \["\.\.", "\.\.", "mcp", "client\.js"\]\.join\("\/"\);[\s\S]*\}/
  );
  assert.match(source, /await import\(getOptionalMcpClientModuleId\(\)\)/);
  assert.doesNotMatch(source, /createRequire/);
  assert.doesNotMatch(source, /const mcpModuleSpec/);
});
