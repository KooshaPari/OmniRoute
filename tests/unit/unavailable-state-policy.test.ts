import test from "node:test";
import assert from "node:assert/strict";

import { shouldPersistUnavailableStateForComboFailure } from "../../src/sse/services/unavailableStatePolicy.ts";

test("combo transient 429 persists for non-Antigravity providers", () => {
  assert.equal(
    shouldPersistUnavailableStateForComboFailure({
      isCombo: true,
      provider: "openai",
      status: 429,
      failureKind: "transient",
    }),
    true
  );

  assert.equal(
    shouldPersistUnavailableStateForComboFailure({
      isCombo: true,
      provider: "anthropic",
      status: 429,
      failureKind: "rate_limit",
    }),
    true
  );
});

test("combo transient 429 stays in-memory for Antigravity", () => {
  assert.equal(
    shouldPersistUnavailableStateForComboFailure({
      isCombo: true,
      provider: "antigravity",
      status: 429,
      failureKind: "transient",
    }),
    false
  );
});
