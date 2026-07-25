/**
 * Unit tests for the extracted retry-policy module.
 *
 * Source: open-sse/services/batchProcessor/retryPolicy.ts
 *
 * The module exports five pure helpers plus a `sleep` utility:
 *   - getRetryDelayMs   — Retry-After parsing (delta-seconds & HTTP-date)
 *   - getBackoffDelayMs — exponential backoff with ±20% jitter
 *   - maybeThrottle     — derive a delay from `x-ratelimit-*` headers
 *   - throttleDelay     — pressure scalar → delay (mapped directly here
 *                         so deterministic assertions are possible)
 *   - toNumber          — defensive header coercion
 *   - sleep             — Promise-based timeout
 *
 * These tests deliberately exercise `throttleDelay` as a deterministic
 * mapping (no Math.random inside the pure envelope) so the assertions
 * can pin specific delay ranges instead of bounding them.
 *
 * Run:
 *   DISABLE_SQLITE_AUTO_BACKUP=true node_modules/.bin/vitest run \
 *     tests/unit/open-sse/batchProcessor-retryPolicy.test.ts
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getBackoffDelayMs,
  getRetryDelayMs,
  maybeThrottle,
  sleep,
  throttleDelay,
  toNumber,
} from "../../../open-sse/services/batchProcessor/retryPolicy.ts";

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("getRetryDelayMs", () => {
  it("parses delta-seconds Retry-After into milliseconds", () => {
    const headers = makeHeaders({ "retry-after": "120" });
    expect(getRetryDelayMs(headers)).toBe(120_000);
  });

  it("parses HTTP-date Retry-After and clamps negatives to zero", () => {
    // Pick a date in the past — must clamp to 0, not go negative.
    const past = new Date(Date.now() - 60_000).toUTCString();
    const headers = makeHeaders({ "retry-after": past });
    expect(getRetryDelayMs(headers)).toBe(0);
  });

  it("returns null when the header is missing entirely", () => {
    const headers = makeHeaders({});
    expect(getRetryDelayMs(headers)).toBeNull();
  });

  it("returns null when the header is unparseable garbage", () => {
    const headers = makeHeaders({ "retry-after": "not-a-date-nor-seconds" });
    expect(getRetryDelayMs(headers)).toBeNull();
  });
});

describe("getBackoffDelayMs", () => {
  it("grows exponentially with attempt number", () => {
    // Floor bound: 2^attempt * base - 20% jitter
    const a1 = getBackoffDelayMs(1);
    const a2 = getBackoffDelayMs(2);
    const a3 = getBackoffDelayMs(3);

    // Default base = 5_000, so attempts without jitter yield 10k, 20k, 40k.
    // With ±20% jitter, a1 ∈ [8_000, 12_000], etc.
    expect(a1).toBeGreaterThanOrEqual(8_000);
    expect(a1).toBeLessThanOrEqual(12_000);
    expect(a2).toBeGreaterThanOrEqual(16_000);
    expect(a2).toBeLessThanOrEqual(24_000);
    expect(a3).toBeGreaterThanOrEqual(32_000);
    expect(a3).toBeLessThanOrEqual(48_000);
  });

  it("clamps the delay at BATCH_BACKOFF_MAX_MS regardless of attempt", () => {
    // huge attempt should saturate at BATCH_BACKOFF_MAX_MS (3_600_000)
    // even with the +20% jitter bonus.
    const a50 = getBackoffDelayMs(50);
    expect(a50).toBeLessThanOrEqual(3_600_000 * 1.2 + 1);
  });

  it("always returns a non-negative integer", () => {
    // 100 random samples — must never throw and must always be int >= 0.
    for (let i = 0; i < 100; i++) {
      const d = getBackoffDelayMs(i);
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("throttleDelay", () => {
  it("returns null when pressure is at or above 20% (no throttling)", () => {
    expect(throttleDelay(0.2)).toBeNull();
    expect(throttleDelay(0.5)).toBeNull();
    expect(throttleDelay(1.0)).toBeNull();
  });

  it("returns >= 200ms when pressure is just below 20%", () => {
    // severity = 0.001/0.2 = 0.005 → delay^2 * 30_000 ≈ 0.75ms
    // total = 200 + tiny + jitter[0..1000]. Always >= 200.
    const d = throttleDelay(0.199);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThanOrEqual(200);
  });

  it("returns ~30_200ms when pressure is zero (extreme saturation)", () => {
    // severity = 1 → 1² * 30_000 = 30_000 + 200 + jitter[0..1000]
    // → bounded in [30_200, 31_200].
    const d = throttleDelay(0);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThanOrEqual(30_200);
    expect(d!).toBeLessThanOrEqual(31_200);
  });
});

describe("maybeThrottle", () => {
  it("returns null when no rate-limit headers are present", () => {
    const headers = makeHeaders({ "content-type": "application/json" });
    expect(maybeThrottle(headers)).toBeNull();
  });

  it("returns null when the request limit is zero (avoids division by zero)", () => {
    const headers = makeHeaders({
      "x-ratelimit-remaining-req-minute": "0",
      "x-ratelimit-limit-req-minute": "0",
    });
    expect(maybeThrottle(headers)).toBeNull();
  });

  it("returns null when both token pressure inputs are zero", () => {
    const headers = makeHeaders({
      "x-ratelimit-remaining-req-minute": "50",
      "x-ratelimit-limit-req-minute": "100",
      "x-ratelimit-remaining-tokens-minute": "0",
      "x-ratelimit-tokens-query-cost": "0",
    });
    expect(maybeThrottle(headers)).toBeNull();
  });

  it("returns a delay in the high-pressure range when remaining is near zero", () => {
    const headers = makeHeaders({
      "x-ratelimit-remaining-req-minute": "2",
      "x-ratelimit-limit-req-minute": "100",
      "x-ratelimit-remaining-tokens-minute": "50000",
      "x-ratelimit-tokens-query-cost": "50",
    });
    const d = maybeThrottle(headers);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThanOrEqual(20_000);
    expect(d!).toBeLessThanOrEqual(32_000);
  });

  it("returns null when pressure is comfortably above 20%", () => {
    const headers = makeHeaders({
      "x-ratelimit-remaining-req-minute": "50",
      "x-ratelimit-limit-req-minute": "100",
      "x-ratelimit-remaining-tokens-minute": "50000",
      "x-ratelimit-tokens-query-cost": "50",
    });
    expect(maybeThrottle(headers)).toBeNull();
  });

  it("tolerates malformed header values (NaN inputs)", () => {
    const headers = makeHeaders({
      "x-ratelimit-remaining-req-minute": "abc",
      "x-ratelimit-limit-req-minute": "100",
    });
    // No valid pressure signals → null. The function must not throw on NaN.
    expect(maybeThrottle(headers)).toBeNull();
  });
});

describe("toNumber", () => {
  it("returns null for null, empty, and whitespace-only inputs", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("   ")).toBeNull();
  });

  it("parses numeric strings to finite numbers", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("0")).toBe(0);
    expect(toNumber("-3.14")).toBeCloseTo(-3.14, 5);
  });

  it("returns null for non-finite or non-numeric strings", () => {
    expect(toNumber("abc")).toBeNull();
    expect(toNumber("Infinity")).toBeNull();
    expect(toNumber("NaN")).toBeNull();
  });
});

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after roughly the requested delay", async () => {
    vi.useFakeTimers();
    let resolved = false;
    const p = sleep(1_000).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(resolved).toBe(true);
  });

  it("resolves quickly with a zero delay", async () => {
    vi.useFakeTimers();
    let resolved = false;
    const p = sleep(0).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(resolved).toBe(true);
  });
});
