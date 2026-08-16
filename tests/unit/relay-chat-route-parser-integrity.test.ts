import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("relay chat completion route release source parses as TypeScript", () => {
  const source = fs.readFileSync(new URL("../../../../../../src/app/api/v1/relay/chat/completions/route.ts", import.meta.url), "utf8");
  assert.doesNotThrow(() => new Bun.Transpiler({ loader: "ts" }).transformSync(source));
});
