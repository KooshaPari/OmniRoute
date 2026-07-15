// @vitest-environment node
/**
 * rateLimitHeaders.test.ts — unit tests for the pure parser extracted from
 * rateLimitManager.ts. Tests cover:
 *
 *   - parseResetTime: duration strings, numbers, Unix timestamps, ISO dates, invalid input
 *   - toPlainHeaders: Headers-like object, Map, plain object, null/undefined
 *   - extractRateLimitSignal: STANDARD vs ANTHROPIC header families, 429 detection, overLimit
 *   - signalToLimiterUpdates: low-headroom throttling, plenty-of-headroom relaxation,
 *     hard/soft limit bypass, no-limit returns null
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;

import {
  parseResetTime,
  toPlainHeaders,
  extractRateLimitSignal,
  signalToLimiterUpdates,
  pickHeaderSetForProvider,
  STANDARD_HEADERS,
  ANTHROPIC_HEADERS,
} from "../../../open-sse/services/rateLimitHeaders.ts";

// ---------------------------------------------------------------------------
// parseResetTime
// ---------------------------------------------------------------------------

it("parseResetTime: duration strings", () => {
  expect(parseResetTime("1s")).toBe(1_000);
  expect(parseResetTime("500ms")).toBe(500);
  expect(parseResetTime("2m")).toBe(120_000);
  expect(parseResetTime("1h")).toBe(3_600_000);
  expect(parseResetTime("1m30s")).toBe(90_000);
  expect(parseResetTime("2h15m")).toBe(2 * 3_600_000 + 15 * 60_000);
});

it("parseResetTime: pure number is treated as seconds", () => {
  expect(parseResetTime("60")).toBe(60_000);
  expect(parseResetTime("0.5")).toBe(500);
});

it("parseResetTime: number > year 2025 is treated as Unix timestamp", () => {
  const future = Date.now() + 60_000;
  const ts = Math.floor(future / 1000);
  const result = parseResetTime(String(ts));
  expect(result != null, "result must be non-null for valid timestamp");
  // Allow ±2s slack for test execution time
  expect(Math.abs(result! - 60_000) < 2_000, `expected ~60s, got ${result}`);
});

it("parseResetTime: ISO date string", () => {
  const future = new Date(Date.now() + 30_000).toISOString();
  const result = parseResetTime(future);
  expect(result != null);
  expect(Math.abs(result! - 30_000) < 2_000, `expected ~30s, got ${result}`);
});

it("parseResetTime: invalid inputs return null", () => {
  expect(parseResetTime("")).toBe(null);
  expect(parseResetTime(null)).toBe(null);
  expect(parseResetTime(undefined)).toBe(null);
  expect(parseResetTime("not-a-date")).toBe(null);
  expect(parseResetTime("0"), null); // tightened behavior (original returned 0).toBe(callers used `|| 60000` to mask)
  expect(parseResetTime(-5)).toBe(null);
});

// ---------------------------------------------------------------------------
// toPlainHeaders
// ---------------------------------------------------------------------------

it("toPlainHeaders: Headers-like (forEach)", () => {
  const fakeHeaders = {
    forEach(cb) {
      cb("100", "x-ratelimit-limit-requests");
      cb("99", "x-ratelimit-remaining-requests");
    },
  };
  const out = toPlainHeaders(fakeHeaders);
  expect(out["x-ratelimit-limit-requests"]).toBe("100");
  expect(out["x-ratelimit-remaining-requests"]).toBe("99");
});

it("toPlainHeaders: Map (entries)", () => {
  const m = new Map<string, string>([["Retry-After", "30"]]);
  const out = toPlainHeaders(m);
  expect(out["retry-after"]).toBe("30");
});

it("toPlainHeaders: plain object", () => {
  const obj = { "X-Foo-Bar": "baz" };
  const out = toPlainHeaders(obj);
  expect(out["x-foo-bar"]).toBe("baz");
});

it("toPlainHeaders: null/undefined returns empty", () => {
  expect(toPlainHeaders(null)).toEqual({});
  expect(toPlainHeaders(undefined)).toEqual({});
  expect(toPlainHeaders(0)).toEqual({});
});

// ---------------------------------------------------------------------------
// pickHeaderSetForProvider
// ---------------------------------------------------------------------------

it("pickHeaderSetForProvider: claude/anthropic → ANTHROPIC_HEADERS", () => {
  expect(pickHeaderSetForProvider("claude"), ANTHROPIC_HEADERS);
  expect(pickHeaderSetForProvider("anthropic"), ANTHROPIC_HEADERS);
});

it("pickHeaderSetForProvider: everything else → STANDARD_HEADERS", () => {
  expect(pickHeaderSetForProvider("openai"), STANDARD_HEADERS);
  expect(pickHeaderSetForProvider("groq"), STANDARD_HEADERS);
  expect(pickHeaderSetForProvider("fireworks"), STANDARD_HEADERS);
  expect(pickHeaderSetForProvider(""), STANDARD_HEADERS);
});

// ---------------------------------------------------------------------------
// extractRateLimitSignal
// ---------------------------------------------------------------------------

it("extractRateLimitSignal: OpenAI headers (STANDARD)", () => {
  const headers = {
    "x-ratelimit-limit-requests": "60",
    "x-ratelimit-remaining-requests": "45",
    "x-ratelimit-reset-requests": "30s",
    "x-ratelimit-limit-tokens": "150000",
    "x-ratelimit-remaining-tokens": "120000",
    "x-ratelimit-over-limit": "no",
  };
  const sig = extractRateLimitSignal(headers, 200, "openai");
  expect(sig.limit).toBe(60);
  expect(sig.remaining).toBe(45);
  expect(sig.resetMs).toBe(30_000);
  expect(sig.limitTokens).toBe(150_000);
  expect(sig.remainingTokens).toBe(120_000);
  expect(sig.overLimit).toBe(false);
  expect(sig.isHardLimit).toBe(false);
});

it("extractRateLimitSignal: Anthropic headers", () => {
  const headers = {
    "anthropic-ratelimit-requests-limit": "100",
    "anthropic-ratelimit-requests-remaining": "75",
    "anthropic-ratelimit-requests-reset": "1m",
    "anthropic-ratelimit-input-tokens-limit": "100000",
    "anthropic-ratelimit-input-tokens-remaining": "80000",
  };
  const sig = extractRateLimitSignal(headers, 200, "claude");
  expect(sig.limit).toBe(100);
  expect(sig.remaining).toBe(75);
  expect(sig.resetMs).toBe(60_000);
  expect(sig.limitTokens).toBe(100_000);
  expect(sig.remainingTokens).toBe(80_000);
  expect(sig.overLimit).toBe(false);
  expect(sig.isHardLimit).toBe(false);
});

it("extractRateLimitSignal: 429 → isHardLimit=true", () => {
  const headers = { "retry-after": "60" };
  const sig = extractRateLimitSignal(headers, 429, "openai");
  expect(sig.isHardLimit).toBe(true);
  expect(sig.retryAfterMs).toBe(60_000);
  expect(sig.resetMs).toBe(null); // no per-family reset header in this test fixture
});

it("extractRateLimitSignal: overLimit=yes (Fireworks)", () => {
  const headers = { "x-ratelimit-over-limit": "yes", "x-ratelimit-limit-requests": "60" };
  const sig = extractRateLimitSignal(headers, 200, "fireworks");
  expect(sig.overLimit).toBe(true);
  expect(sig.limit).toBe(60);
});

it("extractRateLimitSignal: missing headers → null fields", () => {
  const sig = extractRateLimitSignal({}, 200, "openai");
  expect(sig.limit).toBe(null);
  expect(sig.remaining).toBe(null);
  expect(sig.resetMs).toBe(null);
  expect(sig.overLimit).toBe(false);
  expect(sig.isHardLimit).toBe(false);
});

// ---------------------------------------------------------------------------
// signalToLimiterUpdates
// ---------------------------------------------------------------------------

it("signalToLimiterUpdates: normal case — moderate headroom, set minTime only", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 30,
    resetMs: 60_000,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: false,
  };
  const updates = signalToLimiterUpdates(sig);
  expect(updates !== null);
  // 60000/60 = 1000, minus 10 = 990ms minTime
  expect(updates!.minTime).toBe(990);
  expect(updates!.reservoir).toBe(undefined);
});

it("signalToLimiterUpdates: low headroom — switch to reservoir mode", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 3, // 5% of 60
    resetMs: 60_000,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: false,
  };
  const updates = signalToLimiterUpdates(sig);
  expect(updates !== null);
  expect(updates!.reservoir).toBe(3);
  expect(updates!.reservoirRefreshAmount).toBe(60);
  expect(updates!.reservoirRefreshInterval).toBe(60_000);
});

it("signalToLimiterUpdates: plenty of headroom — relax everything", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 40, // 67% of 60
    resetMs: 60_000,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: false,
  };
  const updates = signalToLimiterUpdates(sig);
  expect(updates !== null);
  expect(updates!.minTime).toBe(0);
  expect(updates!.reservoir).toBe(null);
  expect(updates!.reservoirRefreshAmount).toBe(null);
  expect(updates!.reservoirRefreshInterval).toBe(null);
});

it("signalToLimiterUpdates: hard-limit (429) → returns null (caller handles eviction)", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 0,
    resetMs: 60_000,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: true,
  };
  expect(signalToLimiterUpdates(sig)).toBe(null);
});

it("signalToLimiterUpdates: overLimit soft warning → returns null (caller adds 200ms minTime)", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 30,
    resetMs: 60_000,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: true,
    isHardLimit: false,
  };
  expect(signalToLimiterUpdates(sig)).toBe(null);
});

it("signalToLimiterUpdates: missing limit header → returns null", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: null,
    remaining: null,
    resetMs: null,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: false,
  };
  expect(signalToLimiterUpdates(sig)).toBe(null);
});

it("signalToLimiterUpdates: low headroom with no resetMs falls back to 60s default", () => {
  const sig: Parameters<typeof signalToLimiterUpdates>[0] = {
    limit: 60,
    remaining: 3,
    resetMs: null,
    limitTokens: null,
    remainingTokens: null,
    resetTokensMs: null,
    overLimit: false,
    isHardLimit: false,
  };
  const updates = signalToLimiterUpdates(sig);
  expect(updates !== null);
  expect(updates!.reservoirRefreshInterval).toBe(60_000);
});