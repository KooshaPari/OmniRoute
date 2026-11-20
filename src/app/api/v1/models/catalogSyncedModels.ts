/**
 * Synced model catalog loop — processes live-discovered models from provider
 * connections and merges them into the catalog.
 *
 * Extracted from catalog.ts to reduce file size.
 */
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry";
import { isRegisteredImageModel } from "@omniroute/open-sse/config/imageRegistry";
import { ensureCursorAutoCatalogEntry } from "@/lib/providerModels/cursorAutoCatalog";
import {
  providerUsesCuratedModelsOnly,
  providerUsesExclusiveSyncedListing,
} from "@/lib/providers/modelListingCapability";
import { buildSyncedCapabilities, mergeSyncedCapabilities } from "./syncedCapabilities";
import { classifyModelSupportedEndpoints } from "@/shared/constants/modelSupportedEndpoints";
import { isCodexDiscoveryModelExcluded } from "@/shared/services/codexDiscoveryPolicy";
import { isUnifiedChatSourceModelSelectable } from "./catalogModelPolicy";
import type { SyncedAvailableModel } from "@/lib/db/models";

type SyncedModelContext = {
  models: Array<Record<string, unknown>>;
  timestamp: number;
  syncedModelsByProvider: Record<string, SyncedAvailableModel[]>;
  providerIdToPrefix: Record<string, string>;
  providerIdToAlias: Record<string, string>;
  nodeIdToProviderType: Record<string, string>;
  activeAliases: Set<string>;
  blockedProviders: Set<string>;
  hidePaid: boolean;
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
  shouldHidePaid: (providerKey: string, modelId: string, pricing?: unknown) => boolean;
  shouldHideByExposure: (providerKey: string, modelId: string) => boolean;
  maybeYieldCatalogBuild: () => Promise<void>;
};

/**
 * Process synced (live-discovered) models and push them into `ctx.models`.
 * Also processes the OpenRouter catalog when applicable.
 */
export async function addSyncedModels(ctx: SyncedModelContext): Promise<void> {
  const {
    models,
    timestamp,
    syncedModelsByProvider,
    providerIdToPrefix,
    providerIdToAlias,
    nodeIdToProviderType,
    activeAliases,
    blockedProviders,
    includeAlias,
    includeCanonical,
    resolveCanonicalProviderId,
    resolvePublicOwnerId,
    providerSupportsModel,
    isModelHiddenBulk,
    isExcludedByProviderConnections,
    shouldHidePaid,
    shouldHideByExposure,
    maybeYieldCatalogBuild,
  } = ctx;

  try {
    for (const [providerId, syncedModels] of Object.entries(syncedModelsByProvider)) {
      if (providerUsesCuratedModelsOnly(providerId)) continue;
      if (!Array.isArray(syncedModels) || syncedModels.length === 0) continue;
      if (blockedProviders.has(providerId)) continue;
      if (providerId === "reka") continue;

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
      ) {
        continue;
      }

      for (const sm of providerUsesExclusiveSyncedListing(providerId)
        ? ensureCursorAutoCatalogEntry(
            syncedModels.map((row) => ({
              ...row,
              id: row.id,
              name: row.name || row.id,
              owned_by: "cursor",
            }))
          )
        : syncedModels) {
        if (!isUnifiedChatSourceModelSelectable(canonicalProviderId, sm)) continue;
        if (!providerSupportsModel(canonicalProviderId, sm.id)) continue;
        if (canonicalProviderId === "codex" && isCodexDiscoveryModelExcluded(sm)) {
          continue;
        }
        if (isModelHiddenBulk(providerId, sm.id, canonicalProviderId)) continue;
        if (isExcludedByProviderConnections(canonicalProviderId, sm.id)) continue;
        // #6457: skip a registered image model only when its synced metadata
        // does not explicitly advertise a chat endpoint.
        const explicitlySupportsChat = sm.supportedEndpoints?.some(
          (endpoint) => endpoint === "chat" || endpoint === "responses"
        );
        if (
          !explicitlySupportsChat &&
          (isRegisteredImageModel(canonicalProviderId, sm.id) ||
            isRegisteredImageModel(providerId, sm.id))
        ) {
          continue;
        }
        // #6328: apply hidePaidModels to synced provider rows too.
        if (shouldHidePaid(canonicalProviderId, sm.id, (sm as { pricing?: unknown }).pricing))
          continue;
        if (shouldHideByExposure(canonicalProviderId, sm.id)) continue;

        const registryEntry = REGISTRY[providerId];
        const displayModelId =
          registryEntry?.modelIdPrefix && sm.id.startsWith(registryEntry.modelIdPrefix)
            ? sm.id.slice(registryEntry.modelIdPrefix.length)
            : sm.id;

        const aliasId = `${alias}/${displayModelId}`;
        const endpoints = Array.isArray(sm.supportedEndpoints) ? sm.supportedEndpoints : ["chat"];
        const apiFormat = typeof sm.apiFormat === "string" ? sm.apiFormat : "chat-completions";
        const classification = classifyModelSupportedEndpoints(endpoints);
        const modelType = classification.type;
        const syncedOwnedBy = resolvePublicOwnerId(providerId, canonicalProviderId);
        const syncedFields = {
          ...(modelType ? { type: modelType } : {}),
          ...(apiFormat !== "chat-completions" ? { api_format: apiFormat } : {}),
          ...(classification.subtype ? { subtype: classification.subtype } : {}),
          ...(sm.inputTokenLimit ? { context_length: sm.inputTokenLimit } : {}),
          ...(typeof sm.outputTokenLimit === "number"
            ? { max_output_tokens: sm.outputTokenLimit }
            : {}),
          ...(endpoints.length > 1 || !endpoints.includes("chat")
            ? { supported_endpoints: endpoints }
            : {}),
          ...(buildSyncedCapabilities(sm, syncedOwnedBy)
            ? { capabilities: buildSyncedCapabilities(sm, syncedOwnedBy) }
            : {}),
        };

        const existingAliasModel = models.find((model) => model.id === aliasId);
        if (existingAliasModel) {
          const mergedCapabilities = mergeSyncedCapabilities(
            existingAliasModel.capabilities,
            sm,
            syncedOwnedBy
          );
          Object.assign(existingAliasModel, syncedFields);
          if (mergedCapabilities) existingAliasModel.capabilities = mergedCapabilities;
          continue;
        }

        if (includeAlias || Boolean(prefix) || selfAliased) {
          models.push({
            id: aliasId,
            object: "model",
            created: timestamp,
            owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
            permission: [],
            root: sm.id,
            parent: null,
            ...syncedFields,
          });
        }
        if ((includeAlias || Boolean(prefix)) && modelType === "audio") {
          models.push({
            id: aliasId,
            object: "model",
            created: timestamp,
            owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
            permission: [],
            root: sm.id,
            parent: null,
            type: "audio",
            subtype: "speech",
            ...(sm.inputTokenLimit ? { context_length: sm.inputTokenLimit } : {}),
            ...(typeof sm.outputTokenLimit === "number"
              ? { max_output_tokens: sm.outputTokenLimit }
              : {}),
            ...(endpoints.length > 1 || !endpoints.includes("chat")
              ? { supported_endpoints: endpoints }
              : {}),
          });
        }

        if (includeCanonical && canonicalProviderId !== alias && !prefix) {
          const providerPrefixedId = `${canonicalProviderId}/${displayModelId}`;
          if (!models.some((model) => model.id === providerPrefixedId)) {
            models.push({
              id: providerPrefixedId,
              object: "model",
              created: timestamp,
              owned_by: resolvePublicOwnerId(providerId, canonicalProviderId),
              permission: [],
              root: sm.id,
              parent: includeAlias ? aliasId : null,
              ...syncedFields,
            });
          }
        }

        await maybeYieldCatalogBuild();
      }
    }
  } catch (err) {
    console.error("[catalog] Error fetching synced provider models:", err);
  }
}
