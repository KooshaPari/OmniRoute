/**
 * Combo target metadata resolution and aggregation.
 *
 * Extracted from catalog.ts to reduce file size.
 * Exports `getComboTargetCatalogMetadata` and `buildComboCatalogMetadata`.
 */
import { PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import {
  getRegistryModelThinkingEfforts,
  getRegistryThinkingEfforts,
} from "@/omniroute/open-sse/config/providerRegistry";
import { resolveNestedComboTargets } from "@/omniroute/open-sse/services/combo";
import { getSourcedTokenLimit } from "@/omniroute/open-sse/services/contextManager";
import { getCanonicalModelMetadata } from "@/lib/modelMetadataRegistry";
import { getModelSpec } from "@/shared/constants/modelSpecs";
import { getSyncedCapability } from "@/lib/modelsDevSync";
import { hasEligibleConnectionForModel } from "@/domain/connectionModelRules";
import type { CatalogBuildContext } from "./catalogBuildTypes";
import type {
  ComboCatalogTarget,
  ComboTargetCatalogMetadata,
} from "./catalogHelpers";
import {
  isPositiveFiniteNumber,
  parseJsonStringArray,
  intersectKnownStringArrays,
  minKnownNumber,
  getThinkingCapabilityFields,
  mergeComboCapabilities,
  getConnectionScopedEffortTiers,
} from "./catalogHelpers";

type ComboMetadataPick = Pick<
  CatalogBuildContext,
  | "capabilityResolutionSnapshot"
  | "providerIdToAlias"
  | "getComboTargetModelId"
  | "getConnectionsForProvider"
  | "getRegistryModel"
  | "comboSyncedModelsByProvider"
>;

/**
 * Resolve a combo target's catalog metadata (context length, capabilities, etc.).
 * Returns null when the target cannot be resolved (unknown provider/model).
 */
export function getComboTargetCatalogMetadata(
  target: ComboCatalogTarget,
  ctx: ComboMetadataPick
): ComboTargetCatalogMetadata | null {
  const targetModel = ctx.getComboTargetModelId(target);
  if (!targetModel) return null;

  const canonical = getCanonicalModelMetadata({
    provider: targetModel.providerId,
    model: targetModel.modelId,
    snapshot: ctx.capabilityResolutionSnapshot,
  });
  if (!canonical) return null;

  const providerId = canonical.provider || targetModel.providerId;
  const modelId = canonical.model || targetModel.modelId;
  const providerAlias =
    ctx.providerIdToAlias[providerId] || PROVIDER_ID_TO_ALIAS[providerId];
  const allProviderConnections = ctx.getConnectionsForProvider(
    providerId,
    providerAlias,
    targetModel.providerId
  );
  const providerConnections = allProviderConnections.filter((connection) =>
    hasEligibleConnectionForModel([connection], modelId)
  );
  const hasExplicitConnectionScope =
    Boolean(target.connectionId) || Boolean(target.allowedConnectionIds?.length);
  const eligibleConnectionIds =
    allProviderConnections.length > 0 || hasExplicitConnectionScope
      ? providerConnections.map((connection) => connection.id)
      : undefined;
  const source = canonical.metadata.source;
  const connectionCatalog = ctx.comboSyncedModelsByProvider.get(providerId);
  const connectionEfforts = source.reasoningEffortsOverride
    ? canonical.capabilities.supportedThinkingEfforts
      ? [...canonical.capabilities.supportedThinkingEfforts]
      : []
    : connectionCatalog === null
      ? []
      : getConnectionScopedEffortTiers(
          modelId,
          target,
          eligibleConnectionIds,
          connectionCatalog || {},
          getRegistryModelThinkingEfforts(providerId, modelId),
          getRegistryThinkingEfforts(providerId, modelId)
        );
  if (
    connectionEfforts === undefined &&
    !source.providerRegistry &&
    !source.staticSpec &&
    !source.syncedCapability &&
    !source.reasoningEffortsOverride
  ) {
    return null;
  }

  const synced = getSyncedCapability(providerId, modelId);
  const spec = getModelSpec(modelId);
  const registryModel = ctx.getRegistryModel(providerId, modelId);
  const syncedInputModalities = parseJsonStringArray(synced?.modalities_input);
  const syncedOutputModalities = parseJsonStringArray(synced?.modalities_output);

  const contextLength = getSourcedTokenLimit(
    providerId,
    modelId,
    canonical.limits.contextWindow
  );
  const maxInputTokens = isPositiveFiniteNumber(canonical.limits.maxInputTokens)
    ? canonical.limits.maxInputTokens
    : contextLength;
  const maxOutputTokens = isPositiveFiniteNumber(synced?.limit_output)
    ? synced.limit_output
    : isPositiveFiniteNumber(spec?.maxOutputTokens)
      ? spec.maxOutputTokens
      : undefined;

  const syncedVision =
    typeof synced?.attachment === "boolean"
      ? synced.attachment
      : syncedInputModalities.length > 0 || syncedOutputModalities.length > 0
        ? [...syncedInputModalities, ...syncedOutputModalities].some((entry) =>
            // eslint-disable-next-line no-restricted-syntax -- teknik string kontrolu, kullanici metni aramasi degil
            entry.toLowerCase().includes("image")
          )
        : undefined;
  const registryVision =
    typeof registryModel?.supportsVision === "boolean"
      ? registryModel.supportsVision
      : undefined;
  const specVision =
    typeof spec?.supportsVision === "boolean" ? spec.supportsVision : undefined;
  const knownVision = syncedVision ?? registryVision ?? specVision;

  const inputModalities =
    syncedInputModalities.length > 0
      ? syncedInputModalities
      : knownVision === true
        ? ["text", "image"]
        : undefined;
  const outputModalities =
    syncedOutputModalities.length > 0
      ? syncedOutputModalities
      : knownVision === true
        ? ["text"]
        : undefined;

  const capabilities: Record<string, boolean | string[]> = {};
  capabilities.tool_calling = canonical.capabilities.toolCalling;
  capabilities.reasoning = canonical.capabilities.reasoning;
  if (typeof canonical.capabilities.vision === "boolean") {
    capabilities.vision = canonical.capabilities.vision;
  }
  if (typeof canonical.capabilities.attachment === "boolean") {
    capabilities.attachment = canonical.capabilities.attachment;
  }
  if (typeof canonical.capabilities.structuredOutput === "boolean") {
    capabilities.structured_output = canonical.capabilities.structuredOutput;
  }
  if (typeof canonical.capabilities.temperature === "boolean") {
    capabilities.temperature = canonical.capabilities.temperature;
  }
  Object.assign(
    capabilities,
    connectionEfforts === undefined
      ? getThinkingCapabilityFields(
          providerId,
          modelId,
          canonical.capabilities.supportsThinking,
          getRegistryThinkingEfforts(providerId, modelId),
          true
        )
      : getThinkingCapabilityFields(
          providerId,
          modelId,
          connectionEfforts.length > 0 ? true : canonical.capabilities.supportsThinking,
          connectionEfforts,
          true
        )
  );

  return {
    ...(contextLength ? { contextLength } : {}),
    ...(maxInputTokens ? { maxInputTokens } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    ...(inputModalities && inputModalities.length > 0 ? { inputModalities } : {}),
    ...(outputModalities && outputModalities.length > 0 ? { outputModalities } : {}),
    capabilities,
  };
}

/**
 * Build aggregated metadata for a combo by merging its resolved targets.
 */
export function buildComboCatalogMetadata(
  combo: Parameters<typeof resolveNestedComboTargets>[0],
  targets: ComboCatalogTarget[],
  ctx: ComboMetadataPick
): Record<string, unknown> {
  const explicitContextLength = isPositiveFiniteNumber(combo.context_length)
    ? combo.context_length
    : undefined;

  const baseMetadata = explicitContextLength ? { context_length: explicitContextLength } : {};
  if (targets.length === 0) return baseMetadata;

  const targetMetadata = targets.map((target) => getComboTargetCatalogMetadata(target, ctx));

  const knownMetadata = targetMetadata.filter(
    (metadata): metadata is ComboTargetCatalogMetadata => metadata !== null
  );
  if (knownMetadata.length === 0) return baseMetadata;
  const contextLength =
    explicitContextLength ??
    minKnownNumber(knownMetadata.map((metadata) => metadata.contextLength));
  const maxInputTokens = minKnownNumber(
    knownMetadata.map((metadata) => metadata.maxInputTokens)
  );
  const maxOutputTokens = minKnownNumber(
    knownMetadata.map((metadata) => metadata.maxOutputTokens)
  );

  const inputModalities = intersectKnownStringArrays(
    knownMetadata.map((m) => (Array.isArray(m.inputModalities) ? m.inputModalities : []))
  );
  const outputModalities = intersectKnownStringArrays(
    knownMetadata.map((m) => (Array.isArray(m.outputModalities) ? m.outputModalities : []))
  );

  const capabilities = mergeComboCapabilities(knownMetadata);
  if (targetMetadata.some((metadata) => metadata === null)) {
    delete capabilities.effort_tiers;
  }

  return {
    ...baseMetadata,
    ...(contextLength ? { context_length: contextLength } : {}),
    ...(maxInputTokens ? { max_input_tokens: maxInputTokens } : {}),
    ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
    ...(inputModalities.length > 0 ? { input_modalities: inputModalities } : {}),
    ...(outputModalities.length > 0 ? { output_modalities: outputModalities } : {}),
    ...(Object.keys(capabilities).length > 0 ? { capabilities } : {}),
  };
}
