/**
 * E — Metrics render edge (T2, JSON serialization bound).
 *
 * The /metrics endpoint cycles through all counters and produces a text
 * representation. CPU-bound on JSON serialization + string concatenation.
 */
import { registerEdge, getEdgeTier } from "../dispatchEdges.ts";
import type { DispatchEdgeResult } from "../dispatchEdges.ts";

registerEdge({ name: "metrics.render", defaultTier: 2, providerScope: ["*"] });

export async function metricsRenderHandler(
  format: "prometheus" | "json" = "prometheus",
): Promise<DispatchEdgeResult<string>> {
  const tier = getEdgeTier("metrics.render");
  if (tier <= 2) {
    const { renderPrometheusText } = await import("../metrics.ts");
    const body = format === "json"
      ? JSON.stringify({ tier, format, note: "JSON endpoint via T2 edge" })
      : await renderPrometheusText();
    return { ok: true, value: body };
  }
  return { ok: true, value: "# dispatch metrics (tier: T3 placeholder)" };
}
