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

test("qgate continues after test failures when lcov was produced", () => {
  assert.match(
    workflow,
    /- name: Generate coverage \(lcov\)[\s\S]*?id: coverage[\s\S]*?continue-on-error: true/
  );
  assert.match(workflow, /- name: Require generated coverage[\s\S]*?if: always\(\)/);
  assert.match(workflow, /test -s coverage\/lcov\.info/);
  assert.ok(
    workflow.indexOf("Require generated coverage") < workflow.indexOf("Checkout qgate source"),
    "coverage must be validated before qgate is built"
  );
});

test("qgate cancels superseded runs for the same PR or branch", () => {
  assert.match(
    workflow,
    /concurrency:[\s\S]*?group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/
  );
  assert.match(workflow, /concurrency:[\s\S]*?cancel-in-progress: true/);
});

test("qgate can discover project-local quality tools", () => {
  assert.match(
    workflow,
    /- name: Expose project-local tools[\s\S]*?node_modules\/\.bin["']? >> ["']?\$GITHUB_PATH/
  );
  assert.ok(
    workflow.indexOf("Expose project-local tools") < workflow.indexOf("Run qgate quality gate"),
    "local bun, playwright, tsc, and eslint binaries must be on PATH before qgate runs"
  );
});
