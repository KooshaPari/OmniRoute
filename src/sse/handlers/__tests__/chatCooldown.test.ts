/**
 * chatCooldown.test.ts — unit tests for the chatCooldown helper.
 *
 * Verifies the three outcomes returned by decideAndWaitForCooldownRetry:
 *   - "no_retry" : shouldRetry=false; falls through without waiting
 *   - "retry"    : shouldRetry=true; waits successfully; returns waitMs
 *   - "abort"    : shouldRetry=true but wait aborted by client disconnect
 *
 * Plus tests for shouldAbortOnRetryWait + recordAccountCooldown.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock the upstream cooldown-aware retry helper before importing chatCooldown.
vi.mock("../../../sse/services/cooldownAwareRetry", () => ({
  waitForCooldownAwareRetry: vi.fn(),
}));

import {
  decideAndWaitForCooldownRetry,
  shouldAbortOnRetryWait,
  recordAccountCooldown,
} from "../chatCooldown";
import { waitForCooldownAwareRetry } from "../../../sse/services/cooldownAwareRetry";

const mockedWait = vi.mocked(waitForCooldownAwareRetry);

function fakeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  } as any;
}

const baseDecision = {
  shouldRetry: true,
  waitMs: 1000,
  retryAfterHuman: "retry in 1s",
};
const baseCtx = {
  provider: "openai",
  model: "gpt-4",
  attempt: 0,
  requestSignal: undefined,
};
const baseSettings = { maxRetries: 3, budgetMs: 60_000 };

describe("chatCooldown.decideAndWaitForCooldownRetry", () => {
  beforeEach(() => {
    mockedWait.mockReset();
  });

  it("returns 'no_retry' when shouldRetry=false (skips wait entirely)", async () => {
    const log = fakeLog();
    const out = await decideAndWaitForCooldownRetry(
      { shouldRetry: false, waitMs: 1000 },
      baseCtx,
      log,
      baseSettings,
    );
    expect(out).toEqual({ outcome: "no_retry" });
    expect(mockedWait).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("returns 'retry' with waitMs when wait succeeds", async () => {
    mockedWait.mockResolvedValueOnce(true);
    const log = fakeLog();
    const out = await decideAndWaitForCooldownRetry(
      baseDecision,
      baseCtx,
      log,
      baseSettings,
    );
    expect(out).toEqual({ outcome: "retry", waitMs: 1000 });
    expect(mockedWait).toHaveBeenCalledWith(1000, undefined);
  });

  it("returns 'abort' when wait returns false (client disconnected)", async () => {
    mockedWait.mockResolvedValueOnce(false);
    const log = fakeLog();
    const out = await decideAndWaitForCooldownRetry(
      baseDecision,
      baseCtx,
      log,
      baseSettings,
    );
    expect(out).toEqual({ outcome: "abort" });
    expect(log.info).toHaveBeenCalledWith(
      "COOLDOWN_RETRY",
      expect.stringContaining("aborted by client disconnect"),
    );
  });

  it("uses retryAfterHuman in log when present, else 'retry in Ns'", async () => {
    mockedWait.mockResolvedValueOnce(true);

    const log1 = fakeLog();
    await decideAndWaitForCooldownRetry(
      { ...baseDecision, waitMs: 2500, retryAfterHuman: "backoff 2.5s" },
      baseCtx,
      log1,
      baseSettings,
    );
    expect(log1.info.mock.calls[0][1]).toContain("backoff 2.5s");

    const log2 = fakeLog();
    await decideAndWaitForCooldownRetry(
      { ...baseDecision, waitMs: 7000, retryAfterHuman: undefined },
      baseCtx,
      log2,
      baseSettings,
    );
    expect(log2.info.mock.calls[0][1]).toContain("retry in 7s");
  });

  it("computes waitSec by ceiling division (7000ms → 7s, 7500ms → 8s)", async () => {
    mockedWait.mockResolvedValue(true);
    const log = fakeLog();

    await decideAndWaitForCooldownRetry(
      { ...baseDecision, waitMs: 7000 },
      baseCtx,
      log,
      baseSettings,
    );
    expect(log.info.mock.calls[0][1]).toContain("waiting 7s");

    await decideAndWaitForCooldownRetry(
      { ...baseDecision, waitMs: 7500 },
      baseCtx,
      log,
      baseSettings,
    );
    expect(log.info.mock.calls[1][1]).toContain("waiting 8s");
  });

  it("passes attempt+1 and maxRetries into the log", async () => {
    mockedWait.mockResolvedValue(true);
    const log = fakeLog();
    await decideAndWaitForCooldownRetry(
      baseDecision,
      { ...baseCtx, attempt: 2 },
      log,
      { maxRetries: 7, budgetMs: 60_000 },
    );
    expect(log.info.mock.calls[0][1]).toContain("retry 3/7");
  });
});

describe("chatCooldown.shouldAbortOnRetryWait", () => {
  it("returns true when completed === false", () => {
    expect(shouldAbortOnRetryWait(false)).toBe(true);
  });

  it("returns false when completed === true", () => {
    expect(shouldAbortOnRetryWait(true)).toBe(false);
  });
});

describe("chatCooldown.recordAccountCooldown", () => {
  function makeState() {
    return { lastCooldownMs: 0, requestRetryLastCooldownMs: 0 };
  }

  it("returns true and propagates when cooldownMs is a positive finite number", () => {
    const state = makeState();
    const applied = recordAccountCooldown(5000, state);
    expect(applied).toBe(true);
    expect(state.lastCooldownMs).toBe(5000);
    expect(state.requestRetryLastCooldownMs).toBe(5000);
  });

  it("returns false and does NOT mutate state when cooldownMs is 0", () => {
    const state = makeState();
    const applied = recordAccountCooldown(0, state);
    expect(applied).toBe(false);
    expect(state.lastCooldownMs).toBe(0);
  });

  it("returns false when cooldownMs is negative", () => {
    const state = makeState();
    const applied = recordAccountCooldown(-100, state);
    expect(applied).toBe(false);
    expect(state.lastCooldownMs).toBe(0);
  });

  it("returns false when cooldownMs is NaN", () => {
    const state = makeState();
    const applied = recordAccountCooldown(NaN, state);
    expect(applied).toBe(false);
    expect(state.lastCooldownMs).toBe(0);
  });

  it("returns false when cooldownMs is Infinity", () => {
    const state = makeState();
    const applied = recordAccountCooldown(Infinity, state);
    expect(applied).toBe(false);
    expect(state.lastCooldownMs).toBe(0);
  });

  it("overwrites previous cooldownMs (latest write wins)", () => {
    const state = makeState();
    recordAccountCooldown(1000, state);
    recordAccountCooldown(5000, state);
    expect(state.lastCooldownMs).toBe(5000);
    expect(state.requestRetryLastCooldownMs).toBe(5000);
  });
});
