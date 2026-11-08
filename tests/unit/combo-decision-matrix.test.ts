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
 * ── AUDIT (2026-10-27) ──────────────────────────────────────────────────────
 * The original rows were written against an imagined upstream PR-β contract
 * and were never true of this fork's code: at the commit that introduced this
 * file (1d94ebb642, 2026-08-09) `checkFallbackError` already returned
 * `{ shouldFallback: true, cooldownMs: 0, reason: MODEL_CAPACITY }` for every
 * 400 the rows expected to "stop". That branch dates to #2101/#4279/#4519 and
 * is pinned by four issue-specific suites that pass today
 * (combo-body-specific-400-stop-4279, combo-model-scoped-400-advance,
 * combo-param-validation-fallback-4519, combo-terminal-status-policy-10501).
 * The file was restored verbatim by bf65512098 and 6b14884af4, so the false
 * expectations came back with it.
 *
 * Two defects kept it red besides the stale expectations:
 *   1. `classify()` mapped MODEL_CAPACITY to "retry-then-stop", but
 *      MODEL_CAPACITY is also the #2101 *zero-cooldown* 400 advance reason.
 *      The decision has to be read from `cooldownMs`, not the reason alone.
 *   2. A 400 "stop" is a COMBO decision (body-specific guard #4279), not an
 *      account-fallback decision. Reading `checkFallbackError` alone can never
 *      see it, so `shouldSurfaceBodySpecific400` is part of the classifier now.
 *
 * The matrix below is the real contract, with each row's citation in the
 * comment. Nothing is weakened: every row still asserts one exact decision and
 * the suite additionally pins the reason/cooldown bucket behind it.
 */
import test from "node:test";
import assert from "node:assert/strict";

const accountFallback = await import("../../open-sse/services/accountFallback.ts");
const { checkFallbackError } = accountFallback;
const { shouldSurfaceBodySpecific400 } =
  await import("../../open-sse/services/combo/executeTargetClassify.ts");
const { RateLimitReason } = await import("../../open-sse/config/constants.ts");

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
    expect: "advance",
    comment:
      "Overflow 400 — zero-cooldown MODEL_CAPACITY (#4519); a larger-context target may accept it",
  },
  {
    provider: "openai",
    status: 400,
    envelope: "messages: parameter is illegal",
    expect: "advance",
    comment:
      "Param-validation 400 — zero-cooldown MODEL_CAPACITY (#4519), excluded from the #4279 stop guard",
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

  // ── 401 advance — the account is cooled down and combo keeps going ──────
  {
    provider: "openai",
    status: 401,
    envelope: "Unauthorized",
    expect: "advance",
    comment: "Auth error rotates the account out (AUTH_ERROR); it is not a combo-terminal stop",
  },
  {
    provider: "anthropic",
    status: 401,
    envelope: "Invalid API Key",
    expect: "advance",
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

  // ── 429 advance — quota exhausted (long cooldown, account rotates) ──────
  {
    provider: "antigravity",
    status: 429,
    envelope:
      "Individual quota reached. Contact your administrator to enable overages. Resets in 164h27m24s.",
    expect: "advance",
    comment:
      "Quota-exhausted 429 → QUOTA_EXHAUSTED cooldown; other accounts/targets may still serve",
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

  // ── 503 advance — quota exhausted via the 503 back-channel ─────────────
  {
    provider: "anthropic",
    status: 503,
    envelope: '{"error":{"type":"insufficient_quota","message":"quota exhausted"}}',
    expect: "advance",
    comment:
      "503 quota-exhaustion → QUOTA_EXHAUSTED (credits) with a long cooldown, not a 5xx retry",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Decision mapping: account-fallback verdict + the combo's body-specific guard.
//
//   stop            → account fallback is off OR permanent, OR the combo's #4279
//                     body-specific 400 guard surfaces the error instead of
//                     trying another target.
//   advance         → the candidate is cooldown-free (zero cooldown) or the
//                     account rotates out while combo keeps going: quota
//                     exhausted / auth error (#2101 zero-cooldown 400s, long
//                     quota cooldowns).
//   retry-then-stop → transient buckets (429 / 5xx) and unknown-status
//                     transient cooldowns: combo retries, then propagates.
//
// MODEL_CAPACITY is deliberately NOT read as "transient" on its own: the 400
// advance path (#2101) and the 503 transient path share that reason, and only
// the cooldown distinguishes them.
// ─────────────────────────────────────────────────────────────────────────────

function classify(
  result: ReturnType<typeof checkFallbackError>,
  row: Pick<MatrixRow, "status" | "envelope">
): Decision {
  if (result.permanent) return "stop";
  if (result.shouldFallback === false) return "stop";
  if (
    shouldSurfaceBodySpecific400({
      status: row.status,
      errorText: row.envelope,
      shouldFallback: true,
    })
  ) {
    return "stop";
  }
  if (
    result.reason === RateLimitReason.RATE_LIMIT_EXCEEDED ||
    result.reason === RateLimitReason.SERVER_ERROR
  ) {
    return "retry-then-stop";
  }
  if (result.reason === RateLimitReason.MODEL_CAPACITY) {
    return result.cooldownMs === 0 ? "advance" : "retry-then-stop";
  }
  if (
    result.reason === RateLimitReason.QUOTA_EXHAUSTED ||
    result.reason === RateLimitReason.AUTH_ERROR
  ) {
    return "advance";
  }
  return result.cooldownMs === 0 ? "advance" : "retry-then-stop";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks on the test scaffolding itself.
// ─────────────────────────────────────────────────────────────────────────────

test("matrix: at least 18 rows present", () => {
  assert.ok(
    MATRIX.length >= 18,
    `Expected >= 18 rows for the matrix to be meaningful, got ${MATRIX.length}`
  );
});

test("matrix: every expect value is one of advance|stop|retry-then-stop", () => {
  const allowed = new Set<Decision>(["advance", "stop", "retry-then-stop"]);
  for (const row of MATRIX) {
    assert.ok(
      allowed.has(row.expect),
      `Row provider=${row.provider} status=${row.status} expect=${row.expect}`
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
      row.structuredError ?? null
    );
    const got = classify(result, row);
    assert.equal(
      got,
      row.expect,
      `Expected ${row.expect} for ${row.provider} ${row.status}: ${row.envelope}; ` +
        `got ${got} (reason=${result.reason}, shouldFallback=${result.shouldFallback}, ` +
        `permanent=${result.permanent})`
    );
    // Pin the mechanism, not just the label: an "advance" 400 must be the
    // zero-cooldown #2101 classification, a transient bucket must carry a
    // cooldown, and a stop must be terminal for a concrete reason.
    if (got === "advance" && row.status === 400) {
      assert.equal(result.cooldownMs, 0, "400 advance must be zero-cooldown (#2101)");
      assert.equal(result.reason, RateLimitReason.MODEL_CAPACITY);
    }
    if (got === "retry-then-stop") {
      assert.ok(result.cooldownMs > 0, "transient verdicts must carry a cooldown");
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Negative-path tests that explore the boundaries of the matrix.
// ─────────────────────────────────────────────────────────────────────────────

test("negative: 'model not supported' on a non-400 status is not model-access advance", () => {
  // The #2101 zero-cooldown advance is a 400-only path. The same text on a 404
  // must fall through to the generic transient branch: no MODEL_CAPACITY, a
  // real cooldown, and a retry-then-stop verdict (a 404 is not a "try the next
  // target right now" signal).
  const result = checkFallbackError(404, "model not supported");
  assert.equal(result.shouldFallback, true);
  assert.notEqual(result.reason, RateLimitReason.MODEL_CAPACITY);
  assert.ok(result.cooldownMs > 0, "generic unknown statuses keep a transient cooldown");
  assert.equal(
    classify(result, { status: 404, envelope: "model not supported" }),
    "retry-then-stop"
  );
});

test("negative: a plain 400 with no model/auth/malformed signal → stop", () => {
  // "invalid_request_error" alone carries no model-scoped evidence, so it is a
  // generic 400: not account-fallback-worthy and not body-specific enough for
  // the #4279 surface guard → the combo propagates it.
  const result = checkFallbackError(400, "invalid_request_error", 0, "gpt-4", "openai");
  assert.equal(result.shouldFallback, false);
  assert.equal(classify(result, { status: 400, envelope: "invalid_request_error" }), "stop");
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
    { type: "permission_error" }
  );
  // permission_error + no model reference in text → not model-access denied
  // → falls through to malformed/overflow checks → stop
  assert.equal(result.permanent, undefined);
  assert.notEqual(result.reason, RateLimitReason.MODEL_CAPACITY);
  assert.equal(result.shouldFallback, false);
  assert.equal(
    classify(result, { status: 400, envelope: "Your API key does not have permission" }),
    "stop"
  );
});

test("negative: 'model not found' on 500 status → retry-then-stop, not advance", () => {
  // A 500 with model-related text must NOT be re-classified as model-access;
  // the 500 path takes precedence (transient retry).
  const result = checkFallbackError(500, "model not found", 0, "gpt-4", "openai", null, null, {
    code: "model_not_found",
  });
  assert.equal(result.reason, RateLimitReason.SERVER_ERROR);
});
