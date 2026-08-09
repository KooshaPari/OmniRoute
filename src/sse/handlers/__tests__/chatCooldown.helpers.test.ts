/**
 * chatCooldown.helpers.test.ts — unit tests for PR-ζ fork-original helpers.
 *
 * Verifies the three new exports of chatCooldown.ts:
 *   - createCooldownPropagationState(overrides?)
 *   - describeCooldownWait(decision)
 *   - formatWaitSeconds(waitMs)
 */
import { describe, expect, it } from "vitest";
import {
  createCooldownPropagationState,
  describeCooldownWait,
  formatWaitSeconds,
} from "../chatCooldown";

describe("chatCooldown.createCooldownPropagationState", () => {
  it("returns {0, 0} when called with no arguments", () => {
    const state = createCooldownPropagationState();
    expect(state).toEqual({ lastCooldownMs: 0, requestRetryLastCooldownMs: 0 });
  });

  it("returns a fresh object on each call (no shared mutable state)", () => {
    const a = createCooldownPropagationState();
    const b = createCooldownPropagationState();
    a.lastCooldownMs = 5000;
    expect(b.lastCooldownMs).toBe(0);
  });

  it("applies overrides to lastCooldownMs only", () => {
    const state = createCooldownPropagationState({ lastCooldownMs: 3000 });
    expect(state.lastCooldownMs).toBe(3000);
    expect(state.requestRetryLastCooldownMs).toBe(0);
  });

  it("applies overrides to requestRetryLastCooldownMs only", () => {
    const state = createCooldownPropagationState({
      requestRetryLastCooldownMs: 7000,
    });
    expect(state.lastCooldownMs).toBe(0);
    expect(state.requestRetryLastCooldownMs).toBe(7000);
  });

  it("applies both overrides", () => {
    const state = createCooldownPropagationState({
      lastCooldownMs: 1000,
      requestRetryLastCooldownMs: 2000,
    });
    expect(state).toEqual({ lastCooldownMs: 1000, requestRetryLastCooldownMs: 2000 });
  });

  it("preserves explicit zero overrides", () => {
    const state = createCooldownPropagationState({
      lastCooldownMs: 0,
      requestRetryLastCooldownMs: 0,
    });
    expect(state).toEqual({ lastCooldownMs: 0, requestRetryLastCooldownMs: 0 });
  });
});

describe("chatCooldown.formatWaitSeconds", () => {
  it("returns 0 for 0 input", () => {
    expect(formatWaitSeconds(0)).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(formatWaitSeconds(-100)).toBe(0);
    expect(formatWaitSeconds(-1)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(formatWaitSeconds(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(formatWaitSeconds(Infinity)).toBe(0);
    expect(formatWaitSeconds(-Infinity)).toBe(0);
  });

  it("returns 1 for 1ms (ceiling)", () => {
    expect(formatWaitSeconds(1)).toBe(1);
  });

  it("returns 1 for 1000ms (exactly 1 second)", () => {
    expect(formatWaitSeconds(1000)).toBe(1);
  });

  it("returns 2 for 1500ms (ceiling 1.5 → 2)", () => {
    expect(formatWaitSeconds(1500)).toBe(2);
  });

  it("returns 8 for 7500ms (ceiling 7.5 → 8)", () => {
    expect(formatWaitSeconds(7500)).toBe(8);
  });

  it("returns 60 for exactly 60_000ms", () => {
    expect(formatWaitSeconds(60_000)).toBe(60);
  });

  it("returns 60 for 59_999ms (ceiling 59.999 → 60)", () => {
    expect(formatWaitSeconds(59_999)).toBe(60);
  });

  it("returns 3600 for 3_600_000ms (1 hour)", () => {
    expect(formatWaitSeconds(3_600_000)).toBe(3600);
  });

  it("returns 86400 for 86_400_000ms (1 day)", () => {
    expect(formatWaitSeconds(86_400_000)).toBe(86_400);
  });
});

describe("chatCooldown.describeCooldownWait", () => {
  it('returns "no-retry" when shouldRetry=false', () => {
    expect(describeCooldownWait({ shouldRetry: false, waitMs: 5000 })).toBe("no-retry");
  });

  it('returns "no-retry" even with very long waitMs', () => {
    expect(
      describeCooldownWait({ shouldRetry: false, waitMs: 86_400_000 }),
    ).toBe("no-retry");
  });

  it('returns "0s" when shouldRetry=true but waitMs=0', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 0 })).toBe("0s");
  });

  it('returns "0s" when shouldRetry=true but waitMs is negative', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: -100 })).toBe("0s");
  });

  it('returns "0s" when shouldRetry=true but waitMs is NaN', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: NaN })).toBe("0s");
  });

  it('returns "1s" for 1ms wait', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 1 })).toBe("1s");
  });

  it('returns "Ns" for waits under 60s', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 5_000 })).toBe("5s");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 30_000 })).toBe("30s");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 59_999 })).toBe("60s");
  });

  it('returns "Nm" for waits in [60s, 3600s)', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 60_000 })).toBe("1m");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 90_000 })).toBe("2m");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 600_000 })).toBe("10m");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 3_599_999 })).toBe("60m");
  });

  it('returns "Nh" for exact-hour waits', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 3_600_000 })).toBe("1h");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 7_200_000 })).toBe("2h");
  });

  it('returns "NhMm" for hour-with-reminder waits', () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 3_900_000 })).toBe("1h5m");
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 5_400_000 })).toBe("1h30m");
  });

  it("returns \"1d\" or similar for very long waits (24h+)", () => {
    expect(describeCooldownWait({ shouldRetry: true, waitMs: 86_400_000 })).toBe("24h");
  });

  it("ignores retryAfterHuman when computing the label", () => {
    // The label is purely waitMs-driven; retryAfterHuman is a separate
    // human-readable hint that decideAndWaitForCooldownRetry may use
    // instead of the seconds computation.
    expect(
      describeCooldownWait({
        shouldRetry: true,
        waitMs: 5000,
        retryAfterHuman: "backoff 5s",
      }),
    ).toBe("5s");
  });

  it("always returns a non-empty string", () => {
    const inputs = [
      { shouldRetry: false, waitMs: 0 },
      { shouldRetry: true, waitMs: 0 },
      { shouldRetry: true, waitMs: -1 },
      { shouldRetry: true, waitMs: NaN },
      { shouldRetry: true, waitMs: Infinity },
      { shouldRetry: true, waitMs: 1 },
      { shouldRetry: true, waitMs: 86_400_000 },
    ];
    for (const input of inputs) {
      expect(describeCooldownWait(input).length).toBeGreaterThan(0);
    }
  });
});

describe("chatCooldown integration: factory + record + describe", () => {
  it("builds a state, records a cooldown, and describes the wait", () => {
    const state = createCooldownPropagationState();
    const recorded = recordAccountCooldown(7_500, state);
    expect(recorded).toBe(true);
    expect(state.lastCooldownMs).toBe(7_500);

    const label = describeCooldownWait({ shouldRetry: true, waitMs: 7_500 });
    expect(label).toBe("8s"); // ceiling 7.5 → 8

    const seconds = formatWaitSeconds(7_500);
    expect(seconds).toBe(8);
    expect(seconds).toBe(parseInt(label.replace(/[a-z]/g, ""), 10));
  });
});
