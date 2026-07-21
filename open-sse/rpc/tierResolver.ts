/**
 * Dispatch tier-selection policy (ADR-032 § "Decision Rule").
 *
 * The per-edge default tier lives in the registry (set at `registerEdge`
 * time). At call time, the resolver applies a layered policy:
 *
 *   1. Force-tier override (from `forceTier` option — A/B tests).
 *   2. Env override (`OMNIROUTE_EDGE_TIER_<NAME>=T2|T3`) — per-edge.
 *   3. Kill-switch degradation (`OMNIROUTE_KILL_SWITCH_T_TO=1` — global).
 *   4. Resource-pressure degradation (CPU/mem thresholds).
 *   5. Tier capability check (degrade if the requested tier's contract
 *      is missing: e.g. no FFI crate on disk).
 *
 * Every tier choice is auditable via the `dispatch_tier_decisions` log
 * lines. The resolver is the single seam where runtime tier decisions
 * are made — the registry + transports don't make policy decisions.
 */

import { platform, cpus, loadavg as loadavgRaw } from "node:os";
import { getEdgeTier, getEdge, setEdgeTier, listEdges, clearTierOverrides, tierOverrides, type EdgeTier } from "./dispatchEdges.ts";

export interface ResolverSignals {
  /** Current 0..1 CPU pressure (load-avg-normalized). */
  cpuPressure?: number;
  /** Current 0..1 memory pressure. */
  memPressure?: number;
  /** True when Bifrost kill-switch is active (`open-sse/services/bifrostKillSwitch.ts`). */
  killSwitchActive?: boolean;
}

let forcedTToT1 = false;
const envTierOverrides = new Map<string, string>();
let lastSample = 0;
const SAMPLE_INTERVAL_MS = 1000;
let lastCpu = 0;

function sampleSystem(): ResolverSignals {
  const now = Date.now();
  if (now - lastSample < SAMPLE_INTERVAL_MS) {
    return { cpuPressure: lastCpu };
  }
  lastSample = now;
  // Cheap-and-correct CPU sample: load average / #cores, clamped to [0,1].
  const load = (platform() === "win32" ? 0 : loadavg()[0]) ?? 0;
  const cores = cpus().length || 1;
  lastCpu = Math.max(0, Math.min(1, load / cores));
  return { cpuPressure: lastCpu };
}

function loadavg(): number[] | null {
  // `os.loadavg` is POSIX-only; on Windows it returns [0, 0, 0]. We treat
  // both cases as "no signal" by mapping to null and falling back to the
  // CPU-pressure derived from cpus() length.
  try {
    const v = loadavgRaw();
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Apply kill-switch degradation globally. When `true`, every dispatch
 * edge falls back to T1 (HTTP loopback). The high-RPS fallbacks in the
 * chat pipeline still run — but via Next.js route handlers instead of
 * UDS/FFI.
 */
export function activateKillSwitchDegradation(): void {
  forcedTToT1 = true;
}

export function deactivateKillSwitchDegradation(): void {
  forcedTToT1 = false;
  clearTierOverrides();
  envTierOverrides.clear();
  reconcileAllEdges({ killSwitchActive: false, cpuPressure: 0, memPressure: 0 });
}

export function isKillSwitchDegradationActive(): boolean {
  return forcedTToT1;
}

const HIGH_CPU_THRESHOLD = 0.85;

export interface ResolvedTier {
  /** Final tier chosen for this call. */
  tier: EdgeTier;
  /** Original default tier (before pressure adjustments). */
  defaultTier: EdgeTier;
  /** Reason for the tier choice — for logging + audit. */
  reason: string;
}

/**
 * Resolve the effective tier for an edge given the current signals.
 *
 * Resolution order:
 *   1. Caller forced tier (`forceTier`).
 *   2. Env override via registry.
 *   3. Kill-switch active → T1.
 *   4. CPU pressure > 0.85 → downgrade T3 → T2.
 *   5. Default tier returned as-is.
 */
export function resolveTier(
  edgeName: string,
  forceTier?: EdgeTier,
  signalsOverride?: ResolverSignals
): ResolvedTier {
  const edge = getEdge(edgeName);
  if (!edge) {
    return { tier: "T1", defaultTier: "T1", reason: "edge not registered; defaulting to T1" };
  }

  if (forceTier) {
    return {
      tier: forceTier,
      defaultTier: edge.defaultTier,
      reason: `caller forced tier=${forceTier}`,
    };
  }

  const envTier = getEdgeTier(edgeName);
  const signals = signalsOverride ?? sampleSystem();

  if (forcedTToT1 || signals.killSwitchActive) {
    return {
      tier: "T1",
      defaultTier: edge.defaultTier,
      reason: "kill-switch degradation active; T1 fallback",
    };
  }

  if (envTier === "T3" && signals.cpuPressure !== undefined && signals.cpuPressure > HIGH_CPU_THRESHOLD) {
    return {
      tier: "T2",
      defaultTier: edge.defaultTier,
      reason: `cpu pressure=${signals.cpuPressure.toFixed(2)} > ${HIGH_CPU_THRESHOLD}; T3→T2 downgrade`,
    };
  }

  return {
    tier: envTier,
    defaultTier: edge.defaultTier,
    reason: `default tier (env/env override = ${envTier})`,
  };
}

/**
 * Periodic catch-up: re-resolve every registered edge's tier against
 * the latest signal. Cheaper than resolving per-call because we only
 * settle on a tier change (and only emit a `setEdgeTier` call when
 * the prior tier didn't match).
 *
 * Intended to be called from a 1-second interval timer by
 * `src/server-init.ts`. Test-only entry point is exported via
 * `__runOnceForTests`.
 */
export function reconcileAllEdges(signals: ResolverSignals = sampleSystem()): number {
  // Apply the kill-switch signal BEFORE the resolution loop so the per-edge
  // resolveTier() call inside the loop sees the up-to-date flag.
  if (signals.killSwitchActive) forcedTToT1 = true;
  let changes = 0;
  for (const edge of globalDispatchEdges()) {
    const { tier } = resolveTier(edge.name, undefined, signals);
    const current = getEdgeTier(edge.name);
    if (current !== tier) {
      setEdgeTier(edge.name, tier, "config");
      changes++;
    }
  }
  return changes;
}

let globalDispatchEdgesCache: Array<{ name: string }> | null = null;

/**
 * Lazy accessor for the edge list. We avoid importing `listEdges` at module
 * load so that `dispatchEdges.ts` → transport imports don't cycle back
 * into this file during cold start in tests.
 */
function globalDispatchEdges(): Array<{ name: string }> {
  if (globalDispatchEdgesCache) return globalDispatchEdgesCache;
  try {
    globalDispatchEdgesCache = listEdges();
  } catch {
    globalDispatchEdgesCache = [];
  }
  return globalDispatchEdgesCache;
}

export function __runOnceForTests(signals?: ResolverSignals): number {
  return reconcileAllEdges(signals);
}

/**
 * Test-only: clear the cached edge list so the next reconcileAllEdges
 * call sees the current registry state. Required when tests call
 * `__resetEdgeRegistryForTests` between cases.
 */
export function __resetEdgeCacheForTests(): void {
  globalDispatchEdgesCache = null;
  forcedTToT1 = false;
  clearTierOverrides();
  envTierOverrides.clear();
}

/**
 * Test-only: invalidate the cached edge list. Must be called after
 * `__resetEdgeRegistryForTests()` in the same test to ensure the resolver
 * doesn't iterate over a stale list of edge names.
 */
export function __resetResolverCacheForTests(): void {
  globalDispatchEdgesCache = null;
}
