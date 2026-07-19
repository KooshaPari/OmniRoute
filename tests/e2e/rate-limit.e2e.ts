/**
 * E2E: Rate Limiter
 *
 * Exercises checkRateLimit() with the real RateLimitRule[] API.
 * Verifies that requests beyond the limit are rejected.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  setRateLimiterTestMode,
} from "@/shared/utils/rateLimiter";

const WINDOW_S = 1; // 1-second window

let testKey: string;

beforeEach(() => {
  testKey = `rl-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setRateLimiterTestMode(true);
});

describe("E2E: checkRateLimit (limit=5, window=1s)", () => {
  it("allows requests within the limit", async () => {
    const rules = [{ limit: 5, window: WINDOW_S }];
    for (let i = 1; i <= 5; i++) {
      const result = await checkRateLimit(testKey, rules);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects the 6th request in the same window", async () => {
    const rules = [{ limit: 5, window: WINDOW_S }];
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(testKey, rules);
    }
    const result = await checkRateLimit(testKey, rules);
    expect(result.allowed).toBe(false);
    expect(result.failedWindow).toBe(WINDOW_S);
  });

  it("isolates different keys", async () => {
    const rules = [{ limit: 2, window: WINDOW_S }];
    const otherKey = `${testKey}-other`;

    // Exhaust first key
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(testKey, rules);
    }
    const rejected = await checkRateLimit(testKey, rules);
    expect(rejected.allowed).toBe(false);

    // Second key should still be fully available
    const other = await checkRateLimit(otherKey, rules);
    expect(other.allowed).toBe(true);
  });

  it("allows requests again after the window elapses", async () => {
    const shortWindow = 1; // 1 second
    const rules = [{ limit: 2, window: shortWindow }];
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(testKey, rules);
    }
    const rejected = await checkRateLimit(testKey, rules);
    expect(rejected.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, (shortWindow + 1) * 1000));

    const allowed = await checkRateLimit(testKey, rules);
    expect(allowed.allowed).toBe(true);
  });
});
