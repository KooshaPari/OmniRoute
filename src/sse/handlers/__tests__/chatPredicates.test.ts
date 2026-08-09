/**
 * chatPredicates.test.ts — unit tests for the chatPredicates helper.
 *
 * Verifies the three exports of chatPredicates.ts:
 *   - PROVIDER_BREAKER_FAILURE_STATUSES
 *   - isProviderBreakerFailureStatus(status)
 *   - PROVIDER_BREAKER_FAILURE_STATUSES_SORTED
 *
 * Pins the exact set so any future addition is caught immediately, and
 * covers the predicate function's happy paths + boundary cases.
 */
import { describe, expect, it } from "vitest";
import {
  PROVIDER_BREAKER_FAILURE_STATUSES,
  isProviderBreakerFailureStatus,
  PROVIDER_BREAKER_FAILURE_STATUSES_SORTED,
} from "../chatPredicates";

describe("chatPredicates.PROVIDER_BREAKER_FAILURE_STATUSES", () => {
  it("contains exactly [408, 500, 502, 503, 504]", () => {
    expect([...PROVIDER_BREAKER_FAILURE_STATUSES].sort((a, b) => a - b)).toEqual([
      408, 500, 502, 503, 504,
    ]);
  });

  it("contains 408 (client-request timeout)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(408)).toBe(true);
  });

  it("contains 500 (generic upstream crash)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(500)).toBe(true);
  });

  it("contains 502 (bad gateway)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(502)).toBe(true);
  });

  it("contains 503 (service unavailable)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(503)).toBe(true);
  });

  it("contains 504 (gateway timeout)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(504)).toBe(true);
  });

  it("does NOT contain 429 (handled by cooldown layer)", () => {
    // Documented architectural divergence.
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(429)).toBe(false);
  });

  it("does NOT contain Cloudflare transient codes 520/522/524/529", () => {
    // Documented architectural divergence.
    for (const code of [520, 522, 524, 529]) {
      expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(code)).toBe(false);
    }
  });

  it("does NOT contain 200 (success)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(200)).toBe(false);
  });

  it("does NOT contain 400 (client error — different layer)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(400)).toBe(false);
  });

  it("does NOT contain 401 (auth — different layer)", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.has(401)).toBe(false);
  });

  it("size is exactly 5", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES.size).toBe(5);
  });
});

describe("chatPredicates.isProviderBreakerFailureStatus", () => {
  it("returns true for codes in the set", () => {
    for (const code of [408, 500, 502, 503, 504]) {
      expect(isProviderBreakerFailureStatus(code)).toBe(true);
    }
  });

  it("returns false for codes NOT in the set", () => {
    for (const code of [200, 400, 401, 403, 404, 429, 520, 522, 524, 529]) {
      expect(isProviderBreakerFailureStatus(code)).toBe(false);
    }
  });

  it("returns false for boundary codes 0, 999, NaN", () => {
    expect(isProviderBreakerFailureStatus(0)).toBe(false);
    expect(isProviderBreakerFailureStatus(999)).toBe(false);
    expect(Number.isNaN(isProviderBreakerFailureStatus(NaN))).toBe(true);
  });

  it("returns equivalent result to PROVIDER_BREAKER_FAILURE_STATUSES.has", () => {
    // Property test: for every integer in [-1, 600], the predicate and the
    // Set membership must agree. Catches any future divergence.
    for (let code = -1; code <= 600; code++) {
      expect(isProviderBreakerFailureStatus(code)).toBe(
        PROVIDER_BREAKER_FAILURE_STATUSES.has(code),
      );
    }
  });
});

describe("chatPredicates.PROVIDER_BREAKER_FAILURE_STATUSES_SORTED", () => {
  it("is sorted ascending", () => {
    for (let i = 1; i < PROVIDER_BREAKER_FAILURE_STATUSES_SORTED.length; i++) {
      expect(PROVIDER_BREAKER_FAILURE_STATUSES_SORTED[i]).toBeGreaterThan(
        PROVIDER_BREAKER_FAILURE_STATUSES_SORTED[i - 1],
      );
    }
  });

  it("equals exactly [408, 500, 502, 503, 504]", () => {
    expect(PROVIDER_BREAKER_FAILURE_STATUSES_SORTED).toEqual([
      408, 500, 502, 503, 504,
    ]);
  });

  it("is readonly (no mutations)", () => {
    // TypeScript would prevent this at compile time, but runtime check
    // catches accidental `as any` casts.
    expect(() => {
      (PROVIDER_BREAKER_FAILURE_STATUSES_SORTED as number[]).push(999);
    }).toThrow();
  });
});
