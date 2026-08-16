import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const ROUTE_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/api/v1/relay/chat/completions/route.ts"
);

test("relay chat route remains a complete TypeScript module", () => {
  const source = fs.readFileSync(ROUTE_PATH, "utf8");
  const parsed = ts.createSourceFile(
    ROUTE_PATH,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
  const diagnostics = parsed.parseDiagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\\n")
  );

  assert.deepEqual(diagnostics, []);
});
