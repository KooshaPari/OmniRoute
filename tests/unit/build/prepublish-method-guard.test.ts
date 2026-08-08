import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const prepublishPath = resolve("scripts/build/prepublish.ts");

test("prepublish injects the HTTP method guard into the CommonJS standalone", () => {
  const source = readFileSync(prepublishPath, "utf8");

  assert.match(
    source,
    /const METHOD_GUARD_REQUIRE = 'require\("\.\/http-method-guard\.cjs"\)\.installHttpMethodGuard\(\);/
  );
  assert.doesNotMatch(source, /const METHOD_GUARD_IMPORT =/);
});
