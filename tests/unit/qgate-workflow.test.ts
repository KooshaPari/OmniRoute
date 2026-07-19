import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const workflow = readFileSync(
  resolve(import.meta.dirname, "..", "..", ".github", "workflows", "qgate.yml"),
  "utf8"
);

test("qgate consumes coverage in the same job that generates it", () => {
  assert.doesNotMatch(workflow, /\.github\/workflows\/reusable\/quality-gate\.yml/);
  assert.match(workflow, /cargo build --release -p qgate/);
  assert.match(workflow, /--coverage-report coverage\/lcov\.info/);
  assert.ok(
    workflow.indexOf("npm run test:coverage") < workflow.indexOf("--coverage-report coverage/lcov.info"),
    "coverage must be generated before qgate reads it"
  );
});
