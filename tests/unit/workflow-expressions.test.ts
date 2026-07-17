import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workflowsDir = path.resolve(".github/workflows");

test("GitHub Actions expressions use single-quoted string literals", async () => {
  const workflowNames = (await readdir(workflowsDir)).filter((name) => /\.ya?ml$/.test(name));
  const failures: string[] = [];

  for (const name of workflowNames) {
    const source = await readFile(path.join(workflowsDir, name), "utf8");
    for (const [index, line] of source.split("\n").entries()) {
      if (/^\s*if:\s*\$\{\{/.test(line) && /[^\\]"[^\\]*"/.test(line)) {
        failures.push(`${name}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});
