import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("MITM manager release source parses as TypeScript", () => {
  const source = fs.readFileSync(new URL("../../src/mitm/manager.ts", import.meta.url), "utf8");
  assert.doesNotThrow(() => new Bun.Transpiler({ loader: "ts" }).transformSync(source));
});
