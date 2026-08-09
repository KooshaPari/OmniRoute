/**
 * chatPredicates.predicates.test.ts — unit tests for the PR-ε ported predicates.
 *
 * Verifies shouldTripProviderBreakerForResult() and isAntigravityMissingProjectError()
 * with explicit guard-by-guard coverage, including the documented upstream bug
 * invariants:
 *   - #7907/#7908: client abort (502 default, error='request_signal_aborted')
 *     must NOT trip the provider breaker
 *   - #8255: request-scoped upstream failures (code=stream_readiness_timeout,
 *     type=stream_early_eof) must NOT trip the provider breaker
 *   - isCombo=true: combo dispatch already handles fallback; never trip the
 *     provider breaker for combo failures
 *   - forceLiveComboTest=true: live combo tests bypass the breaker
 *   - status out of PROVIDER_BREAKER_FAILURE_STATUSES: never trip
 */
import { describe, expect, it } from "vitest";
import {
  shouldTripProviderBreakerForResult,
  isAntigravityMissingProjectError,
  shouldTripBreakerForAllRateLimited,
} from "../chatPredicates";

describe("chatPredicates.shouldTripProviderBreakerForResult", () => {
  describe("happy path: 5xx error on a non-combo request trips the breaker", () => {
    it("returns true for status 408 (request timeout)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 408 }, false, false)).toBe(true);
    });

    it("returns true for status 500 (generic upstream crash)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 500 }, false, false)).toBe(true);
    });

    it("returns true for status 502 (bad gateway)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 502 }, false, false)).toBe(true);
    });

    it("returns true for status 503 (service unavailable)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 503 }, false, false)).toBe(true);
    });

    it("returns true for status 504 (gateway timeout)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 504 }, false, false)).toBe(true);
    });
  });

  describe("code/type NOT in breaker set: never trips", () => {
    it("returns false for status 200 (success)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 200 }, false, false)).toBe(false);
    });

    it("returns false for status 400 (client error)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 400 }, false, false)).toBe(false);
    });

    it("returns false for status 401 (auth)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 401 }, false, false)).toBe(false);
    });

    it("returns false for status 429 (handled by cooldown layer)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 429 }, false, false)).toBe(false);
    });

    it("returns false for status 520 (Cloudflare transient, not in set)", () => {
      expect(shouldTripProviderBreakerForResult({ status: 520 }, false, false)).toBe(false);
    });
  });

  describe("isCombo=true: combo dispatch handles fallback, never trips", () => {
    it("returns false even when status would otherwise trip the breaker", () => {
      expect(shouldTripProviderBreakerForResult({ status: 500 }, true, false)).toBe(false);
    });

    it("returns false for 502 + isCombo", () => {
      expect(shouldTripProviderBreakerForResult({ status: 502 }, true, false)).toBe(false);
    });

    it("returns false for 503 + isCombo", () => {
      expect(shouldTripProviderBreakerForResult({ status: 503 }, true, false)).toBe(false);
    });
  });

  describe("forceLiveComboTest=true: live combo tests bypass the breaker", () => {
    it("returns false even when status would otherwise trip the breaker", () => {
      expect(shouldTripProviderBreakerForResult({ status: 500 }, false, true)).toBe(false);
    });

    it("returns false for 502 + forceLiveComboTest", () => {
      expect(shouldTripProviderBreakerForResult({ status: 502 }, false, true)).toBe(false);
    });
  });

  describe("#7907/#7908: client abort (stream lifecycle error) must not trip", () => {
    it("returns false for 502 with error='request_signal_aborted'", () => {
      expect(
        shouldTripProviderBreakerForResult(
          { status: 502, error: "request_signal_aborted" },
          false,
          false,
        ),
      ).toBe(false);
    });

    it("returns false for 500 with stream lifecycle error", () => {
      expect(
        shouldTripProviderBreakerForResult(
          { status: 500, error: "stream_readiness_timeout" },
          false,
          false,
        ),
      ).toBe(false);
    });

    it("returns false for 502 with error object containing abort marker", () => {
      expect(
        shouldTripProviderBreakerForResult(
          { status: 502, error: { code: "request_signal_aborted" } },
          false,
          false,
        ),
      ).toBe(false);
    });
  });

  describe("#8255: request-scoped upstream failures must not trip", () => {
    it("returns false for 500 with errorCode='stream_readiness_timeout'", () => {
      expect(
        shouldTripProviderBreakerForResult(
          { status: 500, errorCode: "stream_readiness_timeout" },
          false,
          false,
        ),
      ).toBe(false);
    });

    it("returns false for 502 with errorType='stream_early_eof'", () => {
      expect(
        shouldTripProviderBreakerForResult(
          { status: 502, errorType: "stream_early_eof" },
          false,
          false,
        ),
      ).toBe(false);
    });

    it("returns false when both errorCode and errorType are request-scoped", () => {
      expect(
        shouldTripProviderBreakerForResult(
          {
            status: 503,
            errorCode: "stream_readiness_timeout",
            errorType: "stream_early_eof",
          },
          false,
          false,
        ),
      ).toBe(false);
    });
  });

  describe("Number(status) coercion: handles string status codes", () => {
    it("returns true for '503' (string status)", () => {
      expect(
        shouldTripProviderBreakerForResult({ status: "503" as any }, false, false),
      ).toBe(true);
    });

    it("returns false for '429' (string status, cooldown layer)", () => {
      expect(
        shouldTripProviderBreakerForResult({ status: "429" as any }, false, false),
      ).toBe(false);
    });
  });
});

describe("chatPredicates.isAntigravityMissingProjectError", () => {
  const missingProject = {
    status: 422,
    errorCode: "missing_project_id",
    errorType: "oauth_missing_project_id",
  } as const;

  it("returns true for antigravity + missingProject shape", () => {
    expect(isAntigravityMissingProjectError("antigravity", missingProject)).toBe(true);
  });

  it("returns false for non-antigravity provider", () => {
    expect(isAntigravityMissingProjectError("openai", missingProject)).toBe(false);
  });

  it("returns false for wrong status", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", { ...missingProject, status: 500 }),
    ).toBe(false);
    expect(
      isAntigravityMissingProjectError("antigravity", { ...missingProject, status: 400 }),
    ).toBe(false);
  });

  it("returns false for wrong errorCode", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", {
        ...missingProject,
        errorCode: "something_else",
      }),
    ).toBe(false);
  });

  it("returns false for wrong errorType", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", {
        ...missingProject,
        errorType: "different_oauth_error",
      }),
    ).toBe(false);
  });

  it("returns false when status is undefined", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", {
        errorCode: "missing_project_id",
        errorType: "oauth_missing_project_id",
      }),
    ).toBe(false);
  });

  it("returns false when errorCode is undefined", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", {
        status: 422,
        errorType: "oauth_missing_project_id",
      }),
    ).toBe(false);
  });

  it("returns false when errorType is undefined", () => {
    expect(
      isAntigravityMissingProjectError("antigravity", {
        status: 422,
        errorCode: "missing_project_id",
      }),
    ).toBe(false);
  });

  it("returns false for empty provider", () => {
    expect(isAntigravityMissingProjectError("", missingProject)).toBe(false);
  });

  it("returns false for case-mismatched provider", () => {
    expect(isAntigravityMissingProjectError("Antigravity", missingProject)).toBe(false);
    expect(isAntigravityMissingProjectError("ANTI_GRAVITY", missingProject)).toBe(false);
  });
});

describe("chatPredicates.shouldTripBreakerForAllRateLimited", () => {
  describe("happy path: all rate-limited + status in breaker set trips the breaker", () => {
    it("returns true for 408", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 408)).toBe(true);
    });

    it("returns true for 500", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 500)).toBe(true);
    });

    it("returns true for 502", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 502)).toBe(true);
    });

    it("returns true for 503", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 503)).toBe(true);
    });

    it("returns true for 504", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 504)).toBe(true);
    });
  });

  describe("status NOT in breaker set: never trips", () => {
    it("returns false for 200 (success)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 200)).toBe(false);
    });

    it("returns false for 400", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 400)).toBe(false);
    });

    it("returns false for 401", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 401)).toBe(false);
    });

    it("returns false for 429 (handled by cooldown layer)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 429)).toBe(false);
    });

    it("returns false for 520 (Cloudflare, not in set)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 520)).toBe(false);
    });
  });

  describe("allRateLimited=false or nullish: never trips", () => {
    it("returns false when allRateLimited=false", () => {
      expect(shouldTripBreakerForAllRateLimited(false, false, 500)).toBe(false);
    });

    it("returns false when allRateLimited=null", () => {
      expect(shouldTripBreakerForAllRateLimited(false, null, 500)).toBe(false);
    });

    it("returns false when allRateLimited=undefined", () => {
      expect(shouldTripBreakerForAllRateLimited(false, undefined, 500)).toBe(false);
    });

    it("returns false when allRateLimited=true-as-string 'true'", () => {
      // Strict equality: must be exactly boolean true. Loose-truthy
      // strings would be a subtle type system escape hatch.
      expect(shouldTripBreakerForAllRateLimited(false, "true" as any, 500)).toBe(false);
    });
  });

  describe("forceLiveComboTest=true: live combo tests bypass the breaker", () => {
    it("returns false even when other guards would trip", () => {
      expect(shouldTripBreakerForAllRateLimited(true, true, 500)).toBe(false);
    });

    it("returns false for 502 + forceLiveComboTest", () => {
      expect(shouldTripBreakerForAllRateLimited(true, true, 502)).toBe(false);
    });

    it("returns false for 503 + forceLiveComboTest", () => {
      expect(shouldTripBreakerForAllRateLimited(true, true, 503)).toBe(false);
    });
  });

  describe("status is null/undefined/NaN: never trips", () => {
    it("returns false for status=null", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, null)).toBe(false);
    });

    it("returns false for status=undefined", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, undefined)).toBe(false);
    });

    it("returns false for status=NaN", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, NaN)).toBe(false);
    });

    it("returns false for status=Infinity", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, Infinity)).toBe(false);
    });

    it("returns false for status=-Infinity", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, -Infinity)).toBe(false);
    });
  });

  describe("boundary status codes: off-by-one catches", () => {
    it("returns false for 407 (one below the set's 408)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 407)).toBe(false);
    });

    it("returns true for 408 (first entry in the set)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 408)).toBe(true);
    });

    it("returns false for 505 (one above the set's 504)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 505)).toBe(false);
    });

    it("returns false for 0", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, 0)).toBe(false);
    });

    it("returns false for negative codes (-1, -408)", () => {
      expect(shouldTripBreakerForAllRateLimited(false, true, -1)).toBe(false);
      expect(shouldTripBreakerForAllRateLimited(false, true, -408)).toBe(false);
    });
  });
});
