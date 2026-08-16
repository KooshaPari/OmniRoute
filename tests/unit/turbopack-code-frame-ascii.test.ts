import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("compiled combo helper block comment is ASCII for Turbopack code frames", () => {
  const source = fs.readFileSync(new URL("../../src/lib/combos/comboContext.ts", import.meta.url), "utf8");
  const helperBlock = source.match(/\/\*[^\r\n]*helpers[^\r\n]*\*\//i)?.[0];

  assert.ok(helperBlock, "expected the compiled combo helper block comment");
  assert.match(
    helperBlock,
    /^[\x00-\x7F]*$/,
    "Turbopack code-frame safety requires this compiled helper block comment to be ASCII"
  );
});
