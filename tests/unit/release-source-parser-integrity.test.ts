import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PARSER_CRITICAL_SOURCES = [
  "open-sse/handlers/responseSanitizer.ts",
  "open-sse/services/combo.ts",
];

test("release-critical OpenSSE sources are independently parseable", () => {
  const transpiler = new Bun.Transpiler({ loader: "ts" });

  for (const path of PARSER_CRITICAL_SOURCES) {
    const source = fs.readFileSync(new URL("../../" + path, import.meta.url), "utf8");
    assert.doesNotThrow(() => transpiler.transformSync(source), path);
  }
});
