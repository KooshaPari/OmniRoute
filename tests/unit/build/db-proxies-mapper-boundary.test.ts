import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = readFileSync(resolve(repoRoot, "src/lib/db/proxies.ts"), "utf8");

test("proxy database module relies on its imported mapper helpers", () => {
  const localMapperNames = [
    "toRecord",
    "mapProxyRow",
    "mapAssignmentRow",
    "isRelayProxyType",
    "extractRelayAuth",
    "toRegistryProxyResolution",
    "normalizeScope",
    "normalizeAssignmentScopeId",
    "toLegacyProxyLevel",
  ];

  for (const name of localMapperNames) {
    assert.doesNotMatch(source, new RegExp(`(?:export )?function ${name}\\b`));
  }
});
