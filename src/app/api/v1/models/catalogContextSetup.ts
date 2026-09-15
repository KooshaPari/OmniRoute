/**
 * Catalog build context setup.
 *
 * Extracted from catalog.ts to keep that file under the 500-line target.
 * Handles: settings, connections, provider nodes, alias maps, hidden models,
 * combo resolution, and shared helper function construction.
 */
import { PROVIDER_ID_TO_ALIAS, PROVIDER_MODELS } from "@/shared/constants/models";
import { getSettings } from "@/lib/db/settings";
import { createLazyConnectionView } from "@/lib/db/providers/lazyConnectionView";
import { NOAUTH_PROVIDERS } from "@/shared/constants/providers";
import { getCombos } from "@/lib/db/combos";
import { getHiddenModelsByProvider } from "@/lib/db/models";
import { getCachedRawProviderConnections, getCachedProviderNodes } from "@/lib/db/readCache";
import { getModelsCatalogPrefixMode } from "@/shared/utils/featureFlags";
import {
  isProviderNodePrefixReserved,
  selectCompatibleNodeForPrefix,
} from "@/lib/providerNodePrefixes";
import { resolveNestedComboTargets } from "@omniroute/open-sse/services/combo";
import {
  normalizeBlockedProviderSet,
  isNoAuthProviderBlocked,
  isNoAuthProviderKey,
} from "@/shared/utils/noAuthProviders";
import { isModelExposureAllowed } from "@/shared/utils/modelExposureList";
import { decideHidePaid } from "./catalogPaidFilter";
import { getModelCatalogAuthRejection } from "./catalogRequest";
import {
  resolveCanonicalProviderId as resolveCanonicalProviderIdFromMaps,
  getComboTargetModelId as getComboTargetModelIdFromMaps,
} from "./catalogProviderMaps";
import {
  getSyncedAvailableModelsByConnection,
  SYNCED_AVAILABLE_MODELS_MALFORMED,
} from "@/lib/db/models";
import { hasEligibleConnectionForModel } from "@/domain/connectionModelRules";
import { yieldCatalogBuildTurn } from "./catalogBuildHelpers";
import type { ComboCatalogTarget } from "./catalogHelpers";
import type { ConnectionScopedReasoningCatalog } from "./catalogHelpers";
import type { CatalogBuildContext } from "./catalogBuildHelpers";
import { buildComboCatalogMetadata } from "./catalogComboMetadata";

/**
 * Fully initialize and return a CatalogBuildContext.
 * This calls DB/registry APIs, builds alias maps, loads combos, etc.
 */
export async function createCatalogContext(
  request: Request,
  corsHeaders: Record<string, string>,
  diagnosticHeaders: Record<string, string>
): Promise<CatalogBuildContext> {
  const catYIELD_EVERY = 5;
  let catYieldCount = 0;
  const maybeYieldCatalogBuild = async (): Promise<void> => {
    catYieldCount++;
    if (catYieldCount % catYIELD_EVERY === 0) {
      await yieldCatalogBuildTurn();
    }
  };

  // Settings
  let settings: Record<string, any> = {};
  try {
    settings = await getSettings();
  } catch {}

  const authRejection = await getModelCatalogAuthRejection(request, settings, {
    ...corsHeaders,
    ...diagnosticHeaders,
  });
  if (authRejection) return undefined as any; // Caller checks before calling this

  await yieldCatalogBuildTurn();

  const { buildAliasMaps } = await import("./catalogProviderMaps");
  const { aliasToProviderId, providerIdToAlias } = buildAliasMaps();
  const _qp = new URL(request.url).searchParams.get("prefix");
  const prefixMode =
    _qp === "alias" || _qp === "canonical" || _qp === "dual" ? _qp : getModelsCatalogPrefixMode();
  const includeAlias = prefixMode !== "canonical";
  const includeCanonical = prefixMode !== "alias";
  const resolveCanonicalProviderId = (aliasOrProviderId: string, fallbackProviderId?: string) =>
    resolveCanonicalProviderIdFromMaps(aliasToProviderId, aliasOrProviderId, fallbackProviderId);
  const aliasMaps = { aliasToProviderId, providerIdToAlias };

  const blockedProviders = normalizeBlockedProviderSet(settings.blockedProviders);
  const hidePaid = settings.hidePaidModels === true;
  const hideAuto = settings.hideAutoCombos === true || settings.autoRoutingEnabled === false;
  const shouldHidePaid = (
    providerKey: string,
    modelId: string,
    pricing?: unknown,
    isFree?: boolean
  ): boolean => decideHidePaid(hidePaid, providerKey, modelId, pricing, isFree, aliasToProviderId);
  const shouldHideByExposure = (providerKey: string, modelId: string): boolean =>
    !isModelExposureAllowed(aliasToProviderId[providerKey] || providerKey, modelId, settings);

  // Connections
  let connections: any[] = [];
  try {
    connections = (await getCachedRawProviderConnections()).map(createLazyConnectionView);
    connections = connections.filter((c: any) => c.isActive !== false);
  } catch (e) {
    console.log("[catalog] Could not fetch providers:", e);
  }

  // Provider nodes
  let providerNodes: any[] = [];
  try {
    providerNodes = await getCachedProviderNodes();
  } catch {
    console.log("Could not fetch provider nodes");
  }

  const providerIdToPrefix: Record<string, string> = {};
  const providerNodeIdByPrefix: Record<string, string> = {};
  const nodeIdToProviderType: Record<string, string> = {};
  for (const node of providerNodes) {
    const resolvedPrefix =
      node.prefix?.trim() ||
      node.name
        ?.trim()
        ?.toLowerCase()
        ?.replace(/\s+/g, "-")
        ?.replace(/[^a-z0-9-]/g, "") ||
      null;
    if (resolvedPrefix) providerIdToPrefix[node.id] = resolvedPrefix;
    if (node.type) nodeIdToProviderType[node.id] = node.type;
  }
  for (const prefix of new Set(Object.values(providerIdToPrefix))) {
    if (isProviderNodePrefixReserved(prefix)) continue;
    const winner = selectCompatibleNodeForPrefix(providerNodes, prefix);
    if (winner?.id) providerNodeIdByPrefix[prefix] = winner.id;
  }

  const resolvePublicOwnerId = (providerId: string, canonicalProviderId: string): string =>
    providerIdToPrefix[providerId] || canonicalProviderId;

  // Hidden models by modality
  const hiddenModelsByModality = new Map<string, Map<string, Set<string>>>();
  const getHiddenModelsForModality = (modality: string): Map<string, Set<string>> => {
    let m = hiddenModelsByModality.get(modality);
    if (!m) {
      m = getHiddenModelsByProvider(modality);
      hiddenModelsByModality.set(modality, m);
    }
    return m;
  };

  const isModelHiddenBulk = (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality: string = "chat"
  ): boolean => {
    if (!providerKey || !modelId) return false;
    const canonical = canonicalProviderId || resolveCanonicalProviderId(providerKey);
    const alias = providerIdToAlias[canonical] || providerIdToAlias[providerKey] || undefined;
    const nodePrefix = providerIdToPrefix[providerKey] || providerIdToPrefix[canonical];
    const keysToCheck = [providerKey, canonical, alias, nodePrefix].filter((k): k is string =>
      Boolean(k)
    );
    const hiddenModelsForModality = getHiddenModelsForModality(modality);
    for (const key of keysToCheck) {
      if (hiddenModelsForModality.get(key)?.has(modelId)) return true;
    }
    return false;
  };

  // Combos
  let combos: any[] = [];
  await yieldCatalogBuildTurn();
  try {
    combos = await getCombos();
  } catch {
    console.log("Could not fetch combos");
  }

  // Active aliases
  const activeAliases = new Set<string>();
  const connectionsByProvider = new Map<string, any[]>();
  const registerConnectionKey = (key: string | null | undefined, connection: any) => {
    if (!key) return;
    const existing = connectionsByProvider.get(key) || [];
    existing.push(connection);
    connectionsByProvider.set(key, existing);
  };
  for (const conn of connections) {
    const alias = providerIdToAlias[conn.provider] || conn.provider;
    activeAliases.add(alias);
    activeAliases.add(conn.provider);
    registerConnectionKey(alias, conn);
    registerConnectionKey(conn.provider, conn);
  }
  for (const p of Object.values(NOAUTH_PROVIDERS)) {
    if (isNoAuthProviderBlocked(blockedProviders, p.id, "alias" in p ? p.alias : null)) continue;
    activeAliases.add(p.id);
    if ("alias" in p && typeof p.alias === "string") activeAliases.add(p.alias);
  }

  // Connections-for-provider cache
  const connectionsForProviderCache = new Map<string, any[]>();
  const getConnectionsForProvider = (...keys: Array<string | null | undefined>) => {
    const cacheKey = keys
      .filter((k): k is string => Boolean(k))
      .sort()
      .join("\u0000");
    const cached = connectionsForProviderCache.get(cacheKey);
    if (cached) return cached;
    const seen = new Set<string>();
    const collected: any[] = [];
    for (const key of keys) {
      if (!key) continue;
      for (const connection of connectionsByProvider.get(key) || []) {
        if (!connection?.id || seen.has(connection.id)) continue;
        seen.add(connection.id);
        collected.push(connection);
      }
    }
    connectionsForProviderCache.set(cacheKey, collected);
    return collected;
  };

  const isExcludedByProviderConnections = (providerKey: string, modelId: string) => {
    const providerId = aliasToProviderId[providerKey] || providerKey;
    const alias = providerIdToAlias[providerId] || providerKey;
    const providerConnections = getConnectionsForProvider(providerId, alias, providerKey);
    if (providerConnections.length === 0) return false;
    return !hasEligibleConnectionForModel(providerConnections, modelId);
  };

  const providerSupportsModel = (providerKey: string, modelId: string) => {
    const providerId = aliasToProviderId[providerKey] || providerKey;
    const alias = providerIdToAlias[providerId] || providerKey;
    const isNoAuth = isNoAuthProviderKey(providerId, providerKey, alias);
    if (isNoAuth && !isNoAuthProviderBlocked(blockedProviders, providerId, providerKey, alias))
      return true;
    return hasEligibleConnectionForModel(
      getConnectionsForProvider(providerKey, providerId, alias),
      modelId
    );
  };

  // Combo target resolution
  const resolvedComboTargets = combos.flatMap(
    (combo) =>
      resolveNestedComboTargets(
        combo as Parameters<typeof resolveNestedComboTargets>[0],
        combos as Parameters<typeof resolveNestedComboTargets>[1]
      ) as ComboCatalogTarget[]
  );

  const getComboTargetModelId = (target: ComboCatalogTarget) => {
    const resolved = getComboTargetModelIdFromMaps(aliasMaps, target);
    if (!resolved) return null;
    const nodeId = providerNodeIdByPrefix[resolved.providerId];
    return nodeId ? { ...resolved, providerId: nodeId } : resolved;
  };

  const comboProviderIds = new Set(
    resolvedComboTargets.flatMap((target) => {
      const resolved = getComboTargetModelId(target);
      return resolved ? [resolved.providerId] : [];
    })
  );
  const comboSyncedModelsByProvider = new Map<string, ConnectionScopedReasoningCatalog | null>();
  await Promise.all(
    [...comboProviderIds].map(async (providerId) => {
      try {
        const byConnection = await getSyncedAvailableModelsByConnection(providerId);
        comboSyncedModelsByProvider.set(
          providerId,
          byConnection[SYNCED_AVAILABLE_MODELS_MALFORMED] ? null : byConnection
        );
      } catch {
        comboSyncedModelsByProvider.set(providerId, null);
      }
    })
  );

  const getRegistryModel = (providerId: string, modelId: string) => {
    const alias = providerIdToAlias[providerId] || PROVIDER_ID_TO_ALIAS[providerId] || providerId;
    const providerModels = PROVIDER_MODELS[alias] || PROVIDER_MODELS[providerId] || [];
    return providerModels.find((model: any) => model?.id === modelId) || null;
  };

  // Combo metadata context
  const comboMetadataCtx = {
    aliasToProviderId,
    providerIdToAlias,
    capabilityResolutionSnapshot: undefined as any, // Set after creation
    getConnectionsForProvider,
    hasEligibleConnectionForModel,
    getComboTargetModelId,
    getRegistryModel,
    comboSyncedModelsByProvider,
  };

  const boundBuildComboCatalogMetadata = (
    combo: { context_length?: number },
    targets: ComboCatalogTarget[]
  ) => buildComboCatalogMetadata(combo, targets, comboMetadataCtx);

  const models: any[] = [];
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    request,
    corsHeaders,
    diagnosticHeaders,
    settings,
    hidePaid,
    hideAuto,
    blockedProviders,
    aliasToProviderId,
    providerIdToAlias,
    aliasMaps,
    prefixMode,
    includeAlias,
    includeCanonical,
    connections,
    connectionsByProvider,
    getConnectionsForProvider,
    providerIdToPrefix,
    providerNodeIdByPrefix,
    nodeIdToProviderType,
    activeAliases,
    timestamp,
    resolveCanonicalProviderId,
    resolvePublicOwnerId,
    isModelHiddenBulk,
    isExcludedByProviderConnections,
    providerSupportsModel,
    shouldHidePaid,
    shouldHideByExposure,
    maybeYieldCatalogBuild,
    combos,
    resolvedComboTargets,
    buildComboCatalogMetadata: boundBuildComboCatalogMetadata,
    getComboTargetModelId,
    capabilityResolutionSnapshot: comboMetadataCtx.capabilityResolutionSnapshot,
    syncedModelsByProvider: {},
    models,
  } as CatalogBuildContext;
}
