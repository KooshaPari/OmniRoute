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
<<<<<<< Updated upstream

import { platform, cpus, loadavg as loadavgRaw } from "node:os";
import { getEdgeTier, getEdge, setEdgeTier, listEdges, clearTierOverrides, tierOverrides, type EdgeTier } from "./dispatchEdges.ts";
=======
import os from "node:os";
import {
  EdgeTier,
  getEdgeTier,
  getEdge,
  setEdgeTier,
  listEdges,
  clearTierOverrides,
} from "./polyglotEdges.ts";

// Re-export type aliases consumed by polyglotHotPath.ts and other edges.
export type { EdgeTier } from "./polyglotEdges.ts";
export type Tier = "T1" | "T2" | "T3";
export type EdgeId = string;

export interface ResolvedTier {
  tier: Tier;
  defaultTier: Tier;
  reason: string;
}
>>>>>>> Stashed changes

export interface ResolverSignals {
  cpuPressure?: number;
  memPressure?: number;
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
<<<<<<< Updated upstream
  // Cheap-and-correct CPU sample: load average / #cores, clamped to [0,1].
  const load = (platform() === "win32" ? 0 : (loadavg()?.[0] ?? 0));
  const cores = cpus().length || 1;
  lastCpu = Math.max(0, Math.min(1, load / cores));
=======
  let la = 0;
  try {
    if (os.platform() !== "win32") {
      const result = os.loadavg();
      if (Array.isArray(result) && result.length > 0) {
        la = result[0] ?? 0;
      }
    }
  } catch {
    la = 0;
  }
  const cores = os.cpus().length || 1;
  lastCpu = Math.max(0, Math.min(1, la / cores));
>>>>>>> Stashed changes
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

let globalPolyglotEdgesCache: Array<{ name: string }> | null = null;

function globalPolyglotEdges(): Array<{ name: string }> {
  if (globalPolyglotEdgesCache) return globalPolyglotEdgesCache;
  try {
    globalPolyglotEdgesCache = listEdges();
  } catch {
    globalPolyglotEdgesCache = [];
  }
  return globalPolyglotEdgesCache;
}

/**
 * Periodic catch-up: re-resolve every registered edge's tier against
 * the latest signal. Cheaper than resolving per-call because we only
 * settle on a tier change (and only emit a `setEdgeTier` call when
 * the prior tier didn't match).
 */
export function reconcileAllEdges(signals: ResolverSignals = sampleSystem()): number {
<<<<<<< Updated upstream
  // Apply the kill-switch signal BEFORE the resolution loop so the per-edge
  // resolveTier() call inside the loop sees the up-to-date flag.
  if (signals.killSwitchActive) forcedTToT1 = true;
=======
  if (signals.killSwitchActive !== undefined) forcedTToT1 = signals.killSwitchActive;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
let globalDispatchEdgesCache: readonly { name: string }[] | null = null;

/**
 * Lazy accessor for the edge list. We avoid importing `listEdges` at module
 * load so that `dispatchEdges.ts` → transport imports don't cycle back
 * into this file during cold start in tests.
 */
function globalDispatchEdges(): readonly { name: string }[] {
  if (globalDispatchEdgesCache) return globalDispatchEdgesCache;
  try {
    globalDispatchEdgesCache = listEdges();
  } catch {
    globalDispatchEdgesCache = [];
  }
  return globalDispatchEdgesCache;
}

=======
/** Test-only: force a single reconcile tick with the given signals override. */
>>>>>>> Stashed changes
export function __runOnceForTests(signals?: ResolverSignals): number {
  return reconcileAllEdges(signals);
}

/**
<<<<<<< Updated upstream
 * Test-only: clear the cached edge list so the next reconcileAllEdges
 * call sees the current registry state. Required when tests call
 * `__resetEdgeRegistryForTests` between cases.
 */
=======
 * Flip the global kill-switch degradation flag and immediately
 * re-resolve all edges so every registered edge's tier falls back
 * to T1 regardless of its defaultTier / env override.
 */
export function activateKillSwitchDegradation(): void {
  forcedTToT1 = true;
  globalPolyglotEdgesCache = null;
  try {
    reconcileAllEdges({
      cpuPressure: 0,
      memPressure: 0,
      killSwitchActive: true,
    });
  } catch {
    // reconcile is best-effort — the per-call fallback in resolveTier
    // still observes forcedTToT1 even if reconcile throws.
  }
}

/**
 * Clear the kill-switch degradation flag and let every edge fall
 * back to its configured default tier on the next call.
 */
export function deactivateKillSwitchDegradation(): void {
  forcedTToT1 = false;
  globalPolyglotEdgesCache = null;
  clearTierOverrides();
  try {
    reconcileAllEdges({ cpuPressure: 0, memPressure: 0 });
  } catch {
    // best-effort; per-call resolveTier will observe the cleared flag.
  }
}

/** Test-only: kill-switch simulation flag. */
export function __setKillSwitchActiveForTests(active: boolean): void {
  forcedTToT1 = active;
}

/** Reset edge resolution cache + kill-switch flag for test isolation. */
>>>>>>> Stashed changes
export function __resetEdgeCacheForTests(): void {
  globalDispatchEdgesCache = null;
  forcedTToT1 = false;
<<<<<<< Updated upstream
  clearTierOverrides();
  envTierOverrides.clear();
}

/**
 * Test-only: invalidate the cached edge list. Must be called after
 * `__resetEdgeRegistryForTests()` in the same test to ensure the resolver
 * doesn't iterate over a stale list of edge names.
=======
  globalPolyglotEdgesCache = null;
  clearTierOverrides();
}

/**
 * Public read-only accessor for the global kill-switch degradation flag.
 * Returns true while a Bifrost provider is in the tripped state and
 * every edge must degrade to T1 (HTTP fallback).
>>>>>>> Stashed changes
 */
export function __resetResolverCacheForTests(): void {
  globalDispatchEdgesCache = null;
}
