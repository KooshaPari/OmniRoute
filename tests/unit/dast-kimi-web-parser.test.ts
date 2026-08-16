import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";

test("kimi-web executor remains parseable by the DAST build compiler", () => {
  const sourcePath = path.resolve("open-sse/executors/kimi-web.ts");
  const source = readFileSync(sourcePath, "utf8");

  assert.doesNotThrow(() => {
    stripTypeScriptTypes(source, {
      mode: "strip",
      sourceMap: false,
    });
  });
});
