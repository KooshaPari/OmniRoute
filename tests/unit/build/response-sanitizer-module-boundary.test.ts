import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SANITIZER_PATH = path.join(process.cwd(), "open-sse/handlers/responseSanitizer.ts");

test("response sanitizer remains a parseable ES module", () => {
  const source = readFileSync(SANITIZER_PATH, "utf8");
  const transpiler = new Bun.Transpiler({ loader: "ts" });

  assert.doesNotThrow(() => transpiler.transformSync(source));
});
