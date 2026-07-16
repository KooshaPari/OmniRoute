import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("GitHub Actions if expressions use single-quoted string literals", async () => {
  const directory = path.resolve(".github/workflows");
  const failures: string[] = [];
  for (const name of await readdir(directory)) {
    if (!/\.ya?ml$/.test(name)) continue;
    for (const [index, line] of (await readFile(path.join(directory, name), "utf8")).split("\n").entries()) {
      if (/^\s*if:\s*\$\{\{/.test(line) && /[^\\]"[^\\]*"/.test(line)) failures.push(`${name}:${index + 1}`);
    }
  }
  assert.deepEqual(failures, []);
});
