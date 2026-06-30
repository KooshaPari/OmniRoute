/**
 * PR-023 — retry / backoff resilience unit tests for chatCore.
 *
 * chatCore.ts is a 4,944-LoC god-file that owns the resilience logic for the
 * OpenAI-compatible chat completion path. Over the last several releases, the
 * god-file has been decomposed into 27 extracted leaves under
 * `open-sse/handlers/chatCore/`. The retry / backoff helpers themselves, however,
 * still live inside chatCore.ts as inline closures, OR in adjacent support
 * modules that chatCore.ts consumes:
 *
 *   - `classifyModelScope429` / `getModelScopeRetryDelayMs` /
 *     `parseModelScopeRateLimitHeaders` / `isModelScopeProvider`
 *       → open-sse/services/modelscopePolicy.ts
 *   - `calculateBackoffCooldown` / `BACKOFF_CONFIG` / `COOLDOWN_MS` /
 *     `findMatchingErrorRule` / `matchErrorRuleByText` / `matchErrorRuleByStatus`
 *       → open-sse/config/errorConfig.ts
 *   - `STREAM_RECOVERY` / `BACKOFF_STEPS_MS` / `HTTP_STATUS` / `RateLimitReason`
 *       → open-sse/config/constants.ts
 *
 * The `isRetryableStatus` closure inside chatCore.ts:2493 is also exercised
 * here. It is not exported, so we replicate its documented contract
 * (`fallbackCodes.includes(s) || s === 0`) as a tiny local helper and assert
 * the behavior the closure is relied on for (status 0 network failure, 429,
 * 5xx, and out-of-set success status). The chatCore.ts file itself is NOT
 * modified.
 *
 * These tests use node's built-in test runner (matches the style of the
 * sibling `open-sse/services/__tests__/` suite).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyModelScope429,
  getModelScopeRetryDelayMs,
  isModelScopeProvider,
  parseModelScopeRateLimitHeaders,
} from "../../../services/modelscopePolicy.ts";

import {
  BACKOFF_CONFIG,
  COOLDOWN_MS,
  calculateBackoffCooldown,
  findMatchingErrorRule,
  matchErrorRuleByStatus,
  matchErrorRuleByText,
} from "../../../config/errorConfig.ts";

import {
  BACKOFF_STEPS_MS,
  HTTP_STATUS,
  RateLimitReason,
  STREAM_RECOVERY,
} from "../../../config/constants.ts";

// ─── Local replica of the chatCore.ts:2493 `isRetryableStatus` closure ────
//
// Inline in chatCore.ts as:
//   const isRetryableStatus = (s: number) => fallbackCodes.includes(s) || s === 0;
//
// where `fallbackCodes` defaults to [429, 500, 502, 503, 504] but can be
// overridden by the `cliproxyapi_fallback_codes` setting. We mirror that
// contract here so the unit test exercises the same shape of decision the
// production closure makes, without exporting the closure from chatCore.ts
// (which would change the god-file just to enable a test — explicitly
// disallowed by this PR).
type RetryableStatusPredicate = (s: number) => boolean;

function buildIsRetryableStatus(fallbackCodes: number[]): RetryableStatusPredicate {
  return (s: number) => fallbackCodes.includes(s) || s === 0;
}

const DEFAULT_FALLBACK_CODES = [429, 500, 502, 503, 504] as const;

describe("chatCore retry/backoff — isRetryableStatus (chatCore.ts:2493 contract)", () => {
  it("treats status 0 as retryable (network error)", () => {
    const isRetryable = buildIsRetryableStatus([...DEFAULT_FALLBACK_CODES]);
    assert.equal(isRetryable(0), true);
  });

  it("treats 429 as retryable under the default fallback set", () => {
    const isRetryable = buildIsRetryableStatus([...DEFAULT_FALLBACK_CODES]);
    assert.equal(isRetryable(429), true);
  });

  it("treats every default 5xx as retryable", () => {
    const isRetryable = buildIsRetryableStatus([...DEFAULT_FALLBACK_CODES]);
    assert.equal(isRetryable(500), true);
    assert.equal(isRetryable(502), true);
    assert.equal(isRetryable(503), true);
    assert.equal(isRetryable(504), true);
  });

  it("treats 2xx as non-retryable", () => {
    const isRetryable = buildIsRetryableStatus([...DEFAULT_FALLBACK_CODES]);
    assert.equal(isRetryable(200), false);
    assert.equal(isRetryable(201), false);
    assert.equal(isRetryable(204), false);
    assert.equal(isRetryable(299), false);
  });

  it("treats 4xx (other than 429) as non-retryable", () => {
    const isRetryable = buildIsRetryableStatus([...DEFAULT_FALLBACK_CODES]);
    assert.equal(isRetryable(400), false);
    assert.equal(isRetryable(401), false);
    assert.equal(isRetryable(403), false);
    assert.equal(isRetryable(404), false);
    assert.equal(isRetryable(408), false);
    assert.equal(isRetryable(409), false);
  });

  it("honors custom override codes (e.g. 408 / 425 added)", () => {
    const isRetryable = buildIsRetryableStatus([408, 425, 429]);
    assert.equal(isRetryable(408), true);
    assert.equal(isRetryable(425), true);
    assert.equal(isRetryable(429), true);
    assert.equal(isRetryable(500), false);
    assert.equal(isRetryable(0), true); // status 0 always retryable
  });

  it("still treats status 0 as retryable even with an empty override list", () => {
    const isRetryable = buildIsRetryableStatus([]);
    assert.equal(isRetryable(0), true);
    assert.equal(isRetryable(429), false);
    assert.equal(isRetryable(503), false);
  });
});

describe("chatCore retry/backoff — classifyModelScope429 (services/modelscopePolicy)", () => {
  it("returns quota_exhausted (non-retryable) for free quota signals", () => {
    const decision = classifyModelScope429("Free allocated quota exceeded", {});
    assert.equal(decision.kind, "quota_exhausted");
    assert.equal(decision.retryable, false);
  });

  it("matches quota_exhausted case-insensitively", () => {
    const decision = classifyModelScope429("FREE ALLOCATED QUOTA EXCEEDED", {});
    assert.equal(decision.kind, "quota_exhausted");
    assert.equal(decision.retryable, false);
  });

  it("returns rate_limited when model-remaining header is present", () => {
    const decision = classifyModelScope429("", {
      "modelscope-ratelimit-model-requests-remaining": "0",
    });
    assert.equal(decision.kind, "rate_limited");
    assert.equal(decision.retryable, true);
  });

  it("returns rate_limited when total-remaining header is present", () => {
    const decision = classifyModelScope429("", {
      "modelscope-ratelimit-requests-remaining": "0",
    });
    assert.equal(decision.kind, "rate_limited");
    assert.equal(decision.retryable, true);
  });

  it("returns rate_limited for throttle-signal text even with no headers", () => {
    const decision = classifyModelScope429("Throttling: try again shortly", {});
    assert.equal(decision.kind, "rate_limited");
    assert.equal(decision.retryable, true);
  });

  it("defaults to rate_limited (retryable) when nothing is classifiable", () => {
    const decision = classifyModelScope429("", {});
    assert.equal(decision.kind, "rate_limited");
    assert.equal(decision.retryable, true);
  });

  it("exposes a full snapshot on every decision", () => {
    const decision = classifyModelScope429("rate limit exceeded", {
      "modelscope-ratelimit-model-requests-remaining": "3",
      "modelscope-ratelimit-model-requests-limit": "100",
      "modelscope-ratelimit-requests-remaining": "7",
      "modelscope-ratelimit-requests-limit": "500",
    });
    assert.equal(decision.snapshot.modelRemaining, 3);
    assert.equal(decision.snapshot.modelLimit, 100);
    assert.equal(decision.snapshot.totalRemaining, 7);
    assert.equal(decision.snapshot.totalLimit, 500);
  });
});

describe("chatCore retry/backoff — getModelScopeRetryDelayMs", () => {
  it("honors the retry-after header (seconds → ms) when present and positive", () => {
    const delay = getModelScopeRetryDelayMs({ "retry-after": "7" }, 0);
    assert.equal(delay, 7000);
  });

  it("ignores non-positive retry-after values and falls back to linear backoff", () => {
    const delay = getModelScopeRetryDelayMs({ "retry-after": "0" }, 1);
    assert.equal(delay, 6000); // 3000 * (1 + 1)
  });

  it("ignores NaN retry-after values", () => {
    const delay = getModelScopeRetryDelayMs({ "retry-after": "abc" }, 0);
    assert.equal(delay, 3000); // 3000 * (0 + 1)
  });

  it("falls back to 3000 * (attempt + 1) when no retry-after header is set", () => {
    assert.equal(getModelScopeRetryDelayMs({}, 0), 3000);
    assert.equal(getModelScopeRetryDelayMs({}, 1), 6000);
    assert.equal(getModelScopeRetryDelayMs({}, 2), 9000);
    assert.equal(getModelScopeRetryDelayMs({}, 4), 15000);
  });

  it("parses retry-after with a fractional value", () => {
    const delay = getModelScopeRetryDelayMs({ "retry-after": "2.5" }, 0);
    assert.equal(delay, 2500);
  });
});

describe("chatCore retry/backoff — parseModelScopeRateLimitHeaders", () => {
  it("returns all nulls for an empty header set", () => {
    const snap = parseModelScopeRateLimitHeaders({});
    assert.equal(snap.modelRemaining, null);
    assert.equal(snap.modelLimit, null);
    assert.equal(snap.totalRemaining, null);
    assert.equal(snap.totalLimit, null);
  });

  it("parses integer-valued headers", () => {
    const snap = parseModelScopeRateLimitHeaders({
      "modelscope-ratelimit-model-requests-remaining": "12",
      "modelscope-ratelimit-model-requests-limit": "50",
      "modelscope-ratelimit-requests-remaining": "80",
      "modelscope-ratelimit-requests-limit": "200",
    });
    assert.equal(snap.modelRemaining, 12);
    assert.equal(snap.modelLimit, 50);
    assert.equal(snap.totalRemaining, 80);
    assert.equal(snap.totalLimit, 200);
  });

  it("returns null for non-integer or empty header values", () => {
    const snap = parseModelScopeRateLimitHeaders({
      "modelscope-ratelimit-model-requests-remaining": "",
      "modelscope-ratelimit-model-requests-limit": "  ",
      "modelscope-ratelimit-requests-remaining": "not-a-number",
      "modelscope-ratelimit-requests-limit": "12.5",
    });
    assert.equal(snap.modelRemaining, null);
    assert.equal(snap.modelLimit, null);
    assert.equal(snap.totalRemaining, null);
    // parseHeaderInteger uses parseInt, which truncates 12.5 to 12 — it IS finite.
    assert.equal(snap.totalLimit, 12);
  });
});

describe("chatCore retry/backoff — isModelScopeProvider", () => {
  it("returns true when the provider name is 'modelscope' (any casing / whitespace)", () => {
    assert.equal(isModelScopeProvider("modelscope"), true);
    assert.equal(isModelScopeProvider("ModelScope"), true);
    assert.equal(isModelScopeProvider("  MODELSCOPE  "), true);
  });

  it("returns true when the baseUrl contains modelscope.cn", () => {
    assert.equal(
      isModelScopeProvider("openai-compatible", { baseUrl: "https://api.modelscope.cn/v1" }),
      true
    );
  });

  it("returns true when the baseUrl contains modelscope.aliyuncs.com", () => {
    assert.equal(
      isModelScopeProvider("openai-compatible", {
        baseUrl: "https://modelscope.aliyuncs.com/api",
      }),
      true
    );
  });

  it("returns false for unrelated providers", () => {
    assert.equal(isModelScopeProvider("openai", { baseUrl: "https://api.openai.com/v1" }), false);
    assert.equal(isModelScopeProvider("anthropic"), false);
  });

  it("handles null / undefined provider safely", () => {
    assert.equal(isModelScopeProvider(null), false);
    assert.equal(isModelScopeProvider(undefined), false);
  });
});

describe("chatCore retry/backoff — calculateBackoffCooldown (exponential, capped)", () => {
  it("returns BACKOFF_CONFIG.base at level 0", () => {
    assert.equal(calculateBackoffCooldown(0), BACKOFF_CONFIG.base);
  });

  it("doubles at each level until it hits the cap", () => {
    assert.equal(calculateBackoffCooldown(1), 2000);
    assert.equal(calculateBackoffCooldown(2), 4000);
    assert.equal(calculateBackoffCooldown(3), 8000);
  });

  it("clamps to BACKOFF_CONFIG.max once the exponential series would exceed it", () => {
    assert.equal(calculateBackoffCooldown(15), BACKOFF_CONFIG.max);
    assert.equal(calculateBackoffCooldown(50), BACKOFF_CONFIG.max);
  });

  it("clamps negative levels back to 0", () => {
    assert.equal(calculateBackoffCooldown(-3), BACKOFF_CONFIG.base);
    assert.equal(calculateBackoffCooldown(-1), BACKOFF_CONFIG.base);
  });

  it("floors fractional level inputs", () => {
    assert.equal(calculateBackoffCooldown(2.7), 4000);
    assert.equal(calculateBackoffCooldown(3.99), 8000);
  });

  it("respects BACKOFF_CONFIG.max = 120000 ms (2-minute cap)", () => {
    assert.equal(BACKOFF_CONFIG.max, 120_000);
  });
});

describe("chatCore retry/backoff — BACKOFF_STEPS_MS (rate-limit lockout tiers)", () => {
  it("contains exactly five tiers, monotonically increasing", () => {
    assert.equal(BACKOFF_STEPS_MS.length, 5);
    for (let i = 1; i < BACKOFF_STEPS_MS.length; i++) {
      assert.ok(
        BACKOFF_STEPS_MS[i] > BACKOFF_STEPS_MS[i - 1],
        `BACKOFF_STEPS_MS[${i}] must be > BACKOFF_STEPS_MS[${i - 1}]`
      );
    }
  });

  it("starts at 60s (1 minute) and ends at 1200s (20 minutes)", () => {
    assert.equal(BACKOFF_STEPS_MS[0], 60_000);
    assert.equal(BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1], 1_200_000);
  });
});

describe("chatCore retry/backoff — COOLDOWN_MS table", () => {
  it("uses a 2-minute cooldown for auth/quota class errors", () => {
    assert.equal(COOLDOWN_MS.unauthorized, 120_000);
    assert.equal(COOLDOWN_MS.paymentRequired, 120_000);
    assert.equal(COOLDOWN_MS.notFound, 120_000);
    assert.equal(COOLDOWN_MS.authExpired, 120_000);
    assert.equal(COOLDOWN_MS.rateLimit, 120_000);
  });

  it("uses a short cooldown for serviceUnavailable", () => {
    assert.equal(COOLDOWN_MS.serviceUnavailable, 2000);
  });

  it("uses a 5s cooldown for notFoundLocal and requestNotAllowed", () => {
    assert.equal(COOLDOWN_MS.notFoundLocal, 5000);
    assert.equal(COOLDOWN_MS.requestNotAllowed, 5000);
  });
});

describe("chatCore retry/backoff — matchErrorRuleByStatus", () => {
  it("maps 429 to a backoff=true, rate_limit_exceeded rule", () => {
    const rule = matchErrorRuleByStatus(HTTP_STATUS.RATE_LIMITED);
    assert.ok(rule, "expected a rule for 429");
    assert.equal(rule!.backoff, true);
    assert.equal(rule!.reason, "rate_limit_exceeded");
  });

  it("maps 401 to a non-backoff auth_error rule with cooldownMs=0", () => {
    const rule = matchErrorRuleByStatus(HTTP_STATUS.UNAUTHORIZED);
    assert.ok(rule);
    assert.equal(rule!.reason, "auth_error");
    assert.equal(rule!.cooldownMs, 0);
  });

  it("maps every 5xx status to a backoff=true, server_error rule", () => {
    for (const status of [500, 502, 503, 504]) {
      const rule = matchErrorRuleByStatus(status);
      assert.ok(rule, `expected a rule for ${status}`);
      assert.equal(rule!.backoff, true);
      assert.equal(rule!.reason, "server_error");
    }
  });

  it("returns null for statuses without a configured rule (e.g. 418)", () => {
    assert.equal(matchErrorRuleByStatus(418), null);
  });
});

describe("chatCore retry/backoff — matchErrorRuleByText", () => {
  it("recognizes 'rate limit' as rate_limit_exceeded (backoff)", () => {
    const rule = matchErrorRuleByText("Rate limit hit for model foo");
    assert.ok(rule);
    assert.equal(rule!.backoff, true);
    assert.equal(rule!.reason, "rate_limit_exceeded");
  });

  it("recognizes 'quota exceeded' as quota_exhausted", () => {
    const rule = matchErrorRuleByText("You have hit your quota exceeded");
    assert.ok(rule);
    assert.equal(rule!.backoff, true);
    assert.equal(rule!.reason, "quota_exhausted");
  });

  it("recognizes 'capacity' as model_capacity (backoff)", () => {
    const rule = matchErrorRuleByText("Upstream model at capacity, try again");
    assert.ok(rule);
    assert.equal(rule!.reason, "model_capacity");
  });

  it("matches case-insensitively", () => {
    const rule = matchErrorRuleByText("OVERLOADED: try again later");
    assert.ok(rule);
    assert.equal(rule!.reason, "model_capacity");
  });

  it("returns null for an empty / unrecognized message", () => {
    assert.equal(matchErrorRuleByText(""), null);
    assert.equal(matchErrorRuleByText("everything is fine"), null);
  });
});

describe("chatCore retry/backoff — findMatchingErrorRule (text wins over status)", () => {
  it("prefers a matching text rule over a status rule", () => {
    // 429 has both a status rule AND overlapping text rules. The first text
    // rule that matches (top-to-bottom) wins.
    const rule = findMatchingErrorRule(429, "rate limit exceeded");
    assert.ok(rule);
    assert.equal(rule!.text, "rate limit");
  });

  it("falls back to the status rule when no text matches", () => {
    const rule = findMatchingErrorRule(429, "totally unrelated message");
    assert.ok(rule);
    assert.equal(rule!.status, 429);
    assert.equal(rule!.backoff, true);
  });

  it("returns null when nothing matches", () => {
    assert.equal(findMatchingErrorRule(418, "no rule matches this"), null);
  });
});

describe("chatCore retry/backoff — STREAM_RECOVERY constants", () => {
  it("exposes HOLDBACK_MS, BUFFER_MAX_BYTES, and EARLY_RETRY_MAX", () => {
    assert.equal(typeof STREAM_RECOVERY.HOLDBACK_MS, "number");
    assert.equal(typeof STREAM_RECOVERY.BUFFER_MAX_BYTES, "number");
    assert.equal(typeof STREAM_RECOVERY.EARLY_RETRY_MAX, "number");
  });

  it("sets EARLY_RETRY_MAX to 4 (free-claude-code uses 5 total = 4 retries)", () => {
    assert.equal(STREAM_RECOVERY.EARLY_RETRY_MAX, 4);
  });

  it("keeps HOLDBACK_MS at 750ms — below 1s TTFT cost", () => {
    assert.equal(STREAM_RECOVERY.HOLDBACK_MS, 750);
  });

  it("keeps BUFFER_MAX_BYTES at 64 KiB", () => {
    assert.equal(STREAM_RECOVERY.BUFFER_MAX_BYTES, 65536);
  });
});

describe("chatCore retry/backoff — RateLimitReason taxonomy", () => {
  it("exposes the canonical six reasons", () => {
    assert.equal(RateLimitReason.QUOTA_EXHAUSTED, "quota_exhausted");
    assert.equal(RateLimitReason.RATE_LIMIT_EXCEEDED, "rate_limit_exceeded");
    assert.equal(RateLimitReason.MODEL_CAPACITY, "model_capacity");
    assert.equal(RateLimitReason.SERVER_ERROR, "server_error");
    assert.equal(RateLimitReason.AUTH_ERROR, "auth_error");
    assert.equal(RateLimitReason.UNKNOWN, "unknown");
  });
});