/**
 * Context fallback and enrichment snapshot for the catalog.
 *
 * Extracted from catalog.ts to keep that file under the 500-line target.
 */
import { getModelsDevPricing } from "@/lib/modelsDevSync";
import type { CatalogEnrichmentSnapshot } from "@/lib/modelMetadataRegistry";
import { getDefaultContextFallback } from "./catalogBuildHelpers";
import type { CatalogBuildContext } from "./catalogBuildHelpers";

/**
 * Build the enrichment snapshot and context fallback function for the final response.
 * Returns the enrichment snapshot (or undefined if no non-combo models exist).
 */
export function buildEnrichmentSnapshot(
  ctx: CatalogBuildContext
): CatalogEnrichmentSnapshot | undefined {
  const { models, capabilityResolutionSnapshot } = ctx;
  const providerNodeIdByPrefix = (ctx as any).providerNodeIdByPrefix;

  if (!models.some((model: any) => model.owned_by !== "combo")) {
    return undefined;
  }

  let modelsDevPricing: ReturnType<typeof getModelsDevPricing> | null = null;
  try {
    modelsDevPricing = getModelsDevPricing();
  } catch {
    // Pricing lookup is optional; hardcoded defaults still enrich the response.
  }

  return {
    modelsDevPricing,
    capabilityResolutionSnapshot,
    providerNodeIdsByPrefix: providerNodeIdByPrefix,
  };
}

/**
 * Create a context fallback function bound to the current build's alias map
 * and capability resolution snapshot.
 */
export function createDefaultContextFallback(ctx: CatalogBuildContext) {
  return (model: any): number | undefined =>
    getDefaultContextFallback(model, ctx.aliasToProviderId, ctx.capabilityResolutionSnapshot);
}
