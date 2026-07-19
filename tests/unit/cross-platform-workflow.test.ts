import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const workflow = readFileSync(
  resolve(import.meta.dirname, "..", "..", ".github", "workflows", "cross-platform.yml"),
  "utf8"
);

test("cross-platform workflow isolates the Windows home before Next.js tracing", () => {
  assert.match(
    workflow,
    /- name: Isolate Windows home from protected junctions\n\s+if: runner\.os == 'Windows'\n\s+shell: bash\n\s+run: \|\n(?:\s+.*\n)*?\s+echo "USERPROFILE=\$RUNNER_TEMP\/home" >> "\$GITHUB_ENV"/
  );
  assert.ok(
    workflow.indexOf("USERPROFILE=$RUNNER_TEMP/home") < workflow.indexOf("npm run build:cli"),
    "Windows home isolation must happen before the CLI build"
  );
});
