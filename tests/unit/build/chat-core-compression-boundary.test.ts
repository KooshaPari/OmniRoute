import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("chat core compression setup remains parseable", () => {
  const fileName = resolve(repoRoot, "open-sse/handlers/chatCore.ts");
  const source = ts.createSourceFile(
    fileName,
    readFileSync(fileName, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );

  assert.deepEqual(
    source.parseDiagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    })),
    []
  );
});
