/**
 * E — Scheduler periodic tick edge (T1, orchestrator — not CPU-bound).
 *
 * Drives the dispatch reconciler tick. Itself uses T1 since it's about
 * coordination, not computation.
 */
import { registerEdge, getEdgeTier } from "../dispatchEdges.ts";
import type { DispatchEdgeResult } from "../dispatchEdges.ts";

registerEdge({
  name: "scheduler.tick",
  defaultTier: 1,
  providerScope: ["*"],
});

export async function periodicTickHandler(): Promise<
  DispatchEdgeResult<{ tickMs: number }>
> {
  const started = Date.now();
  const tier = getEdgeTier("scheduler.tick");
  if (tier <= 1) {
    const { startDispatchReconciler } = await import("../reconciler.ts");
    await startDispatchReconciler({ intervalMs: 1000, mode: "single" });
  }
  return { ok: true, value: { tickMs: Date.now() - started } };
}
