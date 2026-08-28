import assert from "node:assert/strict";
import test from "node:test";

import { parseDelayString } from "../../open-sse/services/retryAfterJson.ts";

test("parseDelayString accepts zero and valid delay units", () => {
  assert.equal(parseDelayString(0), 0);
  assert.equal(parseDelayString("0"), 0);
  assert.equal(parseDelayString("1500ms"), 1500);
  assert.equal(parseDelayString("26.5s"), 26_500);
  assert.equal(parseDelayString("2m"), 120_000);
  assert.equal(parseDelayString("1h"), 3_600_000);
});

test("parseDelayString rejects malformed, negative, and nonfinite input", () => {
  for (const value of [
    "12msjunk",
    "12s later",
    "12.",
    "12..0",
    "-1",
    "-1s",
    -1,
    Infinity,
    Number.NaN,
  ]) {
    assert.equal(parseDelayString(value), null, `expected ${String(value)} to be rejected`);
  }
});

test("parseDelayString bounds provider-controlled delay text and values", () => {
  assert.equal(parseDelayString("1".repeat(65)), null);
  assert.equal(
    parseDelayString("999999999999999999999999999999999999999999999999999999999999s"),
    null
  );
  assert.equal(parseDelayString(Number.MAX_VALUE), null);
});
