/**
 * E — Config reload edge (T1, file-read bound).
 *
 * Reloads .env overrides without restart. Not CPU-bound → T1 is correct.
 */
import { registerEdge, getEdgeTier } from "../polyglotEdges.ts";
import type { PolyglotEdgeResult } from "../polyglotEdges.ts";

registerEdge({ name: "config.reload", defaultTier: 1, providerScope: ["*"] });

export async function configReloadHandler(): Promise<
  PolyglotEdgeResult<{ reloaded: boolean }>
> {
  const tier = getEdgeTier("config.reload");
  if (tier <= 1) {
    const { loadTierOverridesFromEnv } = await import("../polyglotEdges.ts");
    loadTierOverridesFromEnv();
    return { ok: true, value: { reloaded: true } };
  }
  return { ok: true, value: { reloaded: false } };
}
