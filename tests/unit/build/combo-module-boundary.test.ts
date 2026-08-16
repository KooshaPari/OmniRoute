import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const comboPath = fileURLToPath(new URL("../../../open-sse/services/combo.ts", import.meta.url));

test("combo routing module has no TypeScript parser diagnostics", () => {
  const source = readFileSync(comboPath, "utf8");
  const parsed = ts.createSourceFile(
    comboPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  assert.deepEqual(
    parsed.parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    ),
    []
  );
});
