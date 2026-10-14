// #13139 — Eval runner must opt out of output-style and memory injection
// so that eval cases measure the model, not injected context.
//
// Before this rewrite, the test was tautological: it constructed Headers
// locally and asserted their own values, never importing or exercising the
// real runtime module. That gave a false-green on any branch — the source
// could remove the opt-out headers and the test would still pass.
//
// The fix exposes the header-construction logic in runtime.ts as the
// exported function `buildEvalCaseHeaders` (the only call site is
// `executeEvalCase`, which makes a real HTTP request via `postChatCompletion`
// and is not directly testable in isolation). This test imports the
// exported function and verifies the contract.
//
// Discrimination:
//   - On this branch (HEAD): buildEvalCaseHeaders exists and sets the
//     opt-out headers → all 5 tests pass.
//   - On origin/main (843f342556): the import will fail at module load
//     because buildEvalCaseHeaders is not exported from runtime.ts → the
//     test file fails to load → the run is reported as a failure.

import test from "node:test";
import assert from "node:assert/strict";
import { buildEvalCaseHeaders } from "../../src/lib/evals/runtime.ts";

test("#13139 — buildEvalCaseHeaders sets x-omniroute-compression: off", () => {
  const headers = buildEvalCaseHeaders(null);
  assert.equal(headers.get("x-omniroute-compression"), "off");
});

test("#13139 — buildEvalCaseHeaders sets x-omniroute-no-memory: true", () => {
  const headers = buildEvalCaseHeaders(null);
  assert.equal(headers.get("x-omniroute-no-memory"), "true");
});

test("#13139 — buildEvalCaseHeaders sets Content-Type: application/json", () => {
  const headers = buildEvalCaseHeaders(null);
  assert.equal(headers.get("Content-Type"), "application/json");
});

test("#13139 — buildEvalCaseHeaders sets Authorization when apiKey is provided", () => {
  const headers = buildEvalCaseHeaders("test-key-abc-123");
  assert.equal(headers.get("Authorization"), "Bearer test-key-abc-123");
});

test("#13139 — buildEvalCaseHeaders does not set Authorization when apiKey is null", () => {
  const headers = buildEvalCaseHeaders(null);
  assert.equal(headers.get("Authorization"), null);
});
