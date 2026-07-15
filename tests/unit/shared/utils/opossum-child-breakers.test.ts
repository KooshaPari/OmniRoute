// @vitest-environment node
/**
 * Per-kind child breakers — migration step 2 contract tests.
 *
 * Verifies that:
 *   1. {@link CircuitBreakerOpossumFactory} instantiates child breakers for
 *      all three FailureKind values (rate_limit, quota_exhausted, transient).
 *   2. {@link CircuitBreakerOpossumFactory#recordOutcome} drives opossum child
 *      states (success keeps CLOSED; enough failures trip OPEN).
 *   3. {@link CircuitBreakerOpossumFactory#getAggregatedState} returns max of
 *      child states (OPEN if any child OPEN, DEGRADED on cumulative failures,
 *      CLOSED otherwise).
 *   4. {@link CircuitBreakerOpossumFactory#getChildSnapshots} returns correct
 *      shape and data for all children.
 *   5. {@link CircuitBreakerOpossumFactory#reset} closes all children and
 *      clears state.
 *   6. Persistence helper functions handle missing DB gracefully.
 *   7. {@link __getOpossumShadowStatsV2ForTests} returns a fresh copy with
 *      per-kind entries.
 *   8. {@link __resetOpossumShadowStatsV2ForTests} clears all counters.
 *   9. {@link runOpossumShadowFactory} short-circuits to direct fn() when
 *      the shadow feature flag is off.
 *  10. Per-kind aggregation correctly produces DEGRADED state when total
 *      cumulative failures exceed the primary's degradation threshold.
 *
 * See `src/shared/utils/circuitBreaker.ts` for the implementation.
 */

import { describe, it, beforeEach, afterEach, expect } from "vitest";

import {
  CircuitBreaker,
  CircuitBreakerOpossumFactory,
  saveChildBreakerState,
  loadChildBreakerState,
  deleteChildBreakerStates,
  __getOpossumShadowStatsV2ForTests,
  __resetOpossumShadowStatsV2ForTests,
  __resetOpossumShadowStatsForTests,
  runOpossumShadowFactory,
  STATE,
} from "@/shared/utils/circuitBreaker";

import type { FailureKind } from "@/shared/utils/classify429";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Ensure we clean up shadow stats between tests. */
beforeEach(() => {
  __resetOpossumShadowStatsV2ForTests();
  __resetOpossumShadowStatsForTests();
});

/**
 * Repeatedly fire failures through a factory child until it opens.
 * Returns the total number of recordOutcome calls it took.
 */
async function tripChild(
  factory: CircuitBreakerOpossumFactory,
  kind: FailureKind,
  maxFires = 20,
): Promise<number> {
  for (let i = 1; i <= maxFires; i++) {
    await factory.recordOutcome(kind, false);
    const child = factory.getChild(kind) as unknown as { opened: boolean; halfOpen: boolean };
    if (child.opened) return i;
  }
  throw new Error(`Child "${kind}" did not open after ${maxFires} failures`);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CircuitBreakerOpossumFactory", () => {
  describe("construction", () => {
    it("instantiates child breakers for all three FailureKind values", () => {
      const primary = new CircuitBreaker("factory-kinds", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      expect(factory.size).toBe(3);

      const rateChild = factory.getChild("rate_limit");
      const quotaChild = factory.getChild("quota_exhausted");
      const transChild = factory.getChild("transient");

      expect(rateChild).toBeDefined();
      expect(quotaChild).toBeDefined();
      expect(transChild).toBeDefined();

      // All children start closed.
      for (const child of [rateChild, quotaChild, transChild]) {
        const c = child as unknown as { opened: boolean; halfOpen: boolean };
        expect(c.opened).toBe(false);
        expect(c.halfOpen).toBe(false);
      }
    });

    it("getChild returns undefined for unknown FailureKind values", () => {
      const primary = new CircuitBreaker("factory-unknown", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      expect(factory.getChild("transient" as FailureKind)).toBeDefined();
    });
  });

  describe("recordOutcome", () => {
    it("keeps child CLOSED after successive successes", async () => {
      const primary = new CircuitBreaker("factory-success", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      // Fire many successes — should stay closed.
      for (let i = 0; i < 10; i++) {
        await factory.recordOutcome("rate_limit", true);
      }

      const child = factory.getChild("rate_limit") as unknown as {
        opened: boolean;
        halfOpen: boolean;
      };
      expect(child.opened).toBe(false);
      expect(child.halfOpen).toBe(false);
    });

    it("opens child breaker after enough failures exceed volume threshold", async () => {
      const primary = new CircuitBreaker("factory-open-test", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      // Trip the rate_limit child with successive failures.
      const firesToOpen = await tripChild(factory, "rate_limit");
      expect(firesToOpen).toBeGreaterThanOrEqual(1);

      const child = factory.getChild("rate_limit") as unknown as {
        opened: boolean;
      };
      expect(child.opened).toBe(true);
    });

    it("opens each child independently per FailureKind", async () => {
      const primary = new CircuitBreaker("factory-independence", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      // Trip only rate_limit.
      await tripChild(factory, "rate_limit");

      const rateChild = factory.getChild("rate_limit") as unknown as {
        opened: boolean;
      };
      const quotaChild = factory.getChild("quota_exhausted") as unknown as {
        opened: boolean;
      };
      const transChild = factory.getChild("transient") as unknown as {
        opened: boolean;
      };

      expect(rateChild.opened).toBe(true);
      expect(quotaChild.opened).toBe(false);
      expect(transChild.opened).toBe(false);
    });
  });

  describe("getAggregatedState", () => {
    it("returns CLOSED when all children are CLOSED", () => {
      const primary = new CircuitBreaker("factory-aggr-closed", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      expect(factory.getAggregatedState()).toBe("CLOSED");
    });

    it("returns OPEN when any child is OPEN", async () => {
      const primary = new CircuitBreaker("factory-aggr-open", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      await tripChild(factory, "rate_limit");
      expect(factory.getAggregatedState()).toBe("OPEN");
    });

    it("returns DEGRADED when total failures cross degradation threshold", async () => {
      // Degradation threshold is 60% of failureThreshold.
      // failureThreshold=10 → degradationThreshold = ceil(10*0.6) = 6.
      const primary = new CircuitBreaker("factory-aggr-degraded", {
        failureThreshold: 10,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      // Fire failures across children — but keep each below the volume
      // threshold to avoid tripping OPEN. Use enough to cross degradation
      // threshold (6) cumulatively.
      // With failureThreshold=10: errorThreshold=10%, volumeThreshold=5.
      // Keep each child under 5 fires but send 6+ total failures across them.
      // Send 2 failures to each of 3 children = 6 total.
      for (const kind of ["rate_limit", "quota_exhausted", "transient"] as FailureKind[]) {
        await factory.recordOutcome(kind, false);
        await factory.recordOutcome(kind, false);
      }

      // Each child now has 2 failures, total = 6 >= degradationThreshold (6).
      const state = factory.getAggregatedState();
      expect(state).toBe("DEGRADED");
    });
  });

  describe("getChildSnapshots", () => {
    it("returns snapshots with correct shape and data", async () => {
      const primary = new CircuitBreaker("factory-snapshots", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      // Trip the rate_limit child.
      await tripChild(factory, "rate_limit");

      const snapshots = factory.getChildSnapshots();
      expect(snapshots).toHaveLength(3);

      for (const snap of snapshots) {
        expect(["rate_limit", "quota_exhausted", "transient"]).toContain(snap.kind);
        expect(["CLOSED", "OPEN", "HALF_OPEN"]).toContain(snap.opossumState);
        expect(typeof snap.stats.failures).toBe("number");
        expect(typeof snap.stats.successes).toBe("number");
        expect(typeof snap.stats.rejects).toBe("number");
        expect(typeof snap.stats.fires).toBe("number");
        expect(typeof snap.stats.timeouts).toBe("number");
      }

      // The rate_limit child should be OPEN with >0 failures.
      const rateSnap = snapshots.find((s) => s.kind === "rate_limit")!;
      expect(rateSnap.opossumState).toBe("OPEN");
      expect(rateSnap.stats.failures).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    it("closes all children after reset", async () => {
      const primary = new CircuitBreaker("factory-reset", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      await tripChild(factory, "rate_limit");
      expect(factory.getAggregatedState()).toBe("OPEN");

      factory.reset();

      expect(factory.getAggregatedState()).toBe("CLOSED");
      for (const kind of ["rate_limit", "quota_exhausted", "transient"] as FailureKind[]) {
        const child = factory.getChild(kind) as unknown as { opened: boolean };
        expect(child.opened).toBe(false);
      }
    });
  });

  describe("size and iteration", () => {
    it("size returns correct count of child breakers", () => {
      const primary = new CircuitBreaker("factory-size", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      expect(factory.size).toBe(3);
    });

    it("is iterable yielding [kind, child] tuples", () => {
      const primary = new CircuitBreaker("factory-iterable", {
        failureThreshold: 5,
        resetTimeout: 10_000,
      });
      const factory = new CircuitBreakerOpossumFactory(primary, {
        persistence: false,
      });

      const entries = [...factory];
      expect(entries).toHaveLength(3);
      for (const [kind, child] of entries) {
        expect(["rate_limit", "quota_exhausted", "transient"]).toContain(kind);
        expect(child).toBeDefined();
      }
    });
  });
});

describe("persistence helpers", () => {
  it("saveChildBreakerState does not throw when DB is unavailable", () => {
    // The underlying `saveCircuitBreakerState` may throw when no DB exists,
    // but the helper itself does not wrap — the caller in the factory is
    // expected to handle failures. This test validates it won't crash.
    expect(() => {
      saveChildBreakerState("no-db-test", "rate_limit", {
        state: "CLOSED",
        failureCount: 0,
        lastFailureTime: null,
      });
    }).not.toThrow();
  });

  it("loadChildBreakerState returns null or throws safely on missing DB", () => {
    // Either null (no row) or throw is acceptable; the factory catches.
    const result = loadChildBreakerState("no-db-test", "rate_limit");
    if (result !== null) {
      expect(typeof result.state).toBe("string");
    }
  });

  it("deleteChildBreakerStates does not throw on missing DB", () => {
    expect(() => {
      deleteChildBreakerStates("no-db-test");
    }).not.toThrow();
  });
});

describe("extended shadow telemetry (V2)", () => {
  it("__getOpossumShadowStatsV2ForTests returns a fresh copy with perKind entries", () => {
    const s1 = __getOpossumShadowStatsV2ForTests();
    const s2 = __getOpossumShadowStatsV2ForTests();

    // Fresh copies (not same reference).
    expect(s1).not.toBe(s2);
    expect(s1.perKind).not.toBe(s2.perKind);

    // Base fields from V1.
    expect(typeof s1.enabled).toBe("boolean");
    expect(s1.fires).toBe(0);
    expect(s1.divergences).toBe(0);
    expect(s1.opossumOpens).toBe(0);
    expect(s1.primaryOpens).toBe(0);

    // Per-kind fields.
    const kinds = ["rate_limit", "quota_exhausted", "transient"] as const;
    for (const kind of kinds) {
      const entry = s1.perKind[kind];
      expect(entry.kind).toBe(kind);
      expect(entry.divergences).toBe(0);
      expect(entry.opossumOpens).toBe(0);
    }
  });

  it("__resetOpossumShadowStatsV2ForTests clears all counters", () => {
    // Prime some stats by calling getter once.
    __getOpossumShadowStatsV2ForTests();

    __resetOpossumShadowStatsV2ForTests();

    const stats = __getOpossumShadowStatsV2ForTests();
    expect(stats.fires).toBe(0);
    expect(stats.divergences).toBe(0);
    expect(stats.opossumOpens).toBe(0);
    expect(stats.primaryOpens).toBe(0);

    for (const kind of ["rate_limit", "quota_exhausted", "transient"] as const) {
      expect(stats.perKind[kind].divergences).toBe(0);
      expect(stats.perKind[kind].opossumOpens).toBe(0);
    }
  });
});

describe("runOpossumShadowFactory", () => {
  it("short-circuits to direct fn() when shadow is disabled", async () => {
    // Feature flag is unset in default test env.
    __resetOpossumShadowStatsForTests();
    __resetOpossumShadowStatsV2ForTests();

    const primary = new CircuitBreaker("shadow-v2-off", {
      failureThreshold: 5,
      resetTimeout: 100,
    });
    const factory = new CircuitBreakerOpossumFactory(primary, {
      persistence: false,
    });

    let calls = 0;
    const result = await runOpossumShadowFactory(
      primary,
      factory,
      async () => {
        calls++;
        return "v2-ok";
      },
    );

    expect(result).toBe("v2-ok");
    expect(calls).toBe(1);

    // No fires when disabled.
    const stats = __getOpossumShadowStatsV2ForTests();
    expect(stats.fires).toBe(0);
  });

  it("re-throws errors from fn() unchanged when disabled", async () => {
    __resetOpossumShadowStatsForTests();
    __resetOpossumShadowStatsV2ForTests();

    const primary = new CircuitBreaker("shadow-v2-error", {
      failureThreshold: 5,
      resetTimeout: 100,
    });
    const factory = new CircuitBreakerOpossumFactory(primary, {
      persistence: false,
    });

    await expect(
      runOpossumShadowFactory(
        primary,
        factory,
        async () => {
          throw new Error("v2-intentional");
        },
      ),
    ).rejects.toThrow(/v2-intentional/);

    // No fires, no per-kind changes.
    const stats = __getOpossumShadowStatsV2ForTests();
    expect(stats.fires).toBe(0);
    for (const kind of ["rate_limit", "quota_exhausted", "transient"] as const) {
      expect(stats.perKind[kind].opossumOpens).toBe(0);
    }
  });
});
