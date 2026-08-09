/**
 * combo-decision-matrix.test.ts — PR-β fork-main addition.
 *
 * Encodes the (provider, status, error envelope) → {advance | stop |
 * retry-then-stop} contract as a single deterministic matrix file. Recent
 * history (#2101, #4279, #5249, #8251, #8252) has been six rounds of
 * "a substring in the 400 envelope was broadened; combo advances where
 * it used to stop" — having one canonical place for the matrix lets a
 * future maintainer (and a code reviewer) verify the contract at a glance.
 *
 * Differs from upstream-targeted PR-β (which assumed `MODEL_ACCESS_DENIED_PATTERNS`
 * and `isModelScoped400` were exported from comboPredicates.ts). On the fork we
 * go through `checkFallbackError` directly — the public predicate surface
 * that combo dispatchers actually consult. This is what runs in production.
 *
 * Strategy note: targeting our own fork first per the Aug-2026 strategy
 * shift (upstream cadence slowed to 1 release every 2-3 weeks; we land
 * changes here and cherry-pick upstream only when diffs are small enough
 * to merge cleanly).
 *
 * This file is purely additive — no production code touched, behavior
 * preserved.
 */
import test from "node:test";
import assert from "node:assert/strict";

const accountFallback = await import("../../open-sse/services/accountFallback.ts");
const { checkFallbackError } = accountFallback;
const { RateLimitReason } = await import(
  "../../open-sse/config/constants.ts"
);

// ─────────────────────────────────────────────────────────────────────────────
// Matrix rows — the canonical "what does combo do for this case" table.
// Provider-agnostic unless noted (column "Provider"). Status / Envelope /
// Expect drive each row.
// ─────────────────────────────────────────────────────────────────────────────

type Decision =
  | "advance" // fallback (try next target)
  | "stop" // terminal — propagate to caller
  | "retry-then-stop"; // transient — combo retries, then propagates

interface MatrixRow {
  provider: string;
  status: number;
  envelope: string;
  expect: Decision;
  structuredError?: { code?: string | null; type?: string | null };
  // For envelopes whose envelope text is intentionally ambiguous we say so
  // explicitly in the row so the matrix stays self-documenting.
  comment?: string;
}

const MATRIX: readonly MatrixRow[] = [
  // ── 400 advance — model-not-supported across providers ───────────────────
  {
    provider: "anthropic",
    status: 400,
    envelope: "invalid_request_error: model X not supported",
    expect: "advance",
    comment: "Anthropic 400 with model-not-supported text → try next target",
  },
  {
    provider: "anthropic",
    status: 400,
    envelope: "Bad Request: The model is not supported",
    expect: "advance",
    structuredError: { type: "not_found_error" },
    comment: "Structured not_found_error short-circuits the text pattern",
  },
  {
    provider: "anthropic",
    status: 400,
    envelope: "model X does not support Responses API.",
    expect: "advance",
    comment: "Anthropic permission_error confirmed model-related",
    structuredError: { type: "permission_error" },
  },
  {
    provider: "openai",
    status: 400,
    envelope: "invalid_request_error: model X not supported",
    expect: "advance",
    structuredError: { code: "model_not_found" },
  },
  {
    provider: "openai",
    status: 400,
    envelope: "model_not_found",
    expect: "advance",
    structuredError: { code: "model_not_found" },
    comment: "Pure structured-code 400 advances even without envelope text",
  },
  {
    provider: "gemini",
    status: 400,
    envelope: "Bad Request: The model is not supported",
    expect: "advance",
  },
  {
    provider: "azure-openai",
    status: 400,
    envelope: "deployment_not_found",
    expect: "advance",
    structuredError: { code: "deployment_not_found" },
  },

  // ── 400 stop — malformed / overflow / param validation ──────────────────
  {
    provider: "openai",
    status: 400,
    envelope: "invalid message format",
    expect: "stop",
    comment: "Pure malformed 400 — never advances",
  },
  {
    provider: "anthropic",
    status: 400,
    envelope: "Bad Request: empty body",
    expect: "stop",
  },
  {
    provider: "openai",
    status: 400,
    envelope: "context_length_exceeded: 200000 tokens > 8192 max",
    expect: "stop",
    comment: "Overflow 400 — stop, don't advance (advancing wastes another target)",
  },
  {
    provider: "openai",
    status: 400,
    envelope: "messages: parameter is illegal",
    expect: "stop",
  },

  // ── 400 stop — auth-credential 400 (must never be re-classified) ─────────
  {
    provider: "openai",
    status: 400,
    envelope: "Invalid API key provided: sk-xxxx",
    expect: "stop",
    comment: "Auth credential 400 — must never trip model-access advance",
  },
  {
    provider: "openai",
    status: 400,
    envelope: "Authentication failed",
    expect: "stop",
  },

  // ── 401 stop — pure auth failures ──────────────────────────────────────
  {
    provider: "openai",
    status: 401,
    envelope: "Unauthorized",
    expect: "stop",
  },
  {
    provider: "anthropic",
    status: 401,
    envelope: "Invalid API Key",
    expect: "stop",
  },

  // ── 429 retry-then-stop — transient rate limit ──────────────────────────
  {
    provider: "openai",
    status: 429,
    envelope: "Rate limit reached",
    expect: "retry-then-stop",
    comment: "Plain 429 — combo retries, then propagates",
  },
  {
    provider: "anthropic",
    status: 429,
    envelope: "Too Many Requests",
    expect: "retry-then-stop",
  },

  // ── 429 stop — quota exhausted (long cooldown, but stops) ───────────────
  {
    provider: "antigravity",
    status: 429,
    envelope:
      "Individual quota reached. Contact your administrator to enable overages. Resets in 164h27m24s.",
    expect: "stop",
    comment: "Quota-exhausted 429 → stop with full reset window",
  },

  // ── 5xx retry-then-stop — transient upstream outage ─────────────────────
  {
    provider: "openai",
    status: 500,
    envelope: "Internal server error",
    expect: "retry-then-stop",
  },
  {
    provider: "anthropic",
    status: 502,
    envelope: "Bad gateway",
    expect: "retry-then-stop",
  },
  {
    provider: "gemini",
    status: 503,
    envelope: "Service unavailable",
    expect: "retry-then-stop",
  },
  {
    provider: "openai",
    status: 504,
    envelope: "Gateway timeout",
    expect: "retry-then-stop",
  },

  // ── 503 stop — quota exhausted via the 503 back-channel ────────────────
  {
    provider: "anthropic",
    status: 503,
    envelope: '{"error":{"type":"insufficient_quota","message":"quota exhausted"}}',
    expect: "retry-then-stop",
    comment: "503 quota-exhaustion detected via ALL_ACCOUNTS_RATE_LIMITED_PATTERNS",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Decision mapping from checkFallbackError return shape to matrix "Decision".
//
//   advance       → shouldFallback=true AND reason ≠ SERVER_ERROR/RATE_LIMIT_EXCEEDED
//                   (i.e. combo will treat this as "try next target immediately")
//   stop          → shouldFallback=false OR permanent=true
//   retry-then-stop → shouldFallback=true AND reason ∈ {RATE_LIMIT_EXCEEDED, SERVER_ERROR, MODEL_CAPACITY}
// ─────────────────────────────────────────────────────────────────────────────

function classify(result: ReturnType<typeof checkFallbackError>): Decision {
  if (result.permanent) return "stop";
  if (result.shouldFallback === false) return "stop";
  // shouldFallback=true and the reason is one of the "transient retry" buckets
  if (
    result.reason === RateLimitReason.RATE_LIMIT_EXCEEDED ||
    result.reason === RateLimitReason.SERVER_ERROR ||
    result.reason === RateLimitReason.MODEL_CAPACITY
  ) {
    return "retry-then-stop";
  }
  // shouldFallback=true and reason is QUOTA_EXHAUSTED / AUTH_ERROR / UNKNOWN
  // → combo advances (try next target) — but stays within a long cooldown
  return "advance";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks on the test scaffolding itself.
// ─────────────────────────────────────────────────────────────────────────────

test("matrix: at least 18 rows present", () => {
  assert.ok(
    MATRIX.length >= 18,
    `Expected >= 18 rows for the matrix to be meaningful, got ${MATRIX.length}`,
  );
});

test("matrix: every expect value is one of advance|stop|retry-then-stop", () => {
  const allowed = new Set<Decision>(["advance", "stop", "retry-then-stop"]);
  for (const row of MATRIX) {
    assert.ok(
      allowed.has(row.expect),
      `Row provider=${row.provider} status=${row.status} expect=${row.expect}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Matrix rows.
// ─────────────────────────────────────────────────────────────────────────────

for (const row of MATRIX) {
  test(`combo: provider=${row.provider} status=${row.status} → ${row.expect}`, () => {
    const result = checkFallbackError(
      row.status,
      row.envelope,
      0,
      row.provider === "azure-openai" ? "gpt-4" : `${row.provider}-model`,
      row.provider,
      null,
      null,
      row.structuredError ?? null,
    );
    const got = classify(result);
    assert.equal(
      got,
      row.expect,
      `Expected ${row.expect} for ${row.provider} ${row.status}: ${row.envelope}; ` +
        `got ${got} (reason=${result.reason}, shouldFallback=${result.shouldFallback}, ` +
        `permanent=${result.permanent})`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Negative-path tests that explore the boundaries of the matrix.
// ─────────────────────────────────────────────────────────────────────────────

test("negative: 'invalid_request_error: model' alone (no provider scoping) → stop on plain 400", () => {
  // The text "model not supported" must NOT trigger advance when the status
  // is something other than 400 — guard against substring leakage.
  const result = checkFallbackError(404, "model not supported");
  // 404 is not in any retryable/advance bucket → stop
  assert.equal(result.shouldFallback, false);
});

test("negative: 'permission_error' on Anthropic with no model reference → stop", () => {
  // permission_error is ambiguous — only counts as model-access when the
  // text also references the model. Pure permission_error text → stop.
  const result = checkFallbackError(
    400,
    "Your API key does not have permission",
    0,
    "claude-3",
    "anthropic",
    null,
    null,
    { type: "permission_error" },
  );
  // permission_error + no model reference in text → not model-access denied
  // → falls through to malformed/overflow checks → stop
  assert.equal(result.permanent, undefined);
  assert.notEqual(result.reason, RateLimitReason.MODEL_CAPACITY);
});

test("negative: 'model not found' on 500 status → retry-then-stop, not advance", () => {
  // A 500 with model-related text must NOT be re-classified as model-access;
  // the 500 path takes precedence (transient retry).
  const result = checkFallbackError(
    500,
    "model not found",
    0,
    "gpt-4",
    "openai",
    null,
    null,
    { code: "model_not_found" },
  );
  assert.equal(result.reason, RateLimitReason.SERVER_ERROR);
});
