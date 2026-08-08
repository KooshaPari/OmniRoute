import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const prepublishPath = resolve("scripts/build/prepublish.ts");

test("prepublish injects the HTTP method guard with ESM syntax", () => {
  const source = readFileSync(prepublishPath, "utf8");

  assert.match(
    source,
    /const METHOD_GUARD_IMPORT =\s*\n\s*'import methodGuard from "\.\/http-method-guard\.cjs";/
  );
  assert.doesNotMatch(source, /const METHOD_GUARD_REQUIRE =/);
});
