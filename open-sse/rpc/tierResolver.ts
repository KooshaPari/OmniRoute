/**
 * Polyglot Binding Tier Resolver
 *
 * Resolves which transport tier (T1/T2/T3) each edge uses based on:
 *   1. Per-edge env overrides (OMNIROUTE_EDGE_TIER_<name>)
 *   2. Kill-switch degradation flag
 *   3. CPU/memory pressure signals
 *   4. Edge's registered default tier
 */

import os from "node:os";
import {
  getEdgeTier,
  getEdge,
  setEdgeTier,
  listEdges,
  clearTierOverrides,
  type EdgeTier,
} from "./polyglotEdges.ts";

// ── Types ──────────────────────────────────────────────────────────────

export type Tier = "T1" | "T2" | "T3";

export interface ResolvedTier {
  tier: Tier;
  defaultTier: Tier;
  reason: string;
}

interface ResolverSignals {
  killSwitchActive?: boolean;
  cpuPressure?: number;
  memPressure?: number;
}

// ── Module state ───────────────────────────────────────────────────────

const HIGH_CPU_THRESHOLD = 0.85;
const HIGH_MEM_THRESHOLD = 0.85;
let forcedTToT1 = false;
let globalPolyglotEdgesCache: Array<{ name: string }> | null = null;

/** Per-edge env overrides (loaded from OMNIROUTE_EDGE_TIER_* env vars). */
const envTierOverrides = new Map<string, Tier>();

// ── Helpers ────────────────────────────────────────────────────────────

function sampleSystem(): ResolverSignals {
  const loadavg = os.loadavg?.();
  const cpuPressure = loadavg ? loadavg[0] / (os.cpus().length || 1) : 0;
  const memPressure = (() => {
    try {
      const freemem = os.freemem();
      const totalmem = os.totalmem();
      return totalmem > 0 ? 1 - freemem / totalmem : 0;
    } catch {
      return 0;
    }
  })();
  return { cpuPressure, memPressure };
}

let _edgeCache: Array<{ name: string }> | null = null;
function globalPolyglotEdges(): Array<{ name: string }> {
  if (_edgeCache) return _edgeCache;
  try {
    _edgeCache = listEdges();
  } catch {
    _edgeCache = [];
  }
  return _edgeCache;
}

// ── Core resolver ──────────────────────────────────────────────────────

export function resolveTier(
  edgeName: string,
  forceTier?: Tier,
  signalsOverride?: ResolverSignals,
): ResolvedTier {
  const signals = signalsOverride ?? sampleSystem();
  const edge = getEdge(edgeName);

  if (!edge) {
    return { tier: "T1", defaultTier: "T1", reason: "edge_not_registered" };
  }

  if (forceTier) {
    return { tier: forceTier, defaultTier: edge.defaultTier as Tier, reason: `forced_${forceTier}` };
  }
  if (forcedTToT1 || signals.killSwitchActive) {
    return { tier: "T1", defaultTier: edge.defaultTier as Tier, reason: "kill_switch" };
  }

  const envOverride = envTierOverrides.get(edgeName);
  if (envOverride) {
    return { tier: envOverride, defaultTier: edge.defaultTier as Tier, reason: "env_override" };
  }

  const base = edge.defaultTier as Tier;

  if (base === "T3" && (signals.cpuPressure ?? 0) > HIGH_CPU_THRESHOLD) {
    return { tier: "T2", defaultTier: base, reason: "high_cpu" };
  }

  if ((base === "T3" || base === "T2") && (signals.memPressure ?? 0) > HIGH_MEM_THRESHOLD) {
    return { tier: "T1", defaultTier: base, reason: "high_memory" };
  }

  return { tier: base, defaultTier: base, reason: "default" };
}

// ── Reconciler ─────────────────────────────────────────────────────────

export function reconcileAllEdges(signals: ResolverSignals = sampleSystem()): number {
  if (signals.killSwitchActive !== undefined) forcedTToT1 = signals.killSwitchActive;

  let changes = 0;
  const edges = globalPolyglotEdges();

  for (const edge of edges) {
    const resolved = resolveTier(edge.name, undefined, signals);
    const current = getEdgeTier(edge.name) ?? (edge as { defaultTier?: string }).defaultTier ?? "T3";

    if (current !== resolved.tier) {
      setEdgeTier(edge.name, resolved.tier, resolved.reason);
      changes++;
    }
  }

  return changes;
}

// ── Kill-switch degradation API ────────────────────────────────────────

export function activateKillSwitchDegradation(): void {
  forcedTToT1 = true;
  reconcileAllEdges({ killSwitchActive: true });
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

// ── Env override loader ────────────────────────────────────────────────

export function loadTierOverridesFromEnv(): void {
  envTierOverrides.clear();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("OMNIROUTE_EDGE_TIER_")) {
      const edgeName = key.slice("OMNIROUTE_EDGE_TIER_".length);
      if (["T1", "T2", "T3"].includes(value)) {
        envTierOverrides.set(edgeName, value as Tier);
      }
    }
  }
}

// ── Test helpers ───────────────────────────────────────────────────────

export function __resetEdgeCacheForTests(): void {
  forcedTToT1 = false;
  envTierOverrides.clear();
  _edgeCache = null;
  globalPolyglotEdgesCache = null;
}

export function __runOnceForTests(signals?: ResolverSignals): number {
  return reconcileAllEdges(signals);
}
