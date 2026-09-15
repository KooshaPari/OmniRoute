/**
 * Shared context type and utility functions for catalog build modules.
 *
 * This file defines the `CatalogBuildContext` interface that all catalog sub-modules
 * share, plus pure helper functions used across multiple loops.
 */
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry";
import { getSourcedTokenLimit } from "@omniroute/open-sse/services/contextManager";
import type { ComboCatalogTarget } from "./catalogHelpers";
import type { SyncedAvailableModel } from "@/lib/db/models";

// ---------------------------------------------------------------------------
// Catalog context type
// ---------------------------------------------------------------------------

/**
 * Shared mutable context passed to every catalog sub-module.
 * Created once in `buildUnifiedModelsResponseCore` and threaded through all loops.
 */
export interface CatalogBuildContext {
  /** Original incoming request. */
  request: Request;
  /** CORS headers to include in every response. */
  corsHeaders: Record<string, string>;
  /** Diagnostic headers resolved at the top of the build. */
  diagnosticHeaders: Record<string, string>;

  // Settings
  settings: Record<string, any>;
  hidePaid: boolean;
  hideAuto: boolean;
  blockedProviders: Set<string>;

  // Alias / prefix maps
  aliasToProviderId: Record<string, string>;
  providerIdToAlias: Record<string, string>;
  aliasMaps: {
    aliasToProviderId: Record<string, string>;
    providerIdToAlias: Record<string, string>;
  };
  prefixMode: string;
  includeAlias: boolean;
  includeCanonical: boolean;

  // Connections
  connections: any[];
  connectionsByProvider: Map<string, any[]>;
  getConnectionsForProvider: (...keys: Array<string | null | undefined>) => any[];

  // Provider nodes
  providerIdToPrefix: Record<string, string>;
  providerNodeIdByPrefix: Record<string, string>;
  nodeIdToProviderType: Record<string, string>;

  // Active aliases set
  activeAliases: Set<string>;

  /** Unix timestamp (seconds) for model `created` fields. */
  timestamp: number;

  // Resolved helper functions (closures over local state in the core builder)
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string;
  resolvePublicOwnerId: (providerId: string, canonicalProviderId: string) => string;
  isModelHiddenBulk: (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality?: string
  ) => boolean;
  isExcludedByProviderConnections: (providerKey: string, modelId: string) => boolean;
  providerSupportsModel: (providerKey: string, modelId: string) => boolean;
  shouldHidePaid: (
    providerKey: string,
    modelId: string,
    pricing?: unknown,
    isFree?: boolean
  ) => boolean;
  shouldHideByExposure: (providerKey: string, modelId: string) => boolean;
  maybeYieldCatalogBuild: () => Promise<void>;

  // Combos
  combos: any[];
  resolvedComboTargets: any[];
  buildComboCatalogMetadata: (combo: any, targets: any[]) => any;
  getComboTargetModelId: (
    target: ComboCatalogTarget
  ) => { providerId: string; modelId: string } | null;

  // Capability resolution
  capabilityResolutionSnapshot: any;

  // Synced models (may be populated later)
  syncedModelsByProvider: Record<string, SyncedAvailableModel[]>;

  // Models array — each sub-module pushes entries here
  models: any[];
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Yield the event loop. Used to prevent pinning Node.js on large catalogs.
 */
export function yieldCatalogBuildTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Check if a provider is active (has connections or is a noAuth provider).
 */
export function isProviderActive(ctx: CatalogBuildContext, provider: string): boolean {
  if (ctx.activeAliases.size === 0) return false;
  const alias = ctx.providerIdToAlias[provider] || provider;
  const canonicalProviderId = ctx.resolveCanonicalProviderId(alias, provider);

  if (
    ctx.blockedProviders.has(alias) ||
    ctx.blockedProviders.has(canonicalProviderId) ||
    ctx.blockedProviders.has(provider)
  ) {
    return false;
  }

  return ctx.activeAliases.has(alias) || ctx.activeAliases.has(provider);
}

/**
 * Find an existing model entry that matches a specialty model's provider + root id.
 */
export function findEquivalentSpecialtyModel(
  models: any[],
  providerId: string,
  rawModelId: string,
  type: string,
  scopedModelId: string
): any | undefined {
  return models.find((model: any) => {
    if (model?.id === scopedModelId) return true;
    if (model?.owned_by !== providerId || model?.type !== type) return false;
    const existingRoot =
      typeof model?.root === "string"
        ? model.root
        : typeof model?.id === "string"
          ? model.id.split("/").pop()
          : null;
    return existingRoot === rawModelId;
  });
}

/**
 * Check if a provider already has an equivalent specialty model entry.
 */
export function hasEquivalentSpecialtyModel(
  models: any[],
  providerId: string,
  rawModelId: string,
  type: string,
  scopedModelId: string
): boolean {
  return (
    findEquivalentSpecialtyModel(models, providerId, rawModelId, type, scopedModelId) !== undefined
  );
}

/**
 * Strip the provider prefix from a specialty model ID to get the provider-relative path.
 * e.g. "openrouter/google/chirp-3" -> "google/chirp-3"
 */
export function getSpecialtyModelRelativeId(modelId: string, provider: string): string {
  return modelId.startsWith(`${provider}/`) ? modelId.slice(provider.length + 1) : modelId;
}

/**
 * Look up a model from the static PROVIDER_MODELS registry by provider + model id.
 */
export function getRegistryModel(
  providerId: string,
  modelId: string,
  providerIdToAlias: Record<string, string>
): any | null {
  const alias = providerIdToAlias[providerId] || PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  const providerModels = PROVIDER_MODELS[alias] || PROVIDER_MODELS[providerId] || [];
  return providerModels.find((model) => model?.id === modelId) || null;
}

/**
 * Default context-length fallback for a model.
 */
export function getDefaultContextFallback(
  model: any,
  aliasToProviderId: Record<string, string>,
  capabilityResolutionSnapshot: any
): number | undefined {
  if (typeof model.context_length === "number") return undefined;
  if (model.owned_by === "combo") return undefined;
  if (model.type && model.type !== "chat") return undefined;

  const provider = typeof model.owned_by === "string" ? model.owned_by : null;
  if (!provider) return undefined;
  const canonicalId = aliasToProviderId[provider] || provider;

  const registryFallback = REGISTRY[canonicalId]?.defaultContextLength;
  if (registryFallback) return registryFallback;

  const modelId =
    model.root || (typeof model.id === "string" ? model.id.split("/").pop() : undefined);
  return modelId
    ? getSourcedTokenLimit(canonicalId, modelId, capabilityResolutionSnapshot)
    : getSourcedTokenLimit(canonicalId, null, capabilityResolutionSnapshot);
}
