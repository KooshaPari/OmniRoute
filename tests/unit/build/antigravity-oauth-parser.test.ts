import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const PROVIDER_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/lib/oauth/providers/antigravity.ts"
);

test("Antigravity OAuth provider remains parseable so onboarding stays in the exchange flow", () => {
  const sourceText = fs.readFileSync(PROVIDER_PATH, "utf8");
  const sourceFile = ts.createSourceFile(
    PROVIDER_PATH,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => {
    const location =
      diagnostic.start === undefined
        ? "unknown"
        : sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    return `${location.line + 1}:${location.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
  });

  assert.deepEqual(diagnostics, []);
});
