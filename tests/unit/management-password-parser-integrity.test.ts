import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("management password source declares its insecure-default set once", () => {
  const source = fs.readFileSync(new URL("../../../src/lib/auth/managementPassword.ts", import.meta.url), "utf8");
  assert.equal((source.match(/const INSECURE_DEFAULT_PASSWORDS/g) ?? []).length, 1);
  assert.doesNotThrow(() => new Bun.Transpiler({ loader: "ts" }).transformSync(source));
});
