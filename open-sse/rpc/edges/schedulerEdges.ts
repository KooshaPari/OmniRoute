/**
 * E — Scheduler periodic tick edge (T1, orchestrator — not CPU-bound).
 *
 * Drives the polyglot reconciler tick. Itself uses T1 since it's about
 * coordination, not computation.
 */
import { registerEdge, getEdgeTier } from "../polyglotEdges.ts";
import type { PolyglotEdgeResult } from "../polyglotEdges.ts";

registerEdge({
  name: "scheduler.tick",
  defaultTier: 1,
  providerScope: ["*"],
});

export async function periodicTickHandler(): Promise<
  PolyglotEdgeResult<{ tickMs: number }>
> {
  const started = Date.now();
  const tier = getEdgeTier("scheduler.tick");
  if (tier <= 1) {
    const { startPolyglotReconciler } = await import("../reconciler.ts");
    await startPolyglotReconciler({ intervalMs: 1000, mode: "single" });
  }
  return { ok: true, value: { tickMs: Date.now() - started } };
}
