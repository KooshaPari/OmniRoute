/**
 * Custom, alias-backed, and managed-fallback model catalog loops.
 *
 * Extracted from catalog.ts to reduce file size.
 */
import { getAllCustomModels } from "@/lib/db/models";
import { getModelAliases } from "@/lib/db/models";
import { extractAliasBackedModels } from "./aliasBackedModels";
import { getCompatibleFallbackModels } from "@/lib/providers/managedAvailableModels";
import { mergeCustomModelMetadata } from "@/lib/providers/modelMetadataPrecedence";
import { hasEligibleConnectionForModel } from "@/domain/connectionModelRules";
import {
  providerUsesCuratedModelsOnly,
} from "@/lib/providers/modelListingCapability";
import {
  isNoAuthProviderBlocked,
  isNoAuthProviderKey,
} from "@/shared/utils/noAuthProviders";
import { getCustomVisionCapabilityFields } from "./catalogVision";
import { getVisionCapabilityFields } from "./catalogVision";
import { classifyModelSupportedEndpoints } from "@/shared/constants/modelSupportedEndpoints";
import { isUnifiedChatSourceModelSelectable } from "./catalogModelPolicy";
import { prefixRoutesToProvider } from "./catalogProviderMaps";
import type { CustomModelEntry } from "./catalogHelpers";

type CustomModelContext = {
  models: Array<Record<string, unknown>>;
  timestamp: number;
  connections: Array<{
    id: string;
    provider: string;
    isActive?: boolean;
    [key: string]: unknown;
  }>;
  providerIdToPrefix: Record<string, string>;
  providerIdToAlias: Record<string, string>;
  nodeIdToProviderType: Record<string, string>;
  aliasToProviderId: Record<string, string>;
  activeAliases: Set<string>;
  blockedProviders: Set<string>;
  includeAlias: boolean;
  includeCanonical: boolean;
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string;
  resolvePublicOwnerId: (providerId: string, canonicalProviderId: string) => string;
  providerSupportsModel: (providerKey: string, modelId: string) => boolean;
  isModelHiddenBulk: (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality?: string
  ) => boolean;
  isExcludedByProviderConnections: (providerKey: string, modelId: string) => boolean;
  shouldHidePaid: (
    providerKey: string,
    modelId: string,
    pricing?: unknown,
    isFree?: boolean
  ) => boolean;
  shouldHideByExposure: (providerKey: string, modelId: string) => boolean;
  getConnectionsForProvider: (
    ...keys: Array<string | null | undefined>
  ) => Array<{ id: string; [key: string]: unknown }>;
  maybeYieldCatalogBuild: () => Promise<void>;
};

/**
 * Helper: check if a provider is active (by provider id or alias).
 */
function _isProviderActive(
  provider: string,
  activeAliases: Set<string>,
  blockedProviders: Set<string>,
  providerIdToAlias: Record<string, string>,
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string
): boolean {
  if (activeAliases.size === 0) return false;
  const alias = providerIdToAlias[provider] || provider;
  const canonicalProviderId = resolveCanonicalProviderId(alias, provider);

  if (
    blockedProviders.has(alias) ||
    blockedProviders.has(canonicalProviderId) ||
    blockedProviders.has(provider)
  ) {
    return false;
  }

  return activeAliases.has(alias) || activeAliases.has(provider);
}

function findEquivalentSpecialtyModel(
  models: Array<Record<string, unknown>>,
  providerId: string,
  rawModelId: string,
  type: string,
  scopedModelId: string
) {
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

function hasEquivalentSpecialtyModel(
  models: Array<Record<string, unknown>>,
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
 * Add custom models (user-defined), alias-backed models, and managed fallback models.
 */
export async function addCustomModels(ctx: CustomModelContext): Promise<void> {
  const {
    models,
    timestamp,
    connections,
    providerIdToPrefix,
    providerIdToAlias,
    nodeIdToProviderType,
    activeAliases,
    blockedProviders,
    includeAlias,
    includeCanonical,
    resolveCanonicalProviderId,
    resolvePublicOwnerId,
    isModelHiddenBulk,
    isExcludedByProviderConnections,
    shouldHidePaid,
    shouldHideByExposure,
    getConnectionsForProvider,
    maybeYieldCatalogBuild,
  } = ctx;

  // =========================================================================
  // Custom models (user-defined)
  // =========================================================================
  try {
    const customModelsMap = (await getAllCustomModels()) as Record<string, unknown>;
    for (const [providerId, rawProviderCustomModels] of Object.entries(customModelsMap)) {
      if (providerUsesCuratedModelsOnly(providerId)) continue;
      // Skip Gemini — handled by syncedAvailableModels above
      if (providerId === "gemini") continue;
      if (providerId === "reka") continue;
      const providerCustomModels: CustomModelEntry[] = Array.isArray(rawProviderCustomModels)
        ? rawProviderCustomModels.filter(
            (model): model is CustomModelEntry =>
              !!model && typeof model === "object" && !Array.isArray(model)
          )
        : [];
      const prefix = providerIdToPrefix[providerId];
      const alias = prefix || providerIdToAlias[providerId] || providerId;
      const canonicalProviderId = resolveCanonicalProviderId(alias, providerId);
      const selfAliased = canonicalProviderId === alias;

      const parentProviderType = nodeIdToProviderType[providerId];
      if (
        !activeAliases.has(alias) &&
        !activeAliases.has(canonicalProviderId) &&
        !activeAliases.has(providerId) &&
        !(parentProviderType && activeAliases.has(parentProviderType))
      )
        continue;

      for (const model of providerCustomModels) {
        const modelId = typeof model.id === "string" ? model.id : null;
        if (!modelId) continue;
        if (!isUnifiedChatSourceModelSelectable(canonicalProviderId, { ...model, id: modelId }))
          continue;
        if (model.isHidden === true) continue;
        if (isModelHiddenBulk(providerId, modelId, canonicalProviderId)) continue;
        if (isExcludedByProviderConnections(canonicalProviderId, modelId)) continue;
        // #6328: apply hidePaidModels to user-defined custom rows too.
        if (
          (model as { isFree?: unknown }).isFree !== true &&
          shouldHidePaid(
            canonicalProviderId,
            modelId,
            (model as { pricing?: unknown }).pricing,
            (model as any).isFree
          )
        )
          continue;
        if (shouldHideByExposure(canonicalProviderId, modelId)) continue;
        const isNoAuthProvider = isNoAuthProviderKey(canonicalProviderId, providerId, alias);
        if (
          (!isNoAuthProvider ||
            isNoAuthProviderBlocked(blockedProviders, canonicalProviderId, providerId, alias)) &&
          !hasEligibleConnectionForModel(
            getConnectionsForProvider(alias, canonicalProviderId, providerId, parentProviderType),
            modelId
          )
        ) {
          continue;
        }

        const aliasId = `${alias}/${modelId}`;
        const existingIndex = models.findIndex((m) => m.id === aliasId);
        if (existingIndex !== -1) {
          const existing = models[existingIndex] as Record<string, unknown> & { id: string };
          const endpoints = Array.isArray(model.supportedEndpoints)
            ? model.supportedEndpoints
            : undefined;
          const apiFormat = typeof model.apiFormat === "string" ? model.apiFormat : undefined;
          const visionFields =
            typeof model.supportsVision === "boolean"
              ? model.supportsVision
                ? getCustomVisionCapabilityFields(model, aliasId, modelId)
                : {
                    capabilities: {
                      ...((existing.capabilities as Record<string, unknown>) || {}),
                      vision: false,
                    },
                    input_modalities: ["text"],
                    output_modalities: ["text"],
                  }
              : null;
          models[existingIndex] = mergeCustomModelMetadata(existing, {
            id: aliasId,
            ...(typeof model.name === "string" ? { name: model.name } : {}),
            ...(apiFormat ? { api_format: apiFormat } : {}),
            ...(endpoints ? { supported_endpoints: endpoints } : {}),
            ...(typeof model.inputTokenLimit === "number"
              ? { context_length: model.inputTokenLimit }
              : {}),
            ...(typeof model.outputTokenLimit === "number"
              ? { max_output_tokens: model.outputTokenLimit }
              : {}),
            ...(visionFields || {}),
            custom: true,
          });
          continue;
        }

        // Determine type from supportedEndpoints
        const endpoints = Array.isArray(model.supportedEndpoints)
          ? model.supportedEndpoints
          : ["chat"];
        const apiFormat =
          typeof model.apiFormat === "string" ? model.apiFormat : "chat-completions";
        const classification = classifyModelSupportedEndpoints(endpoints);
        const modelType = classification.type;
        if (
          modelType &&
          hasEquivalentSpecialtyModel(models, canonicalProviderId, modelId, modelType, aliasId)
        ) {
          continue;
        }
        const visionFields = !modelType
          ? getCustomVisionCapabilityFields(model, aliasId, modelId)
          : null;

        if (includeAlias || Boolean(prefix) || selfAliased) {
          models.push({
            id: aliasId,
            object: "model",
            created: timestamp,
            owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
            permission: [],
            root: modelId,
            parent: null,
            custom: true,
            ...(modelType ? { type: modelType } : {}),
            ...(classification.subtype ? { subtype: classification.subtype } : {}),
            ...(apiFormat !== "chat-completions" ? { api_format: apiFormat } : {}),
            ...(endpoints.length > 1 || !endpoints.includes("chat")
              ? { supported_endpoints: endpoints }
              : {}),
            ...(typeof model.inputTokenLimit === "number"
              ? { context_length: model.inputTokenLimit }
              : {}),
            ...(typeof (model as any).outputTokenLimit === "number"
              ? { max_output_tokens: (model as any).outputTokenLimit }
              : {}),
            ...(visionFields || {}),
          });
        }

        if (includeCanonical && canonicalProviderId !== alias && !prefix && !isNoAuthProvider) {
          const providerPrefixedId = `${canonicalProviderId}/${modelId}`;
          if (models.some((m) => m.id === providerPrefixedId)) continue;
          const providerVisionFields = !modelType
            ? getCustomVisionCapabilityFields(model, providerPrefixedId, modelId)
            : null;
          models.push({
            id: providerPrefixedId,
            object: "model",
            created: timestamp,
            owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
            permission: [],
            root: modelId,
            parent: includeAlias ? aliasId : null,
            custom: true,
            ...(modelType ? { type: modelType } : {}),
            ...(typeof model.inputTokenLimit === "number"
              ? { context_length: model.inputTokenLimit }
              : {}),
            ...(typeof (model as any).outputTokenLimit === "number"
              ? { max_output_tokens: (model as any).outputTokenLimit }
              : {}),
            ...(providerVisionFields || {}),
          });
        }

        await maybeYieldCatalogBuild();
      }
    }
  } catch (_e) {
    console.log("Could not fetch custom models");
  }

  // =========================================================================
  // Alias-backed models
  // =========================================================================
  try {
    const modelAliases = await getModelAliases();
    const aliasBacked = extractAliasBackedModels(modelAliases);
    for (const { providerKey, modelId } of aliasBacked) {
      const canonicalProviderId = resolveCanonicalProviderId(providerKey);
      if (!canonicalProviderId) continue;
      if (
        blockedProviders.has(providerKey) ||
        blockedProviders.has(canonicalProviderId) ||
        isNoAuthProviderBlocked(blockedProviders, canonicalProviderId, providerKey)
      ) {
        continue;
      }

      const nodePrefix =
        providerIdToPrefix[providerKey] || providerIdToPrefix[canonicalProviderId];
      const alias = nodePrefix || providerIdToAlias[canonicalProviderId] || providerKey;
      if (
        !activeAliases.has(alias) &&
        !activeAliases.has(canonicalProviderId) &&
        !activeAliases.has(providerKey)
      ) {
        continue;
      }

      if (isModelHiddenBulk(providerKey, modelId, canonicalProviderId)) continue;
      if (isExcludedByProviderConnections(canonicalProviderId, modelId)) continue;
      // #6328: apply hidePaidModels to alias-backed rows too.
      if (shouldHidePaid(canonicalProviderId, modelId)) continue;
      if (shouldHideByExposure(canonicalProviderId, modelId)) continue;

      const aliasId = `${alias}/${modelId}`;
      const rawPrefixedId = `${providerKey}/${modelId}`;
      if (
        models.some((m: any) => m?.id === aliasId) ||
        models.some((m: any) => m?.id === rawPrefixedId)
      ) {
        continue;
      }

      const visionFields =
        getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(modelId);

      const selfAliased = canonicalProviderId === alias;
      if (includeAlias || Boolean(nodePrefix) || selfAliased) {
        models.push({
          id: aliasId,
          object: "model",
          created: timestamp,
          owned_by: resolvePublicOwnerId(providerKey, canonicalProviderId),
          permission: [],
          root: modelId,
          parent: null,
          ...(visionFields || {}),
        });
      }
      if (
        includeCanonical &&
        canonicalProviderId !== alias &&
        !nodePrefix &&
        !isNoAuthProviderKey(canonicalProviderId) &&
        prefixRoutesToProvider(canonicalProviderId, canonicalProviderId)
      ) {
        const providerPrefixedId = `${canonicalProviderId}/${modelId}`;
        if (models.some((m: any) => m?.id === providerPrefixedId)) continue;
        const providerVisionFields =
          getVisionCapabilityFields(providerPrefixedId) || getVisionCapabilityFields(modelId);
        models.push({
          id: providerPrefixedId,
          object: "model",
          created: timestamp,
          owned_by: resolvePublicOwnerId(providerKey, canonicalProviderId),
          permission: [],
          root: modelId,
          parent: includeAlias ? aliasId : null,
          ...(providerVisionFields || {}),
        });
      }
    }
  } catch (_e) {
    console.log("Could not fetch model aliases");
  }

  // =========================================================================
  // Managed fallback models
  // =========================================================================
  for (const conn of connections) {
    const providerId = typeof conn.provider === "string" ? conn.provider : null;
    if (!providerId) continue;
    if (blockedProviders.has(providerId)) continue;

    const fallbackModels = getCompatibleFallbackModels(providerId);
    if (!Array.isArray(fallbackModels) || fallbackModels.length === 0) continue;

    const prefix = providerIdToPrefix[providerId];
    const alias = prefix || providerIdToAlias[providerId] || providerId;
    const canonicalProviderId = resolveCanonicalProviderId(alias, providerId);

    for (const model of fallbackModels) {
      const modelId = typeof model.id === "string" ? model.id : null;
      if (!modelId) continue;
      if (isModelHiddenBulk(providerId, modelId, canonicalProviderId)) continue;
      if (isExcludedByProviderConnections(canonicalProviderId, modelId)) continue;
      // #6328: apply hidePaidModels to managed-fallback rows too.
      if (shouldHidePaid(canonicalProviderId, modelId, (model as { pricing?: unknown }).pricing))
        continue;
      if (shouldHideByExposure(canonicalProviderId, modelId)) continue;
      if (!hasEligibleConnectionForModel([conn], modelId)) continue;

      const aliasId = `${alias}/${modelId}`;
      if (models.some((m) => m.id === aliasId)) continue;

      const visionFields =
        getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(modelId);
      const contextLength =
        typeof model.contextLength === "number" ? model.contextLength : undefined;

      models.push({
        id: aliasId,
        object: "model",
        created: timestamp,
        owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
        permission: [],
        root: modelId,
        parent: null,
        ...(contextLength ? { context_length: contextLength } : {}),
        ...(visionFields || {}),
      });

      await maybeYieldCatalogBuild();
    }
  }
}
