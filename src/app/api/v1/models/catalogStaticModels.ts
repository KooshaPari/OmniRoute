/**
 * Static provider model catalog loop — processes the static PROVIDER_MODELS
 * registry and CODEX_NATIVE_UNPREFIXED_MODELS.
 *
 * Extracted from catalog.ts to reduce file size.
 */
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { CODEX_NATIVE_UNPREFIXED_MODELS } from "@omniroute/open-sse/services/model";
import { isModelSelectable } from "@omniroute/open-sse/services/modelLifecycle";
import { providerUsesAuthoritativeLiveCatalog } from "@omniroute/open-sse/config/providerRegistry";
import {
  shouldSuppressStaticModelForExclusiveListing,
} from "./catalogSyncedCoverage";
import {
  providerUsesExclusiveSyncedListing,
} from "@/lib/providers/modelListingCapability";
import {
  isNoAuthProviderBlocked,
  isNoAuthRawProviderPrefix,
  isNoAuthProviderKey,
} from "@/shared/utils/noAuthProviders";
import { getVisionCapabilityFields } from "./catalogVision";
import { getThinkingCapabilityFields } from "./catalogHelpers";
import { prefixRoutesToProvider } from "./catalogProviderMaps";

type StaticModelContext = {
  models: Array<Record<string, unknown>>;
  timestamp: number;
  syncedModelIdsByCanonicalProvider: Map<string, Set<string>>;
  aliasToProviderId: Record<string, string>;
  providerIdToAlias: Record<string, string>;
  providerIdToPrefix: Record<string, string>;
  activeAliases: Set<string>;
  blockedProviders: Set<string>;
  includeAlias: boolean;
  includeCanonical: boolean;
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string;
  providerSupportsModel: (providerKey: string, modelId: string) => boolean;
  isModelHiddenBulk: (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality?: string
  ) => boolean;
  isExcludedByProviderConnections: (providerKey: string, modelId: string) => boolean;
  shouldHidePaid: (providerKey: string, modelId: string, pricing?: unknown) => boolean;
  shouldHideByExposure: (providerKey: string, modelId: string) => boolean;
  maybeYieldCatalogBuild: () => Promise<void>;
};

/**
 * Add static provider models (from PROVIDER_MODELS registry) and codex-native
 * unprefixed models to the catalog.
 */
export async function addStaticProviderModels(ctx: StaticModelContext): Promise<void> {
  const {
    models,
    timestamp,
    syncedModelIdsByCanonicalProvider,
    aliasToProviderId,
    providerIdToAlias,
    providerIdToPrefix,
    activeAliases,
    blockedProviders,
    includeAlias,
    includeCanonical,
    resolveCanonicalProviderId,
    providerSupportsModel,
    isModelHiddenBulk,
    isExcludedByProviderConnections,
    shouldHidePaid,
    shouldHideByExposure,
    maybeYieldCatalogBuild,
  } = ctx;

  // Helper to check if a model is a registered effort variant (e.g. model-none, model-high)
  const isRegisteredEffortVariant = (
    providerModels: Array<{ id: string }>,
    modelId: string
  ): boolean => {
    for (const suffix of ["none", "low", "medium", "high", "max", "xhigh"]) {
      const suffixWithSeparator = `-${suffix}`;
      if (!modelId.endsWith(suffixWithSeparator)) continue;
      const baseModelId = modelId.slice(0, -suffixWithSeparator.length);
      return providerModels.some((candidate) => candidate.id === baseModelId);
    }
    return false;
  };

  // Add provider models (chat)
  for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
    const providerId = aliasToProviderId[alias] || alias;
    const canonicalProviderId = resolveCanonicalProviderId(alias, providerId);

    if (
      isNoAuthProviderBlocked(blockedProviders, canonicalProviderId, alias) ||
      blockedProviders.has(alias) ||
      blockedProviders.has(canonicalProviderId)
    )
      continue;
    if (isNoAuthRawProviderPrefix(canonicalProviderId, alias)) continue;

    if (!activeAliases.has(alias) && !activeAliases.has(canonicalProviderId)) {
      continue;
    }

    for (const model of providerModels) {
      const syncedForProvider = syncedModelIdsByCanonicalProvider.get(canonicalProviderId);
      const exclusiveListing =
        providerUsesExclusiveSyncedListing(canonicalProviderId) ||
        providerUsesAuthoritativeLiveCatalog(canonicalProviderId);
      const providerHasSynced = syncedForProvider !== undefined && syncedForProvider.size > 0;
      const coveredBySynced = shouldSuppressStaticModelForExclusiveListing({
        exclusiveListing,
        providerHasSynced,
        staticModelId: model.id,
        syncedModelIds: syncedForProvider ? [...syncedForProvider] : [],
      });
      const hasDeclaredEffortTiers =
        Array.isArray(model.supportedThinkingEfforts) &&
        model.supportedThinkingEfforts.length > 0;
      if (
        coveredBySynced &&
        (exclusiveListing ||
          (!isRegisteredEffortVariant(providerModels, model.id) && !hasDeclaredEffortTiers))
      )
        continue;
      if (!isModelSelectable(canonicalProviderId, model.id)) continue;
      if (!providerSupportsModel(canonicalProviderId, model.id)) continue;
      const aliasId = `${alias}/${model.id}`;
      if (isModelHiddenBulk(alias, model.id, canonicalProviderId)) continue;
      if (isExcludedByProviderConnections(canonicalProviderId, model.id)) continue;
      if (shouldHidePaid(canonicalProviderId, model.id, (model as { pricing?: unknown }).pricing))
        continue;
      if (shouldHideByExposure(canonicalProviderId, model.id)) continue;

      const visionFields =
        getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(model.id);
      const thinkingFields = getThinkingCapabilityFields(
        canonicalProviderId,
        model.id,
        model.supportsReasoning,
        model.supportedThinkingEfforts,
        !hasDeclaredEffortTiers
      );
      const thinkingCapabilities =
        Object.keys(thinkingFields).length > 0 ? { capabilities: thinkingFields } : {};
      // #12058: a self-aliased provider emits in canonical mode too.
      const selfAliased = canonicalProviderId === alias;
      if (includeAlias || selfAliased) {
        models.push({
          id: aliasId,
          object: "model",
          created: timestamp,
          owned_by: canonicalProviderId,
          permission: [],
          root: model.id,
          parent: null,
          ...(visionFields || {}),
          ...thinkingFields,
          ...thinkingCapabilities,
        });
      }
      if (
        includeCanonical &&
        canonicalProviderId !== alias &&
        !isNoAuthProviderKey(canonicalProviderId) &&
        prefixRoutesToProvider(canonicalProviderId, canonicalProviderId)
      ) {
        const providerIdModel = `${canonicalProviderId}/${model.id}`;
        const providerVisionFields =
          getVisionCapabilityFields(providerIdModel) || getVisionCapabilityFields(model.id);
        models.push({
          id: providerIdModel,
          object: "model",
          created: timestamp,
          owned_by: canonicalProviderId,
          permission: [],
          root: model.id,
          parent: includeAlias ? aliasId : null,
          ...(providerVisionFields || {}),
          ...thinkingFields,
          ...thinkingCapabilities,
        });
      }

      await maybeYieldCatalogBuild();
    }
  }

  // Codex-native unprefixed models
  for (const modelId of CODEX_NATIVE_UNPREFIXED_MODELS) {
    if (!providerSupportsModel("codex", modelId)) continue;
    // #11300: check multiple provider keys for hidden status
    if (isModelHiddenBulk("codex", modelId) || isModelHiddenBulk("openai", modelId)) continue;

    const alias = providerIdToAlias.codex || "cx";
    const aliasId = `${alias}/${modelId}`;
    const providerIdModel = `codex/${modelId}`;
    const entries: Array<{ id: string; parent: string | null }> = [
      ...(includeAlias ? [{ id: aliasId, parent: null }] : []),
      ...(includeCanonical
        ? [{ id: providerIdModel, parent: includeAlias ? aliasId : null }]
        : []),
      ...(includeAlias && includeCanonical ? [{ id: modelId, parent: providerIdModel }] : []),
    ];

    for (const entry of entries) {
      if (models.some((existingModel) => existingModel.id === entry.id)) continue;
      models.push({
        id: entry.id,
        object: "model",
        created: timestamp,
        owned_by: "codex",
        permission: [],
        root: modelId,
        parent: entry.parent,
      });
    }
  }
}
