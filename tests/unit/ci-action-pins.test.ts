import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");

for (const relativePath of [
  ".github/workflows/ci.yml",
  ".github/workflows/security-scan.yml",
  ".github/workflows/reusable/quality-gate.yml",
]) {
  test(`${relativePath} pins every external action to a full commit SHA`, () => {
    const source = readFileSync(resolve(ROOT, relativePath), "utf8");
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+).*/gm)) {
      const action = match[1];
      if (action.startsWith("./")) continue;
      assert.match(action, /@[0-9a-f]{40}$/, `${action} must use an immutable commit SHA`);
    }
  });
}
