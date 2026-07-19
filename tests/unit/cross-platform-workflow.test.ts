import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const workflow = readFileSync(
  resolve(import.meta.dirname, "..", "..", ".github", "workflows", "cross-platform.yml"),
  "utf8"
);

test("cross-platform workflow isolates the Windows home before Next.js tracing", () => {
  const isolationStep = workflow.indexOf(
    "      - name: Isolate Windows home from protected junctions\n"
  );
  const buildStep = workflow.indexOf("      - name: Build CLI\n", isolationStep);

  assert.notEqual(isolationStep, -1, "Windows home isolation step must exist");
  assert.notEqual(buildStep, -1, "CLI build step must follow Windows home isolation");

  const isolationBlock = workflow.slice(isolationStep, buildStep);
  assert.ok(isolationBlock.includes("        if: runner.os == 'Windows'\n"));
  assert.ok(isolationBlock.includes("        shell: bash\n"));
  assert.ok(
    isolationBlock.includes(
      '          echo "USERPROFILE=$RUNNER_TEMP/home" >> "$GITHUB_ENV"\n'
    )
  );
  assert.ok(
    workflow.indexOf("USERPROFILE=$RUNNER_TEMP/home") < workflow.indexOf("npm run build:cli"),
    "Windows home isolation must happen before the CLI build"
  );
});
