import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { evaluateJobResults } from "../../../scripts/check/check-job-results.mjs";

test("accepts successful authoritative jobs", () => {
  assert.deepEqual(evaluateJobResults({ lint: { result: "success" } }), []);
});

test("PR workflows expose stable always-running protected contexts", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const security = readFileSync(".github/workflows/security-scan.yml", "utf8");
  for (const name of ["ci/quality-gate", "ci/e2e", "release-green"]) {
    const start = ci.indexOf(`name: ${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    assert.match(ci.slice(start, start + 200), /if: \$\{\{ always\(\) }}/);
  }
  assert.match(security, /name: ci\/security[\s\S]{0,160}if: \$\{\{ always\(\) }}/);
  assert.match(ci, /NEEDS_JSON: \$\{\{ toJSON\(needs\) }}/);
  assert.match(security, /NEEDS_JSON: \$\{\{ toJSON\(needs\) }}/);
  assert.match(
    security,
    /codeql:[\s\S]*?name: CodeQL Analysis[\s\S]*?timeout-minutes: 30/,
    "CodeQL must have enough time to finish the full JavaScript query suite"
  );
});

test("accepts skipped jobs only when explicitly allowed", () => {
  const needs = { build: { result: "skipped" }, lint: { result: "success" } };
  assert.deepEqual(evaluateJobResults(needs, new Set(["build"])), []);
  assert.deepEqual(evaluateJobResults(needs), ["build: skipped"]);
});

test("fails closed on failure, cancellation, missing, and unknown results", () => {
  const needs = {
    failed: { result: "failure" },
    cancelled: { result: "cancelled" },
    missing: {},
    novel: { result: "neutral" },
  };
  assert.deepEqual(evaluateJobResults(needs), [
    "failed: failure",
    "cancelled: cancelled",
    "missing: unknown",
    "novel: neutral",
  ]);
});
