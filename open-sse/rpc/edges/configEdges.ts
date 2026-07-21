/**
 * E — Config reload edge (T1, file-read bound).
 *
 * Reloads .env overrides without restart. Not CPU-bound → T1 is correct.
 */
import { registerEdge, getEdgeTier } from "../dispatchEdges.ts";
import type { DispatchEdgeResult } from "../dispatchEdges.ts";

registerEdge({ name: "config.reload", defaultTier: 1, providerScope: ["*"] });

export async function configReloadHandler(): Promise<
  DispatchEdgeResult<{ reloaded: boolean }>
> {
  const tier = getEdgeTier("config.reload");
  if (tier <= 1) {
    const { loadTierOverridesFromEnv } = await import("../dispatchEdges.ts");
    loadTierOverridesFromEnv();
    return { ok: true, value: { reloaded: true } };
  }
  return { ok: true, value: { reloaded: false } };
}
