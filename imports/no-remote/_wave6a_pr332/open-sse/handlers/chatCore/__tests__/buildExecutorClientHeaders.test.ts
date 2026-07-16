import test from "node:test";
import assert from "node:assert/strict";
import { buildExecutorClientHeaders } from "../buildExecutorClientHeaders.ts";

/**
 * Test suite for the extracted `buildExecutorClientHeaders` leaf (PR-017,
 * chatCore god-file decomposition, #3501).
 *
 * Each test verifies one specific behaviour from the function's JSDoc contract:
 * Headers-instance inputs, plain-object inputs, null/undefined inputs, non-string
 * value filtering, user-agent override semantics (both spellings), empty-input
 * `null` sentinel, and no-mutation guarantee.
 */

// ── 1. Happy path: plain string-valued object ────────────────────────────────
test("buildExecutorClientHeaders: plain object with string values is returned as-is", () => {
  const input = { "x-trace-id": "abc-123", authorization: "Bearer t" };
  const out = buildExecutorClientHeaders(input);
  assert.ok(out);
  assert.equal(out!["x-trace-id"], "abc-123");
  assert.equal(out!["authorization"], "Bearer t");
  assert.equal(Object.keys(out!).length, 2);
});

// ── 2. WHATWG Headers instance input ─────────────────────────────────────────
// Per the WHATWG Fetch spec, `Headers.prototype.forEach` passes the lower-cased key
// as its second argument; therefore the normalized map will have lower-cased keys.
// This test pins that downstream-readable behaviour so future refactors don't
// accidentally start honouring the original-case insertion ordering for `Headers` inputs.
test("buildExecutorClientHeaders: Headers instance entries are normalized to lower-cased keys", () => {
  const hdrs = new Headers();
  hdrs.set("Content-Type", "application/json");
  hdrs.set("X-Request-ID", "req-42");
  const out = buildExecutorClientHeaders(hdrs);
  assert.ok(out);
  assert.equal(out!["content-type"], "application/json");
  assert.equal(out!["x-request-id"], "req-42");
  assert.equal(Object.keys(out!).length, 2);
});

// ── 3. null input -> null output (explicit sentinel) ─────────────────────────
test("buildExecutorClientHeaders: returns null for null headers and no userAgent", () => {
  assert.equal(buildExecutorClientHeaders(null), null);
});

// ── 4. undefined input -> null output ────────────────────────────────────────
test("buildExecutorClientHeaders: returns null for undefined headers and no userAgent", () => {
  assert.equal(buildExecutorClientHeaders(undefined), null);
});

// ── 5. empty object input -> null output ─────────────────────────────────────
test("buildExecutorClientHeaders: returns null for an empty plain-object input", () => {
  assert.equal(buildExecutorClientHeaders({}), null);
});

// ── 6. non-string values are dropped silently (numbers, arrays, undefined) ───
test("buildExecutorClientHeaders: non-string values are dropped, strings kept", () => {
  const input = {
    stringVal: "kept",
    numberVal: 42,
    arrayVal: ["a", "b"],
    undefinedVal: undefined as unknown as string,
    boolVal: true as unknown as string,
    nullVal: null as unknown as string,
  };
  const out = buildExecutorClientHeaders(input);
  assert.ok(out);
  assert.equal(out!["stringVal"], "kept");
  // Only stringVal survives; the rest are filtered out before the length check.
  assert.equal(Object.keys(out!).length, 1);
});

// ── 7. userAgent override fills both spellings when no UA provided ───────────
test("buildExecutorClientHeaders: userAgent override writes both lower- and PascalCase keys", () => {
  const out = buildExecutorClientHeaders({}, "MyClient/1.0");
  assert.ok(out);
  assert.equal(out!["user-agent"], "MyClient/1.0");
  assert.equal(out!["User-Agent"], "MyClient/1.0");
});

// ── 8. userAgent override does NOT clobber an inbound UA header ──────────────
test("buildExecutorClientHeaders: existing user-agent headers suppress the UA override", () => {
  // lowercase variant only
  const lowerOut = buildExecutorClientHeaders({ "user-agent": "Inbound/1" }, "ShouldNotAppear");
  assert.ok(lowerOut);
  assert.equal(lowerOut!["user-agent"], "Inbound/1");
  assert.equal(Object.keys(lowerOut!).length, 1);

  // PascalCase variant only
  const pascalOut = buildExecutorClientHeaders({ "User-Agent": "Inbound/2" }, "ShouldNotAppear");
  assert.ok(pascalOut);
  assert.equal(pascalOut!["User-Agent"], "Inbound/2");
  assert.equal(Object.keys(pascalOut!).length, 1);
});

// ── 9. userAgent whitespace is trimmed; whitespace-only UA is treated as empty ─
test("buildExecutorClientHeaders: userAgent is trimmed; whitespace-only UA is treated as absent", () => {
  const trimmed = buildExecutorClientHeaders({}, "  Padded/3.0  ");
  assert.ok(trimmed);
  assert.equal(trimmed!["user-agent"], "Padded/3.0");

  // Whitespace-only userAgent MUST be ignored entirely so the UA block is skipped.
  const blank = buildExecutorClientHeaders({}, "   ");
  assert.equal(blank, null);
});

// ── 10. non-string userAgent (number, object, undefined) is ignored ─────────
test("buildExecutorClientHeaders: non-string userAgent is treated as no-override", () => {
  const out = buildExecutorClientHeaders({}, undefined);
  assert.equal(out, null);

  const outWithString = buildExecutorClientHeaders({}, undefined);
  assert.equal(outWithString, null);

  // numeric userAgent must not produce a header
  const numeric = buildExecutorClientHeaders({}, 42 as unknown as string);
  assert.equal(numeric, null);
});

// ── 11. Headers input combined with explicit userAgent override ──────────────
// Headers keys are lower-cased by `forEach` (WHATWG behaviour); UA override writes
// BOTH spellings regardless of input shape, so this test exercises the merge path.
test("buildExecutorClientHeaders: Headers instance + fresh userAgent override layers correctly", () => {
  const hdrs = new Headers();
  hdrs.set("Authorization", "Bearer abc");
  // No UA in the inbound headers -> override should be added.
  const out = buildExecutorClientHeaders(hdrs, "OmniRoute-Client/2.0");
  assert.ok(out);
  // Headers keys are normalized to lower-case by forEach (WHATWG behaviour).
  assert.equal(out!["authorization"], "Bearer abc");
  assert.equal(out!["user-agent"], "OmniRoute-Client/2.0");
  assert.equal(out!["User-Agent"], "OmniRoute-Client/2.0");
});

// ── 12. No mutation of inbound plain-object input ────────────────────────────
test("buildExecutorClientHeaders: does not mutate the inbound plain-object input", () => {
  const input: Record<string, unknown> = {
    "x-trace-id": "abc",
    authorization: "Bearer t",
    numeric: 99,
  };
  const snapshot = JSON.stringify(input);
  const out = buildExecutorClientHeaders(input);
  // Build a separate copy and confirm shape equality.
  assert.ok(out);
  assert.equal(out!["x-trace-id"], "abc");
  // After the call, the input must be untouched (no deleted keys, no mutated keys).
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(input.numeric, 99);
});

// ── 13. No mutation of inbound Headers instance ──────────────────────────────
test("buildExecutorClientHeaders: does not mutate the inbound Headers instance", () => {
  const hdrs = new Headers();
  hdrs.set("X-Foo", "bar");
  hdrs.set("Authorization", "Bearer t");
  const beforeSet = new Set(hdrs.entries());
  buildExecutorClientHeaders(hdrs, "UA/1");
  const afterEntries = Array.from(hdrs.entries());
  // Headers entries are still exactly what we set — no additions, removals, or rewrites.
  assert.equal(afterEntries.length, beforeSet.size);
  assert.equal(hdrs.get("X-Foo"), "bar");
  assert.equal(hdrs.get("Authorization"), "Bearer t");
});
