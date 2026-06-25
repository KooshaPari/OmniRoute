import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getUpstreamErrorIdentifier,
  isSemaphoreCapacityError,
  isTokenExpiringSoon,
} from "../errorAndTokenHelpers.ts";

// ---------------------------------------------------------------------------
// isTokenExpiringSoon
// ---------------------------------------------------------------------------

describe("isTokenExpiringSoon", () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Pin "now" to a deterministic instant so the tests don't race the wall clock.
    nowSpy = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-06-24T12:00:00Z").getTime());
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe("default 5-minute buffer", () => {
    it("returns true for an expiry within the buffer (3 min in the future)", () => {
      const expiresAt = new Date("2026-06-24T12:03:00Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt)).toBe(true);
    });

    it("returns true for an expiry at exactly the buffer edge (5 min in the future)", () => {
      const expiresAt = new Date("2026-06-24T12:05:00Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt)).toBe(true);
    });

    it("returns false for an expiry just outside the buffer (5 min 1 sec in the future)", () => {
      const expiresAt = new Date("2026-06-24T12:05:01Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt)).toBe(false);
    });

    it("returns true for an expiry in the past", () => {
      const expiresAt = new Date("2026-06-24T11:59:00Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt)).toBe(true);
    });

    it("returns false for an expiry far in the future (1 hour)", () => {
      const expiresAt = new Date("2026-06-24T13:00:00Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt)).toBe(false);
    });
  });

  describe("custom buffer", () => {
    it("honors a 60-second buffer", () => {
      const in30s = new Date("2026-06-24T12:00:30Z").toISOString();
      const in90s = new Date("2026-06-24T12:01:30Z").toISOString();
      expect(isTokenExpiringSoon(in30s, 60_000)).toBe(true);
      expect(isTokenExpiringSoon(in90s, 60_000)).toBe(false);
    });

    it("honors a 24-hour buffer", () => {
      const in12h = new Date("2026-06-25T00:00:00Z").toISOString();
      expect(isTokenExpiringSoon(in12h, 24 * 60 * 60 * 1000)).toBe(true);
    });
  });

  describe("nullish / falsy inputs", () => {
    it("returns false for null", () => {
      expect(isTokenExpiringSoon(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTokenExpiringSoon(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isTokenExpiringSoon("")).toBe(false);
    });

    it("returns false for 0", () => {
      expect(isTokenExpiringSoon(0)).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    it("returns false for a non-date string", () => {
      // `NaN < anything` is always false, so the predicate gracefully returns false.
      expect(isTokenExpiringSoon("not a date")).toBe(false);
    });

    it("returns false for NaN", () => {
      expect(isTokenExpiringSoon(Number.NaN)).toBe(false);
    });
  });

  describe("input type acceptance", () => {
    it("accepts an ISO date string", () => {
      const expiresAt = new Date("2026-06-24T12:00:30Z").toISOString();
      expect(isTokenExpiringSoon(expiresAt, 60_000)).toBe(true);
    });

    it("accepts epoch milliseconds (number)", () => {
      const ms = new Date("2026-06-24T12:00:30Z").getTime();
      expect(isTokenExpiringSoon(ms, 60_000)).toBe(true);
    });

    it("accepts a Date instance", () => {
      const d = new Date("2026-06-24T12:00:30Z");
      expect(isTokenExpiringSoon(d, 60_000)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getUpstreamErrorIdentifier
// ---------------------------------------------------------------------------

describe("getUpstreamErrorIdentifier", () => {
  it("returns the code for an object with a string code", () => {
    expect(getUpstreamErrorIdentifier({ code: "rate_limit_exceeded" })).toBe(
      "rate_limit_exceeded",
    );
  });

  it("returns the code for an Error subclass with .code", () => {
    const err = new Error("boom");
    (err as Error & { code?: string }).code = "context_length_exceeded";
    expect(getUpstreamErrorIdentifier(err)).toBe("context_length_exceeded");
  });

  it("returns undefined for an Error without .code", () => {
    expect(getUpstreamErrorIdentifier(new Error("boom"))).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(getUpstreamErrorIdentifier(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(getUpstreamErrorIdentifier(undefined)).toBeUndefined();
  });

  it("returns undefined for a primitive", () => {
    expect(getUpstreamErrorIdentifier(42)).toBeUndefined();
    expect(getUpstreamErrorIdentifier("string")).toBeUndefined();
    expect(getUpstreamErrorIdentifier(true)).toBeUndefined();
  });

  it("returns undefined when code is a number (only strings accepted)", () => {
    expect(getUpstreamErrorIdentifier({ code: 429 })).toBeUndefined();
  });

  it("returns undefined when code is an object", () => {
    expect(getUpstreamErrorIdentifier({ code: { nested: "x" } })).toBeUndefined();
  });

  it("returns undefined when code is null", () => {
    expect(getUpstreamErrorIdentifier({ code: null })).toBeUndefined();
  });

  it("returns undefined when code is the empty string", () => {
    expect(getUpstreamErrorIdentifier({ code: "" })).toBeUndefined();
  });

  it("preserves whitespace-only strings (does not strip)", () => {
    // The contract is "non-empty string".  We don't trim -- callers can do
    // their own normalization if they care.
    expect(getUpstreamErrorIdentifier({ code: " " })).toBe(" ");
  });

  it("accepts a code containing spaces, dashes, underscores", () => {
    expect(getUpstreamErrorIdentifier({ code: "rate-limit_exceeded v2" })).toBe(
      "rate-limit_exceeded v2",
    );
  });
});

// ---------------------------------------------------------------------------
// isSemaphoreCapacityError
// ---------------------------------------------------------------------------

describe("isSemaphoreCapacityError", () => {
  describe("positive cases (narrows to Error & { code: string })", () => {
    it("returns true for SEMAPHORE_TIMEOUT", () => {
      const error = Object.assign(new Error("timed out"), { code: "SEMAPHORE_TIMEOUT" });
      expect(isSemaphoreCapacityError(error)).toBe(true);
    });

    it("returns true for SEMAPHORE_QUEUE_FULL", () => {
      const error = Object.assign(new Error("queue full"), { code: "SEMAPHORE_QUEUE_FULL" });
      expect(isSemaphoreCapacityError(error)).toBe(true);
    });

    it("narrows the type so .code can be read without an assertion", () => {
      const error = Object.assign(new Error("timed out"), { code: "SEMAPHORE_TIMEOUT" });
      if (isSemaphoreCapacityError(error)) {
        // This would fail to compile if the type predicate is broken.
        const code: string = error.code;
        expect(code).toBe("SEMAPHORE_TIMEOUT");
      } else {
        throw new Error("expected isSemaphoreCapacityError to be true");
      }
    });
  });

  describe("negative cases", () => {
    it("returns false for a SEMAPHORE code with the wrong suffix", () => {
      const error = Object.assign(new Error("?"), { code: "SEMAPHORE_BOGUS" });
      expect(isSemaphoreCapacityError(error)).toBe(false);
    });

    it("returns false for an unrelated error code", () => {
      const error = Object.assign(new Error("?"), { code: "ECONNRESET" });
      expect(isSemaphoreCapacityError(error)).toBe(false);
    });

    it("returns false for a plain Error with no code", () => {
      expect(isSemaphoreCapacityError(new Error("boom"))).toBe(false);
    });

    it("returns false for null", () => {
      expect(isSemaphoreCapacityError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isSemaphoreCapacityError(undefined)).toBe(false);
    });

    it("returns false for a primitive", () => {
      expect(isSemaphoreCapacityError("SEMAPHORE_TIMEOUT")).toBe(false);
      expect(isSemaphoreCapacityError(42)).toBe(false);
    });

    it("returns false for an object whose code is the wrong type", () => {
      expect(isSemaphoreCapacityError({ code: 42 })).toBe(false);
      expect(isSemaphoreCapacityError({ code: null })).toBe(false);
      expect(isSemaphoreCapacityError({ code: { nested: true } })).toBe(false);
    });
  });

  describe("realistic call-site pattern", () => {
    it("lets the caller route SEMAPHORE_TIMEOUT and SEMAPHORE_QUEUE_FULL to a fallback path", () => {
      const cases: Array<{ code: string; expected: boolean }> = [
        { code: "SEMAPHORE_TIMEOUT", expected: true },
        { code: "SEMAPHORE_QUEUE_FULL", expected: true },
        { code: "SEMAPHORE_BOGUS", expected: false },
        { code: "ECONNRESET", expected: false },
      ];
      for (const { code, expected } of cases) {
        const error = Object.assign(new Error("test"), { code });
        expect(isSemaphoreCapacityError(error)).toBe(expected);
      }
    });
  });
});
