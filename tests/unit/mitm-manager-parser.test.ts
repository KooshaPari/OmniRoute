import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const managerPath = fileURLToPath(new URL("../../src/mitm/manager.ts", import.meta.url));

test("MITM manager source parses without TypeScript syntax diagnostics", () => {
  const source = readFileSync(managerPath, "utf8");
  const parsed = ts.createSourceFile(managerPath, source, ts.ScriptTarget.ES2022, true);

  assert.deepEqual(
    parsed.parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    ),
    []
  );
});
