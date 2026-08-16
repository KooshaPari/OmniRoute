import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const EXECUTOR_PATH = path.resolve(import.meta.dirname, "../../open-sse/executors/theoldllm.ts");

test("theoldllm executor is free of TypeScript syntax diagnostics", () => {
  const source = fs.readFileSync(EXECUTOR_PATH, "utf8");
  const sourceFile = ts.createSourceFile(
    EXECUTOR_PATH,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
  const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\\n")
  );

  assert.deepEqual(diagnostics, []);
});
