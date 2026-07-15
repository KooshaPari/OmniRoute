/**
 * E — Pricing sync edge (T1, low-frequency batch operation).
 *
 * Runs once per hour on the scheduler — network and DB bound, no FFI benefit.
 */
import { registerEdge, getEdgeTier } from "../polyglotEdges.ts";
import type { PolyglotEdgeResult } from "../polyglotEdges.ts";

registerEdge({
  name: "pricing.sync",
  defaultTier: 1,
  providerScope: ["*"],
});

export async function pricingSyncHandler(): Promise<
  PolyglotEdgeResult<{ synced: number; durationMs: number }>
> {
  const tier = getEdgeTier("pricing.sync");
  if (tier <= 1) {
    const { syncPricing } = await import("../../lib/pricingSync.ts");
    const started = Date.now();
    const synced = await syncPricing();
    return { ok: true, value: { synced, durationMs: Date.now() - started } };
  }
  // Higher tiers not implemented for low-frequency ops
  return { ok: true, value: { synced: 0, durationMs: 0 } };
}
