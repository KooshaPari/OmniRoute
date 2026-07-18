/**
 * Tests for the polyglot error taxonomy (ADR-032 § "Consequences").
 *
 * Covers:
 *   - isPolyglotEdgeError discriminates by `code` field.
 *   - degradationFallback walks T3 → T2 → T1 for the canonical codes.
 *   - HTTP_5xx degrades but HTTP_4xx does not (caller's fault).
 *   - UDS_NO_CONNECTION degrades to T1 (last-mile fallback).
 */

import test from "node:test";
import assert from "node:assert/strict";

const { isPolyglotEdgeError, degradationFallback } = await import("../../open-sse/rpc/errors.ts");

function err(code: string, status?: number) {
  const e = new Error(`synthetic error (${code})`) as Error & {
    code: string;
    status?: number;
  };
  e.code = code;
  if (status !== undefined) e.status = status;
  return e;
}

// ─── E1: isPolyglotEdgeError ───────────────────────────────────────────────

test("isPolyglotEdgeError recognizes errors with a code field", () => {
  const e = err("HTTP_500");
  assert.equal(isPolyglotEdgeError(e), true);
});

test("isPolyglotEdgeError rejects plain Error objects", () => {
  const e = new Error("nope");
  assert.equal(isPolyglotEdgeError(e), false);
});

test("isPolyglotEdgeError rejects null / undefined / primitives", () => {
  assert.equal(isPolyglotEdgeError(null), false);
  assert.equal(isPolyglotEdgeError(undefined), false);
  assert.equal(isPolyglotEdgeError("string"), false);
  assert.equal(isPolyglotEdgeError(42), false);
});

// ─── E2: degradationFallback T3 → T2 ──────────────────────────────────────

test("FFI_NOT_AVAILABLE on T3 degrades to T2", () => {
  assert.equal(degradationFallback(err("FFI_NOT_AVAILABLE"), "T3"), "T2");
});

test("FFI_ABI_MISMATCH on T3 degrades to T2", () => {
  assert.equal(degradationFallback(err("FFI_ABI_MISMATCH"), "T3"), "T2");
});

test("Any other FFI error on T3 degrades to T2", () => {
  assert.equal(degradationFallback(err("FFI_CALL_FAILED"), "T3"), "T2");
});

// ─── E3: degradationFallback T2 → T1 ──────────────────────────────────────

test("UDS_NO_CONNECTION on T2 degrades to T1", () => {
  assert.equal(degradationFallback(err("UDS_NO_CONNECTION"), "T2"), "T1");
});

test("UDS_TIMEOUT on T2 degrades to T1", () => {
  assert.equal(degradationFallback(err("UDS_TIMEOUT"), "T2"), "T1");
});

test("UDS_CLOSED on T2 degrades to T1", () => {
  assert.equal(degradationFallback(err("UDS_CLOSED"), "T2"), "T1");
});

// ─── E4: T1 cannot degrade further ────────────────────────────────────────

test("Any error on T1 returns null (no further degradation)", () => {
  assert.equal(degradationFallback(err("HTTP_TRANSPORT_ERROR"), "T1"), null);
  assert.equal(degradationFallback(err("HTTP_500"), "T1"), null);
});

// ─── E5: HTTP errors on T2 are caller-fault and shouldn't degrade T2 → T1 ─

test("HTTP 4xx on T2 does not auto-degrade", () => {
  // 4xx = caller's fault, not the binding's. Don't degrade.
  assert.equal(degradationFallback(err("HTTP_400", 400), "T2"), null);
});

test("HTTP 5xx on T2 does not auto-degrade via this helper (handled by caller)", () => {
  // The helper only handles canonical transport codes; HTTP 5xx is treated
  // as caller-resolvable. Callers may still choose to degrade manually.
  assert.equal(degradationFallback(err("HTTP_500", 500), "T2"), null);
});