import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isTransientBackendStatusCode,
  computeRetryDelay,
  withTransientBackendRetry,
  TRANSIENT_BACKEND_STATUS_CODES,
} from "../transientBackendRetry.js";

describe("isTransientBackendStatusCode", () => {
  it("classifies 429/502/503/504 as transient", () => {
    for (const s of TRANSIENT_BACKEND_STATUS_CODES) {
      expect(isTransientBackendStatusCode(s)).toBe(true);
    }
  });
  it("rejects non-transient 4xx (400, 401, 404)", () => {
    expect(isTransientBackendStatusCode(400)).toBe(false);
    expect(isTransientBackendStatusCode(401)).toBe(false);
    expect(isTransientBackendStatusCode(404)).toBe(false);
  });
  it("rejects 2xx and 3xx", () => {
    expect(isTransientBackendStatusCode(200)).toBe(false);
    expect(isTransientBackendStatusCode(204)).toBe(false);
    expect(isTransientBackendStatusCode(301)).toBe(false);
  });
  it("rejects null/undefined/NaN", () => {
    expect(isTransientBackendStatusCode(null)).toBe(false);
    expect(isTransientBackendStatusCode(undefined)).toBe(false);
    expect(isTransientBackendStatusCode(NaN)).toBe(false);
  });
  it("rejects 501 (Not Implemented — not transient)", () => {
    expect(isTransientBackendStatusCode(501)).toBe(false);
  });
});

describe("computeRetryDelay", () => {
  const cfg = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 2000, budgetMs: 10000 };

  it("returns >= base for any attempt", () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      for (let i = 0; i < 50; i++) {
        const delay = computeRetryDelay(attempt, cfg);
        expect(delay).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it("never exceeds maxDelayMs (cap)", () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      for (let i = 0; i < 50; i++) {
        const delay = computeRetryDelay(attempt, cfg);
        expect(delay).toBeLessThanOrEqual(2000);
      }
    }
  });

  it("produces jitter (random distribution)", () => {
    const samples = Array.from({ length: 100 }, () => computeRetryDelay(2, cfg));
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(80); // very unlikely to see <20 unique in 100 samples
  });
});

describe("withTransientBackendRetry", () => {
  beforeEach(() => vi.useRealTimers());

  it("returns immediately on 200 (single attempt)", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 200, value: "ok" });
    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 100,
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.attempts).toBe(1);
    expect(r.value).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on 200", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, value: "down" })
      .mockResolvedValueOnce({ status: 503, value: "down" })
      .mockResolvedValueOnce({ status: 200, value: "ok" });

    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.attempts).toBe(3);
    expect(r.value).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns last transient result when budget exhausted", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 503, value: "still down" });

    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 10,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 50, // tight budget
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
    expect(r.value).toBe("still down");
    expect(r.totalWaitMs).toBeLessThanOrEqual(200); // bounded
    expect(fn).toHaveBeenCalled();
    expect(fn.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("does not retry on 400 (user error)", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 400, value: "bad request" });
    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(400);
    expect(r.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects AbortSignal", async () => {
    const ctrl = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      ctrl.abort(); // abort on first call
      return { status: 503, value: "down" };
    });
    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 1000,
      signal: ctrl.signal,
    });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(1); // did not retry after abort
  });

  it("treats thrown errors as transient (network failure)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ status: 200, value: "ok" });

    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it("returns ok=false with null status when every attempt throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 50,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(null);
    expect(r.attempts).toBeGreaterThanOrEqual(1);
  });

  it("emits a correlationId for tracing", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 200, value: "x" });
    const r = await withTransientBackendRetry(fn, {
      maxAttempts: 1,
      baseDelayMs: 1,
      maxDelayMs: 5,
      budgetMs: 100,
    });
    expect(r.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
