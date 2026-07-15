/**
 * Bridging the Bifrost kill-switch (`open-sse/services/bifrostKillSwitch.ts`)
 * to the polyglot tier resolver.
 *
 * Two modes:
 *
 *  1. **Global** — `syncPolyglotToKillSwitch(active)` flips every edge to T1.
 *     Used when the kill-switch trips globally (manual override, ALL providers
 *     reporting degraded health, etc.).
 *
 *  2. **Per-provider cascade** — `syncPolyglotToPerProviderKillSwitch(states)`
 *     only flips edges whose `providerScope` overlaps with the tripped-provider
 *     set. This is the granular fallback that ships by default in v8.2+: when
 *     ONE provider fails (e.g. OpenAI), the cache/scoring/SSE/compression
 *     edges scoped to it degrade to T1, but everything else keeps its native
 *     tier (T2 UDS / T3 FFI). The blast radius shrinks from 17 edges → ~3.
 *
 *     See ADR-032 § "Per-provider cascading kill-switch" (Appendix C).
 *
 * Wired into `bifrostKillSwitch.ts`'s trip/reset handlers and the
 * 1-second reconciler tick in `open-sse/rpc/reconciler.ts`. Idempotent.
 */

import {
  activateKillSwitchDegradation,
  deactivateKillSwitchDegradation,
  reconcileAllEdges,
} from "./tierResolver.ts";
import {
  listEdges,
  setEdgeTier,
  getEdgeTier,
  type EdgeTier,
} from "./polyglotEdges.ts";

let lastGlobalState = false;
/** Last set of tripped providers (per-provider cascade target). */
let lastTrippedProviders: ReadonlySet<string> = new Set();

export interface KillSwitchProviderState {
  provider: string;
  isActive: boolean;
}

/**
 * Sync the polyglot tier resolver with the GLOBAL kill-switch state.
 * When `active=true`, every edge is forced to T1. When `active=false`,
 * edges are restored to their default tier and the CPU-pressure
 * reconcile runs.
 *
 * This is the safe fallback when ANY provider is tripped; the granular
 * per-provider version is `syncPolyglotToPerProviderKillSwitch` below.
 */
export function syncPolyglotToKillSwitch(active: boolean): void {
  if (active === lastGlobalState) return;
  lastGlobalState = active;

  if (active) {
    activateKillSwitchDegradation();
    // Also explicitly set every edge's tier to T1 to make the override
    // visible to the registry (the kill-switch path doesn't rebuild the
    // resolver from scratch).
    for (const edge of listEdges()) {
      setEdgeTier(edge.name, "T1", "kill-switch");
    }
  } else {
    deactivateKillSwitchDegradation();
    // Restore default tiers for all registered edges.
    for (const edge of listEdges()) {
      setEdgeTier(edge.name, edge.defaultTier, "config");
    }
    reconcileAllEdges();
  }
}

/**
 * Sync the polyglot tier resolver with the PER-PROVIDER kill-switch state.
 * Only edges whose `providerScope` overlaps the tripped-provider set are
 * downgraded to T1; everything else keeps its native tier.
 *
 * @param states the per-provider kill-switch state array
 *   (typically `listStates()` from `open-sse/services/bifrostKillSwitch.ts`)
 * @returns the set of edge names that were downgraded on this call
 *   (or restored to default when the cascade cleared)
 */
export function syncPolyglotToPerProviderKillSwitch(
  states: readonly KillSwitchProviderState[],
): { downgraded: string[]; restored: string[] } {
  const trippedNow = new Set(states.filter((s) => s.isActive).map((s) => s.provider));

  // Fast-path: identical state — nothing to do.
  if (sameSet(trippedNow, lastTrippedProviders)) {
    return { downgraded: [], restored: [] };
  }

  // Diff: which edges need a tier flip?
  const downgraded: string[] = [];
  const restored: string[] = [];

  for (const edge of listEdges()) {
    const scope = edge.providerScope ?? [];
    // Provider-agnostic edges only respond to the GLOBAL sync — skip here.
    if (scope.length === 0) continue;

    const isInTrippedScope =
      scope.includes("*") || scope.some((p) => trippedNow.has(p));
    const wasInTrippedScope =
      scope.includes("*") || scope.some((p) => lastTrippedProviders.has(p));
    const currentTier = getEdgeTier(edge.name);
    const forcedTier: EdgeTier = isInTrippedScope ? "T1" : edge.defaultTier;

    if (currentTier !== forcedTier) {
      setEdgeTier(edge.name, forcedTier, "kill-switch");
      if (isInTrippedScope) downgraded.push(edge.name);
      else restored.push(edge.name);
    }
  }

  // If at least one provider is tripped, the global degradation flag is
  // set so the resolver's force-tier check picks it up even for edges
  // without a providerScope. Conversely, if NO provider is tripped AND
  // the previous state was tripped, clear the flag.
  if (trippedNow.size > 0) {
    activateKillSwitchDegradation();
  } else if (lastTrippedProviders.size > 0) {
    deactivateKillSwitchDegradation();
    // After restoring, run a CPU-pressure reconcile to pick up the
    // latest tier resolution against the default tiers.
    reconcileAllEdges();
  }

  lastTrippedProviders = trippedNow;
  return { downgraded, restored };
}

/** Test-only: read the last seen tripped-provider set. */
export function __lastTrippedProvidersForTests(): ReadonlySet<string> {
  return new Set(lastTrippedProviders);
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Test-only: reset the bridge state.
 */
export function __resetKillSwitchBridgeForTests(): void {
  lastGlobalState = false;
  lastTrippedProviders = new Set();
  deactivateKillSwitchDegradation();
}