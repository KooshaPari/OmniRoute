/**
 * chatForkState.modules.test.ts — unit tests for PR-μ module metadata + poll helper.
 *
 * Verifies:
 *   - FORK_MODULES is a non-empty readonly array
 *   - Each module has the expected shape (name, description, exportCount, notableExports)
 *   - summarizeForkModules() returns moduleCount + totalExports + modules
 *   - pollForkChatState() fires immediately, ticks on demand, can unsubscribe
 *   - Idempotent unsubscribe
 */
import { describe, expect, it } from "vitest";
import {
  FORK_MODULES,
  summarizeForkModules,
  pollForkChatState,
  type ForkModuleMetadata,
} from "../chatForkState";
import {
  COMBOS_CACHE_TTL_MS,
  __resetCombosCacheForTests,
} from "../chatCombosCache";

describe("chatForkState.FORK_MODULES", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(FORK_MODULES)).toBe(true);
    expect(FORK_MODULES.length).toBeGreaterThan(0);
  });

  it("has at least 4 fork-original sibling modules", () => {
    expect(FORK_MODULES.length).toBeGreaterThanOrEqual(4);
  });

  it("every module has the expected shape", () => {
    for (const m of FORK_MODULES) {
      expect(typeof m.name).toBe("string");
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
      expect(typeof m.exportCount).toBe("number");
      expect(m.exportCount).toBeGreaterThan(0);
      expect(Array.isArray(m.notableExports)).toBe(true);
    }
  });

  it("notableExports has at most 5 entries per module", () => {
    for (const m of FORK_MODULES) {
      expect(m.notableExports.length).toBeLessThanOrEqual(5);
    }
  });

  it("includes the chatCooldown module", () => {
    const cd = FORK_MODULES.find((m) => m.name === "chatCooldown");
    expect(cd).toBeDefined();
    expect(cd!.notableExports).toContain("decideAndWaitForCooldownRetry");
    expect(cd!.notableExports).toContain("recordAccountCooldown");
  });

  it("includes the chatPredicates module", () => {
    const cp = FORK_MODULES.find((m) => m.name === "chatPredicates");
    expect(cp).toBeDefined();
    expect(cp!.notableExports).toContain("PROVIDER_BREAKER_FAILURE_STATUSES");
    expect(cp!.notableExports).toContain("shouldTripProviderBreakerForResult");
    expect(cp!.notableExports).toContain("shouldTripBreakerForAllRateLimited");
  });

  it("includes the chatCombosCache module", () => {
    const cc = FORK_MODULES.find((m) => m.name === "chatCombosCache");
    expect(cc).toBeDefined();
    expect(cc!.notableExports).toContain("COMBOS_CACHE_TTL_MS");
    expect(cc!.notableExports).toContain("getCombosCachedForChat");
  });

  it("includes the chatForkState module", () => {
    const cf = FORK_MODULES.find((m) => m.name === "chatForkState");
    expect(cf).toBeDefined();
    expect(cf!.notableExports).toContain("getForkChatState");
    expect(cf!.notableExports).toContain("diffForkChatStates");
    expect(cf!.notableExports).toContain("formatForkChatStateForCli");
  });

  it("module names are unique", () => {
    const names = FORK_MODULES.map((m) => m.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("module descriptions reference PR labels (audit trail)", () => {
    for (const m of FORK_MODULES) {
      // Every module should reference its PR for traceability.
      // chatForkState references PR-κ/λ/μ (multiple), so check for "PR-" prefix.
      const hasPR = /PR-[a-zα-ω]+/.test(m.description);
      expect(hasPR).toBe(true);
    }
  });

  it("is typed as readonly (TypeScript freeze test)", () => {
    // Runtime check that the array is frozen (TypeScript readonly alone
    // doesn't prevent runtime mutation).
    expect(Object.isFrozen(FORK_MODULES)).toBe(true);
  });
});

describe("chatForkState.summarizeForkModules", () => {
  it("returns moduleCount + totalExports + modules", () => {
    const summary = summarizeForkModules();
    expect(typeof summary.moduleCount).toBe("number");
    expect(typeof summary.totalExports).toBe("number");
    expect(Array.isArray(summary.modules)).toBe(true);
  });

  it("moduleCount matches FORK_MODULES.length", () => {
    expect(summarizeForkModules().moduleCount).toBe(FORK_MODULES.length);
  });

  it("totalExports is the sum of all module exportCount", () => {
    const expected = FORK_MODULES.reduce((sum, m) => sum + m.exportCount, 0);
    expect(summarizeForkModules().totalExports).toBe(expected);
  });

  it("modules array is the same reference as FORK_MODULES", () => {
    expect(summarizeForkModules().modules).toBe(FORK_MODULES);
  });

  it("moduleCount is at least 4", () => {
    expect(summarizeForkModules().moduleCount).toBeGreaterThanOrEqual(4);
  });

  it("totalExports is at least 20 (sum across fork modules)", () => {
    expect(summarizeForkModules().totalExports).toBeGreaterThanOrEqual(20);
  });
});

describe("chatForkState.pollForkChatState", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
  });

  it("fires the listener immediately on registration", () => {
    const calls: number[] = [];
    pollForkChatState(() => {
      calls.push(Date.now());
    });
    expect(calls.length).toBe(1);
  });

  it("returns an unsubscribe handle", () => {
    const poller = pollForkChatState(() => {});
    expect(typeof poller.tick).toBe("function");
    expect(typeof poller.unsubscribe).toBe("function");
  });

  it("tick() invokes the listener and returns the snapshot", () => {
    let received: any = null;
    const poller = pollForkChatState((snap) => {
      received = snap;
    });
    const tickResult = poller.tick();
    expect(received).toBeDefined();
    expect(tickResult).toBe(received);
  });

  it("tick() is idempotent after unsubscribe (no more calls)", () => {
    let calls = 0;
    const poller = pollForkChatState(() => {
      calls += 1;
    });
    expect(calls).toBe(1); // initial fire
    poller.unsubscribe();
    poller.tick();
    expect(calls).toBe(1); // no extra call
  });

  it("unsubscribe() is idempotent", () => {
    const poller = pollForkChatState(() => {});
    poller.unsubscribe();
    expect(() => poller.unsubscribe()).not.toThrow();
  });

  it("multiple subscribers receive their own initial fire", () => {
    let a = 0;
    let b = 0;
    const pollerA = pollForkChatState(() => {
      a += 1;
    });
    const pollerB = pollForkChatState(() => {
      b += 1;
    });
    expect(a).toBe(1);
    expect(b).toBe(1);

    pollerA.tick();
    expect(a).toBe(2);
    expect(b).toBe(1); // pollerB not ticked

    pollerB.tick();
    expect(a).toBe(2);
    expect(b).toBe(2);
  });

  it("snapshot reflects cache state changes", async () => {
    const snapshots: any[] = [];
    const poller = pollForkChatState((snap) => {
      snapshots.push(snap);
    });
    expect(snapshots[0].combosCache.hasCachedPromise).toBe(false);

    // Simulate a cache event by calling getCombosCachedForChat
    const { getCombosCachedForChat } = await import("../chatCombosCache");
    await getCombosCachedForChat();

    poller.tick();
    expect(snapshots[snapshots.length - 1].combosCache.hasCachedPromise).toBe(true);
  });

  it("respects COMBOS_CACHE_TTL_MS in the snapshot", () => {
    let received: any = null;
    pollForkChatState((snap) => {
      received = snap;
    });
    expect(received.combosCache.ttlMs).toBe(COMBOS_CACHE_TTL_MS);
  });
});

describe("chatForkState integration: modules + summary + poll", () => {
  it("produces a complete self-describing snapshot", () => {
    const summary = summarizeForkModules();
    let lastSnap: any = null;
    const poller = pollForkChatState((snap) => {
      lastSnap = snap;
    });
    poller.unsubscribe();

    // All three artifacts should agree on module count.
    expect(summary.moduleCount).toBeGreaterThan(0);
    expect(FORK_MODULES.length).toBe(summary.moduleCount);
    expect(lastSnap.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
