/**
 * Dispatch tier reconciler — boot-time + 1-second tick loop (ADR-032 § "Wiring").
 *
 * Runs alongside the other periodic jobs in `src/server-init.ts`
 * (`startBudgetResetJob`, `startReasoningCacheCleanupJob`, `startCleanupScheduler`).
 * On every tick it:
 *
 *   1. Aggregates the per-provider Bifrost kill-switch state via
 *      `isAnyKillSwitchActive()` (true when ANY provider's switch is tripped).
 *   2. Feeds the result into `syncDispatchToKillSwitch(...)` which flips
 *      every registered dispatch edge to T1 (HTTP loopback) — the safest
 *      fallback because it only depends on the in-process Next.js server.
 *   3. Calls `reconcileAllEdges(signals)` to re-resolve every edge against
 *      the latest CPU-pressure sample.
 *
 * Env-gated by `OMNIROUTE_DISPATCH_RECONCILER_ENABLED` (default `true`).
 * Set to `false` to disable the 1-second timer in tests or constrained
 * environments (e.g. serverless).
 *
 * Idempotent: calling `startDispatchReconciler()` twice returns the existing
 * handle without spawning a second timer.
 *
 * See ADR-032 § "Wiring" for the kill-switch bridge contract.
 */

import { resolveTier, reconcileAllEdges, activateKillSwitchDegradation, deactivateKillSwitchDegradation, __resetEdgeCacheForTests, type ResolverSignals } from "./tierResolver.ts";
import { syncDispatchToKillSwitch, syncDispatchToPerProviderKillSwitch, __resetKillSwitchBridgeForTests, type KillSwitchProviderState } from "./killSwitchBridge.ts";
import { emitTierChangeAudit } from "./audit.ts";
import { recordTierDecision, recordReconcileSweep } from "./metrics.ts";

export interface DispatchReconcilerHandle {
  /** Stop the 1-second tick loop. Idempotent. */
  stop: () => void;
  /** Force an immediate reconcile (skips the tick). Returns the number of edges whose tier changed. */
  tickNow: () => number;
  /** True if the timer is currently active. */
  readonly running: boolean;
}

const DEFAULT_TICK_MS = 1000;

/**
 * Aggregate the Bifrost kill-switch state across every provider.
 *
 * Bifrost's per-provider kill-switch state lives in
 * `open-sse/services/bifrostKillSwitch.ts`. We import it dynamically so the
 * reconciler can be loaded from CLI / test contexts where the kill-switch
 * module isn't yet bootstrapped (no-op in those cases).
 *
 * @returns the per-provider states AND a boolean summary. The per-provider
 *          payload drives the **cascading** kill-switch bridge
 *          (`syncDispatchToPerProviderKillSwitch`); the boolean summary
 *          drives the **global** bridge for backward-compat with the
 *          v8.1 B9 semantics (`syncDispatchToKillSwitch`).
 */
async function aggregateKillSwitchState(): Promise<{
  states: KillSwitchProviderState[];
  anyActive: boolean;
}> {
  try {
    const ks = await import("../services/bifrostKillSwitch.ts");
    const states = ks.listStates().map((s: { provider: string; isActive: boolean }) => ({
      provider: s.provider,
      isActive: s.isActive,
    }));
    return { states, anyActive: states.some((s: KillSwitchProviderState) => s.isActive) };
  } catch {
    // Kill-switch module not loaded yet (e.g. early in CLI startup). Default
    // to "not active" so we don't accidentally degrade every edge.
    return { states: [], anyActive: false };
  }
}

let cachedHandle: DispatchReconcilerHandle | null = null;
/** Track the last known kill-switch state across ticks (@module-level so __resetDispatchReconcilerForTests can nuke it). */
let lastKsState: boolean | null = null;

/**
 * Start the dispatch tier reconciler. Idempotent — calling twice returns
 * the existing handle.
 *
 * @param options.tickMs override the 1-second tick (test-only; default 1000)
 * @param options.logger optional structured logger; defaults to console
 */
export function startDispatchReconciler(options: {
  tickMs?: number;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void; warn: (msg: string, meta?: Record<string, unknown>) => void };
} = {}): DispatchReconcilerHandle {
  if (cachedHandle) return cachedHandle;

  // Opt-out via env so constrained environments can disable the timer.
  if (process.env.OMNIROUTE_DISPATCH_RECONCILER_ENABLED === "false") {
    const noopHandle: DispatchReconcilerHandle = {
      stop: () => {},
      tickNow: () => 0,
      running: false,
      get running() {
        return false;
      },
    };
    cachedHandle = noopHandle;
    return noopHandle;
  }

  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const logger = options.logger ?? console;

  async function reconcile(): Promise<number> {
    const ks = await aggregateKillSwitchState();

    // Per-provider cascade (granular): downgrade ONLY edges whose
    // providerScope overlaps a tripped provider. Returns the diff so we can
    // emit a single per-tick audit-log entry summarizing the changes.
    const cascade = syncDispatchToPerProviderKillSwitch(ks.states);

    // Global bridge (kept for backward-compat). Only call when the GLOBAL
    // flag transitions — internal `syncDispatchToKillSwitch` is idempotent.
    if (ks.anyActive !== lastKsState) {
      lastKsState = ks.anyActive;
      syncDispatchToKillSwitch(ks.anyActive);
      logger.info("dispatch_kill_switch_state_change", {
        killSwitchActive: ks.anyActive,
        trippedProviders: ks.states
          .filter((s) => s.isActive)
          .map((s) => s.provider),
      });
    }

    // Per-edge audit + metric emission. Loops through the diffs to land
    // every `dispatch.tier_change` event in the compliance log AND increment
    // the `dispatch_tier_decisions_total{old_tier,new_tier,reason}` counter
    // so Prometheus scrapes can alert on tier-flip rate.
    const auditEdgeChange = (
      edge: string,
      direction: "downgrade" | "restore",
      detail?: string,
    ): void => {
      const oldTier = direction === "downgrade" ? "T3" : "T1";
      const newTier = direction === "downgrade" ? "T1" : "T3";
      const reason =
        direction === "downgrade" ? "kill_switch" : "kill_switch_cleared";
      emitTierChangeAudit({
        edge,
        oldTier,
        newTier,
        reason,
        actor: "dispatch_reconciler",
        ts: Date.now(),
        detail,
      });
      recordTierDecision({ edge, oldTier, newTier, reason });
    };

    // Audit log + counter: every edge flip emitted by the cascade.
    if (cascade.downgraded.length > 0) {
      logger.info("dispatch_tier_decisions", {
        direction: "downgrade",
        reason: "kill_switch_cascade",
        edges: cascade.downgraded,
        trippedProviders: ks.states
          .filter((s) => s.isActive)
          .map((s) => s.provider),
      });
      for (const e of cascade.downgraded) {
        auditEdgeChange(
          e,
          "downgrade",
          ks.states.filter((s) => s.isActive).map((s) => s.provider).join(","),
        );
      }
    }
    if (cascade.restored.length > 0) {
      logger.info("dispatch_tier_decisions", {
        direction: "restore",
        reason: "kill_switch_cascade_cleared",
        edges: cascade.restored,
      });
      for (const e of cascade.restored) {
        auditEdgeChange(e, "restore");
      }
    }

    const sweptCount = reconcileAllEdges({ killSwitchActive: ks.anyActive } satisfies ResolverSignals);
    recordReconcileSweep(sweptCount);
    return sweptCount;
  }

  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    reconcile()
      .then((changes) => {
        if (changes > 0) {
          logger.info("dispatch_reconcile", { changes });
        }
      })
      .catch((err) => {
        logger.warn("dispatch_reconcile_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, tickMs);
  // Don't keep the Node.js event loop alive just for the reconciler.
  if (typeof timer.unref === "function") timer.unref();

  cachedHandle = {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      cachedHandle = null;
    },
    async tickNow() {
      return reconcile();
    },
    get running() {
      return !stopped;
    },
  } as DispatchReconcilerHandle;

  // Eagerly run one tick on boot so kill-switch state is propagated before
  // the first request lands.
  reconcile().catch((err) => {
    logger.warn("dispatch_initial_reconcile_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return cachedHandle;
}

/**
 * Test-only: clear the cached reconciler handle and reset bridge state.
 * Must be called between test cases that exercise the reconciler to avoid
 * lingering timers.
 */
export function __resetDispatchReconcilerForTests(): void {
  if (cachedHandle) {
    cachedHandle.stop();
  }
  cachedHandle = null;
  lastKsState = null;
  __resetKillSwitchBridgeForTests();
  __resetEdgeCacheForTests();
  // Reset the kill-switch degradation flag so tests don't inherit a "tripped"
  // state from a prior case.
  deactivateKillSwitchDegradation();
  activateKillSwitchDegradation();
  deactivateKillSwitchDegradation();
}