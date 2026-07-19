/**
 * Polyglot Edge Registry
 *
 * Manages the registration and invocation of polyglot binding tier edges.
 * Each edge has a name, default tier, provider scope, and typed input/output.
 */

import os from "node:os";

// ── Types ──────────────────────────────────────────────────────────────

export type EdgeTier = "T1" | "T2" | "T3";

export type EdgeTierOverride = {
  tier: EdgeTier;
  source: "config" | "env" | "kill_switch" | "reconcile";
};

export interface PolyglotEdge<TIn = unknown, TOut = unknown> {
  /** Unique edge identifier, e.g. "sse.chunk.sseStream" */
  name: string;
  /** Default tier (used when no override exists). */
  defaultTier: EdgeTier;
  /** Provider names this edge applies to. Empty = all. */
  providerScope: string[];
  /** Invoke the edge handler. */
  invoke: (input: TIn) => TOut | Promise<TOut>;
  /** Optional health-check callback. Returns null if healthy. */
  healthcheck?: () => string | null;
}

// ── State ──────────────────────────────────────────────────────────────

const edges = new Map<string, PolyglotEdge<unknown, unknown>>();
export const tierOverrides = new Map<string, EdgeTierOverride>();

// ── Registry ───────────────────────────────────────────────────────────

/**
 * Register an edge. If the edge already exists, update its `defaultTier`.
 */
export function registerEdge<TIn, TOut>(edge: PolyglotEdge<TIn, TOut>): PolyglotEdge<TIn, TOut> {
  const existing = edges.get(edge.name);
  if (existing) {
    existing.defaultTier = edge.defaultTier;
    return edge as PolyglotEdge<TIn, TOut>;
  }
  edges.set(edge.name, edge as PolyglotEdge<unknown, unknown>);
  applyEnvOverride(edge.name, edge.defaultTier);
  return edge;
}

function applyEnvOverride(edgeName: string, fallback: EdgeTier): void {
  const envKey = `OMNIROUTE_EDGE_TIER_${edgeName.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  const raw = process.env[envKey];
  if (raw === "T1" || raw === "T2" || raw === "T3") {
    tierOverrides.set(edgeName, { tier: raw, source: "env" });
    return;
  }
  if (tierOverrides.has(edgeName)) return;
  // Do NOT set a default tier override here — tierOverrides is only for
  // reconcile-set and env-var overrides; edge.defaultTier is the baseline.
}

/**
 * Set the tier for an edge at runtime.
 */
export function setEdgeTier(edgeName: string, tier: EdgeTier, source: EdgeTierOverride["source"] = "config"): void {
  tierOverrides.set(edgeName, { tier, source });
}

export function getEdgeTier(edgeName: string): EdgeTier {
  const override = tierOverrides.get(edgeName);
  if (override) return override.tier;
  const edge = edges.get(edgeName);
  return edge?.defaultTier ?? "T1";
}

export function getEdgeTierOverride(edgeName: string): EdgeTierOverride | undefined {
  return tierOverrides.get(edgeName);
}

export function getEdge<TIn = unknown, TOut = unknown>(
  edgeName: string,
): PolyglotEdge<TIn, TOut> | undefined {
  return edges.get(edgeName) as PolyglotEdge<TIn, TOut> | undefined;
}

export function listEdges(): readonly PolyglotEdge<unknown, unknown>[] {
  return Array.from(edges.values());
}

export function clearTierOverrides(): void {
  tierOverrides.clear();
}

// ── Invoke ─────────────────────────────────────────────────────────────

export interface InvokeOptions {
  timeoutMs?: number;
  forceTier?: EdgeTier;
  signal?: AbortSignal;
}

/**
 * Invoke a registered edge by name.
 */
export async function invoke<TIn, TOut>(
  edgeName: string,
  input: TIn,
  opts?: InvokeOptions,
): Promise<TOut> {
  const edge = getEdge<TIn, TOut>(edgeName);
  if (!edge) throw new Error(`Polyglot edge "${edgeName}" not registered`);

  const tier = opts?.forceTier ?? getEdgeTier(edgeName);
  if (tier === "T1") {
    return edge.invoke(input);
  }

  // T2/T3: direct call (UDS/FFI routing handled by the caller)
  return edge.invoke(input);
}

// ── Test helpers ───────────────────────────────────────────────────────

export function __resetEdgeRegistryForTests(): void {
  edges.clear();
  tierOverrides.clear();
}
