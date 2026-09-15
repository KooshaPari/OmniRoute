import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { NOAUTH_PROVIDERS } from "@/shared/constants/providers";
import { getCombos } from "@/lib/db/combos";
import { getSettings } from "@/lib/db/settings";
import { getUserDatabaseSettings } from "@/lib/db/databaseSettings";
import { createLazyConnectionView } from "@/lib/db/providers/lazyConnectionView";
import {
  getSyncedAvailableModelsByConnection,
  SYNCED_AVAILABLE_MODELS_MALFORMED,
  type SyncedAvailableModel,
  getHiddenModelsByProvider,
} from "@/lib/db/models";
import { getAllActiveSyncedModels } from "@/lib/db/models/activeSyncedCatalog";
import {
  getCachedRawProviderConnections,
  getCachedProviderNodes,
} from "@/lib/db/readCache";
import { providerUsesCuratedModelsOnly } from "@/lib/providers/modelListingCapability";
import { getOpenRouterCatalog } from "@/lib/catalog/openrouterCatalog";
import { hasEligibleConnectionForModel } from "@/domain/connectionModelRules";
import {
  INTERNAL_PROXY_ERROR,
  getCatalogDiagnosticsHeaders,
  type CatalogEnrichmentSnapshot,
} from "@/lib/modelMetadataRegistry";
import { createModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilityResolutionSnapshot";
import { getModelsDevPricing, upsertSyncedCapabilities } from "@/lib/modelsDevSync";
import type { ModelCapabilityEntry } from "@/lib/modelsDevSync";
import { getModelsCatalogPrefixMode } from "@/shared/utils/featureFlags";
import {
  isProviderNodePrefixReserved,
  selectCompatibleNodeForPrefix,
} from "@/lib/providerNodePrefixes";
import { applyCatalogPostFilters, finalizeCatalogResponse } from "./catalogResponse";
import {
  isNoAuthProviderBlocked,
  isNoAuthProviderKey,
  normalizeBlockedProviderSet,
} from "@/shared/utils/noAuthProviders";
import { getTokenLimit } from "@omniroute/open-sse/services/contextManager";
import { extractApiKey } from "@/sse/services/auth";
import type { ComboCatalogTarget } from "./catalogHelpers";
import {
  qualifyOpenRouterModelId,
  normalizeOpenRouterModalities,
  getOpenRouterModelType,
  isOpenRouterFreeModel,
  getOpenRouterDisplayName,
  openRouterCapabilityEntry,
} from "./catalogOpenrouter";
import { getCustomVisionCapabilityFields } from "./catalogVision";
import {
  buildAliasMaps,
  resolveCanonicalProviderId as resolveCanonicalProviderIdFromMaps,
} from "./catalogProviderMaps";
import {
  getModelCatalogAuthRejection,
  isCcDiscoveryModelCatalogClient,
} from "./catalogRequest";
import { incrementCcDiscoveryHitCount } from "@/lib/db/ccDiscoveryMetrics";
import { decideHidePaid } from "./catalogPaidFilter";
import { isModelExposureAllowed } from "@/shared/utils/modelExposureList";
import { buildSyncedModelIdsByCanonicalProvider } from "./catalogSyncedCoverage";
import {
  buildComboCatalogMetadata,
  type ComboMetadataPick,
} from "./catalogComboMetadata";
import { synthesizeAutoCombos } from "./catalogAutoCombos";
import { addStaticProviderModels } from "./catalogStaticModels";
import { addSyncedModels } from "./catalogSyncedModels";
import { addSpecialtyModels } from "./catalogSpecialtyModels";
import { addCustomModels } from "./catalogCustomModels";
import { resolveNestedComboTargets } from "@omniroute/open-sse/services/combo";
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry";


// Public API of this module is preserved after the catalog helper extraction:
// `isVisionModelId` (vision-detection-consistency.test.ts) and
// `getCustomVisionCapabilityFields` (llm-selector-custom-vision-models.test.ts)
// are still importable from here.
export { isVisionModelId } from "@/shared/constants/visionModels";
export { getCustomVisionCapabilityFields };

// The response cache (coalescing, short-TTL memoization and stale-while-revalidate)
// lives in ./catalogCache. Re-exported here because the existing tests import the
// hooks from this module, and CATALOG_STALE_WHILE_REVALIDATE_MS is part of the
// documented behavior of this endpoint.
import {
  CATALOG_CACHE_TTL_MS_DEFAULT,
  resolveCachedCatalogResponse,
  type BackgroundRefreshScheduler,
} from "./catalogCache";

export {
  CATALOG_STALE_WHILE_REVALIDATE_MS,
  __resetCatalogBuilderRunsForTest,
  __getCatalogBuilderRunsForTest,
  __expireCatalogCacheForTest,
  __setCatalogCacheEntryForTest,
  __flushCatalogBackgroundRefreshForTest,
  __forceCatalogInFlightRejectionForTest,
} from "./catalogCache";
export type { CachedCatalog, BackgroundRefreshScheduler } from "./catalogCache";

/**
 * Per-call options for {@link getUnifiedModelsResponse}.
 *
 * Restored in #11551: `/v1/models` passes Next's `after()` so the stale-while-
 * revalidate rebuild is deferred until after the response flush. #9199 had removed
 * the injection point while the route kept passing it, so the argument was silently
 * dropped and the refresh ran on a plain `setTimeout`.
 */
export type CatalogResponseOptions = {
  scheduleBackgroundRefresh?: BackgroundRefreshScheduler;
};

function yieldCatalogBuildTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Build unified OpenAI-compatible model catalog response.
 * Reused by `/api/v1/models` and `/api/v1` to avoid semantic drift (T09).
 *
 * `options.scheduleBackgroundRefresh` is the App Router's injection point for the
 * stale-while-revalidate rebuild (#8728): the route passes Next's `after()` so the
 * rebuild starts only once the stale body has been flushed. Omitted by non-route
 * callers, which fall back to the cache module's own default.
 */
export async function getUnifiedModelsResponse(
  request: Request,
  corsHeaders: Record<string, string> = {},
  options: { scheduleBackgroundRefresh?: BackgroundRefreshScheduler } = {}
) {
  const diagnosticHeaders = getCatalogDiagnosticsHeaders({ request });

  // #6408 fast path: reject unauthorized callers first (auth state is per-request
  // and MUST NOT be cached), then coalesce identical concurrent requests + short-
  // TTL memoize the serialized JSON body.
  let settingsForAuth: Record<string, any> = {};
  try {
    try {
      settingsForAuth = await getSettings();
    } catch {}
    // #9147: yield before auth check to allow event loop tick
    await yieldCatalogBuildTurn();
    const authRejection = await getModelCatalogAuthRejection(request, settingsForAuth, {
      ...corsHeaders,
      ...diagnosticHeaders,
    });
    if (authRejection) return authRejection;
  } catch {
    // Fall through to full builder on auth-check failure; core handles errors.
  }

  // Best-effort cc-discovery usage metric — count every authorized GET /v1/models
  // hit from a Claude Code client, cache hit or not. Never blocks/slows the
  // request (incrementCcDiscoveryHitCount already swallows its own errors).
  if (isCcDiscoveryModelCatalogClient(request)) {
    incrementCcDiscoveryHitCount();
  }

  try {
    return await resolveCachedCatalogResponse(
      request,
      { corsHeaders, diagnosticHeaders },
      buildCatalogPayload,
      {
        // #10831: a disabled router hides auto/* just as hideAutoCombos does, so
        // the two collapse into one cache dimension — the resulting catalogs are
        // identical and do not need separate entries.
        hideAutoCombos:
          settingsForAuth?.hideAutoCombos === true || settingsForAuth?.autoRoutingEnabled === false,
        hideNoThinkVariants: settingsForAuth?.hideNoThinkVariants === true,
        scheduleBackgroundRefresh: options.scheduleBackgroundRefresh,
      }
    );
  } catch (err) {
    // Hard rule #12: never put a raw err.message/err.stack in a response body.
    // Route it through the shared sanitizer instead — same status/type/code as
    // before, minus the stack-trace/path leak.
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      buildErrorBody(500, message, undefined, {
        type: "server_error",
        code: INTERNAL_PROXY_ERROR,
      }),
      { status: 500, headers: { ...corsHeaders, ...diagnosticHeaders } }
    );
  }
}

async function buildCatalogPayload(
  request: Request
): Promise<{ body: string; headers: Record<string, string>; status: number; cacheTTL: number }> {
  const built = await buildUnifiedModelsResponseCore(request);
  const body = await built.text();
  const headers: Record<string, string> = {};
  built.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // Read the configurable cache TTL from database settings.
  // Falls back to the hardcoded default if not set or on error.
  let cacheTTL = CATALOG_CACHE_TTL_MS_DEFAULT;
  try {
    // Only the persisted cache section is needed here. The full database-settings
    // view also calculates dbstat, WAL, schema and integrity diagnostics, which are
    // synchronous and can pin the event loop after an otherwise cooperative build.
    const dbSettings = getUserDatabaseSettings();
    cacheTTL = dbSettings.cache?.modelCatalogCacheTtlMs ?? CATALOG_CACHE_TTL_MS_DEFAULT;
  } catch {
    // Swallow — use default TTL on DB error
  }
  return { body, headers, status: built.status, cacheTTL };
}

/**
 * Original catalog builder. Runs once per unique cache key per TTL window.
 */
async function buildUnifiedModelsResponseCore(
  request: Request,
  corsHeaders: Record<string, string> = {}
) {
  const diagnosticHeaders = getCatalogDiagnosticsHeaders({ request });
  // #9147: this builder walks connections + model registries at catalog scale with no
  // event-loop yield, so a large deployment pins the single Node.js thread for the
  // whole build (reporter: 183 connections / 2000+ models → 10.1s stall that blocks the
  // dashboard WS heartbeat). Yield every `catYIELD_EVERY` items across the hot loops.
  const catYIELD_EVERY = 5;
  let catYieldCount = 0;
  const maybeYieldCatalogBuild = async (): Promise<void> => {
    catYieldCount++;
    if (catYieldCount % catYIELD_EVERY === 0) {
      await yieldCatalogBuildTurn();
    }
  };
  try {
    // #9147/#12172: bulk-load the hidden-model map once PER MODALITY (memoized below,
    // one SQLite query per modality actually used) instead of `getModelIsHidden()`'s
    // per-call read — per-modality because chat/images/etc. registries can share a
    // literal model id and must be hideable independently (#12172). Deliberately kept
    // INSIDE this try block: the builder's catch below sanitizes a build-time failure
    // into a 500 instead of a rejected promise.
    const hiddenModelsByModality = new Map<string, Map<string, Set<string>>>();
    const getHiddenModelsForModality = (modality: string): Map<string, Set<string>> => {
      let m = hiddenModelsByModality.get(modality);
      if (!m) {
        m = getHiddenModelsByProvider(modality);
        hiddenModelsByModality.set(modality, m);
      }
      return m;
    };
    let settings: Record<string, any> = {};
    try {
      settings = await getSettings();
    } catch {}

    const authRejection = await getModelCatalogAuthRejection(request, settings, {
      ...corsHeaders,
      ...diagnosticHeaders,
    });
    if (authRejection) return authRejection;

    // #9147: yield after auth check before DB initialization prologue
    await yieldCatalogBuildTurn();

    const capabilityResolutionSnapshot = createModelCapabilityResolutionSnapshot();
    const { aliasToProviderId, providerIdToAlias } = buildAliasMaps();
    const _qp = new URL(request.url).searchParams.get("prefix");
    const prefixMode =
      _qp === "alias" || _qp === "canonical" || _qp === "dual" ? _qp : getModelsCatalogPrefixMode();
    const includeAlias = prefixMode !== "canonical";
    const includeCanonical = prefixMode !== "alias";
    const resolveCanonicalProviderId = (aliasOrProviderId: string, fallbackProviderId?: string) =>
      resolveCanonicalProviderIdFromMaps(aliasToProviderId, aliasOrProviderId, fallbackProviderId);
    const aliasMaps = { aliasToProviderId, providerIdToAlias };
    // Issue #96: Allow blocking specific providers from the models list
    const blockedProviders = normalizeBlockedProviderSet(settings.blockedProviders);
    // #6316: Opt-in filter — hide paid-only models via `isFreeModel()`. Only applied to
    // PROVIDER_MODELS + OpenRouter loops (where pricing metadata / :free suffix / catalog
    // membership is available). Modality registries (embedding/image/rerank/audio/
    // moderation/video/music) represent local capabilities without pricing, so they are
    // exempt. Combos + auto/* + synced/custom/alias-backed rows also stay unfiltered —
    // extending v1 scope to those requires per-entry pricing lookup not available today.
    const hidePaid = settings.hidePaidModels === true;
    // #9418: Opt-in filter — skip the entire auto/* synthesis loop when the operator
    // does not want built-in virtual combos advertised in the catalog. User-defined
    // combos are unaffected; routing still works for ids sent explicitly.
    // #10831: also drop them when auto routing is switched off. Unlike
    // hideAutoCombos — which only unadvertises ids that still route when sent
    // explicitly — a disabled router rejects every auto/* id with a 400, so
    // listing them offers the client a choice that cannot succeed.
    const hideAuto = settings.hideAutoCombos === true || settings.autoRoutingEnabled === false;
    const shouldHidePaid = (
      providerKey: string,
      modelId: string,
      pricing?: unknown,
      isFree?: boolean
    ): boolean =>
      decideHidePaid(hidePaid, providerKey, modelId, pricing, isFree, aliasToProviderId);
    // #11481: opt-in explicit model exposure allow/deny list — same call sites
    // as shouldHidePaid above (mirrored into the auto/* combo candidate pool
    // via open-sse/services/autoCombo/modelExposureFilter.ts, per #6512's
    // catalog-only-filter-leaks-into-combo-routing lesson). Independent of
    // hidePaidModels — operator curation, not a cost signal.
    const shouldHideByExposure = (providerKey: string, modelId: string): boolean =>
      !isModelExposureAllowed(aliasToProviderId[providerKey] || providerKey, modelId, settings);

    // Get active provider connections
    let connections = [];
    let _totalConnectionCount = 0; // Track if DB has ANY connections (even disabled)
    try {
      connections = (await getCachedRawProviderConnections()).map(createLazyConnectionView);
      _totalConnectionCount = connections.length;
      // Filter to only active connections
      connections = connections.filter((c) => c.isActive !== false);
    } catch (e) {
      // If database not available, show no provider models (safe default)
      console.log("[catalog] Could not fetch providers:", e);
    }

    // Get provider nodes (for compatible providers with custom prefixes)
    let providerNodes = [];
    try {
      providerNodes = await getCachedProviderNodes();
    } catch (_e) {
      console.log("Could not fetch provider nodes");
    }

    // Build map of provider node ID to prefix and type for compatible providers
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
      if (resolvedPrefix) {
        providerIdToPrefix[node.id] = resolvedPrefix;
      }
      if (node.type) {
        nodeIdToProviderType[node.id] = node.type;
      }
    }
    for (const prefix of new Set(Object.values(providerIdToPrefix))) {
      if (isProviderNodePrefixReserved(prefix)) continue;
      const winner = selectCompatibleNodeForPrefix(providerNodes, prefix);
      if (winner?.id) providerNodeIdByPrefix[prefix] = winner.id;
    }

    // #8327: `resolveCanonicalProviderId`/`canonicalProviderId` only know the static
    // AI_PROVIDERS/PROVIDER_MODELS alias maps, so a compatible-provider node (whose raw
    // `id` is an internal UUID, never present in those static maps) falls through every
    // lookup and returns the raw UUID verbatim. That UUID is still required for the
    // internal registry/connection/hidden-model lookups that key off `canonicalProviderId`
    // (getConnectionsForProvider, getModelIsHidden, etc. are keyed by the raw node id, not
    // the prefix) — so `canonicalProviderId` itself must stay untouched. What must NOT leak
    // is the raw UUID in the *public* `owned_by` field: resolve it to the operator's
    // configured prefix there, and only there.
    const resolvePublicOwnerId = (providerId: string, canonicalProviderId: string): string =>
      providerIdToPrefix[providerId] || canonicalProviderId;

    // #11300: the visibility toggle on a provider's dashboard page persists the
    // hidden-model row under whatever key the route's `[id]` param happened to be
    // (a node UUID, an alias like `cc`/`gh`/`cx`, or a canonical provider id) —
    // see `PATCH /api/provider-models`. The catalog loops below each key their own
    // lookup differently (raw connection provider, canonical id, or alias), so a
    // single-key lookup missed the override whenever the write key and the read key
    // diverged. Check every key a model could plausibly have been hidden under:
    // the raw key passed in, its resolved canonical provider id, that canonical id's
    // alias, and the compatible-provider-node prefix for either.
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
        const hiddenSet = hiddenModelsForModality.get(key);
        if (hiddenSet?.has(modelId)) return true;
      }
      return false;
    };

    // Get combos
    let combos = [];
    await yieldCatalogBuildTurn();
    try {
      combos = await getCombos();
    } catch (_e) {
      console.log("Could not fetch combos");
    }

    // Build set of active provider aliases
    const activeAliases = new Set();
    const connectionsByProvider = new Map<string, typeof connections>();
    const registerConnectionKey = (
      key: string | null | undefined,
      connection: (typeof connections)[number]
    ) => {
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

    // noAuth providers have no DB rows; settings.blockedProviders disables them.
    for (const p of Object.values(NOAUTH_PROVIDERS)) {
      if (isNoAuthProviderBlocked(blockedProviders, p.id, "alias" in p ? p.alias : null)) continue;
      activeAliases.add(p.id);
      if ("alias" in p && typeof p.alias === "string") activeAliases.add(p.alias);
    }

    // #9147 follow-up: this is called ~1-3x per model at catalog scale (providerSupportsModel,
    // isExcludedByProviderConnections). Connections do not change mid-build, so memoize per
    // unique (unordered) key-set instead of rescanning connectionsByProvider on every call —
    // otherwise the O(models) hot loop regains an O(connections) cost per model and blows the
    // single-stretch event-loop budget this file's own yield mechanism is meant to protect.
    const connectionsForProviderCache = new Map<string, typeof connections>();
    const getConnectionsForProvider = (...keys: Array<string | null | undefined>) => {
      const cacheKey = keys
        .filter((k): k is string => Boolean(k))
        .sort()
        .join("\u0000");
      const cached = connectionsForProviderCache.get(cacheKey);
      if (cached) return cached;
      const seen = new Set<string>();
      const collected: typeof connections = [];
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

    // Health-check exclusions (provider_specific_data.excludedModels) are enforced
    // at request time in getProviderCredentials(); mirror the same rule in the
    // catalog so ghost models do not appear as available. A model is hidden when
    // the provider HAS connections but NONE of them is eligible for it.
    const isExcludedByProviderConnections = (providerKey: string, modelId: string) => {
      const providerId = aliasToProviderId[providerKey] || providerKey;
      const alias = providerIdToAlias[providerId] || providerKey;
      const providerConnections = getConnectionsForProvider(providerId, alias, providerKey);
      if (providerConnections.length === 0) return false; // noAuth / no DB row: keep
      return !hasEligibleConnectionForModel(providerConnections, modelId);
    };

    const providerSupportsModel = (providerKey: string, modelId: string) => {
      const providerId = aliasToProviderId[providerKey] || providerKey;
      const alias = providerIdToAlias[providerId] || providerKey;
      // noAuth providers have no connection rows — treat every model as eligible. (#2798)
      const isNoAuth = isNoAuthProviderKey(providerId, providerKey, alias);
      if (isNoAuth && !isNoAuthProviderBlocked(blockedProviders, providerId, providerKey, alias))
        return true;
      return hasEligibleConnectionForModel(
        getConnectionsForProvider(providerKey, providerId, alias),
        modelId
      );
    };

    const getRegistryModel = (providerId: string, modelId: string) => {
      const alias = providerIdToAlias[providerId] || PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const providerModels = PROVIDER_MODELS[alias] || PROVIDER_MODELS[providerId] || [];
      return providerModels.find((model) => model?.id === modelId) || null;
    };

    // prefixRoutesToProvider is imported directly from catalogProviderMaps.ts (no
    // map dependency — pure parseModel() probe), used both here and at the two
    // includeCanonical prefix-collision checks below.
    const _getProviderPrefixes = (providerId: string, rawProvider: string) =>
      getProviderPrefixesFromMaps(aliasMaps, providerId, rawProvider);

    const getComboTargetModelId = (target: ComboCatalogTarget) => {
      const resolved = getComboTargetModelIdFromMaps(aliasMaps, target);
      if (!resolved) return null;
      const nodeId = providerNodeIdByPrefix[resolved.providerId];
      return nodeId ? { ...resolved, providerId: nodeId } : resolved;
    };

    const resolvedComboTargets = combos.flatMap(
      (combo) =>
        resolveNestedComboTargets(
          combo as Parameters<typeof resolveNestedComboTargets>[0],
          combos as Parameters<typeof resolveNestedComboTargets>[1]
        ) as ComboCatalogTarget[]
    );
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
          // Unknown connection-scoped capability evidence must never broaden a combo.
          comboSyncedModelsByProvider.set(providerId, null);
        }
      })
    );

    // Context for the extracted combo-metadata module.
    const comboMetadataCtx: ComboMetadataPick = {
      capabilityResolutionSnapshot,
      providerIdToAlias,
      aliasToProviderId,
      getComboTargetModelId,
      getConnectionsForProvider,
      getRegistryModel,
      comboSyncedModelsByProvider,
    };

    // Collect models from active providers (or all if none active)
    const models = [];
    const timestamp = Math.floor(Date.now() / 1000);
    const listedIds = new Set<string>();

    // #8770 follow-up: a quota-exclusive key (allowedQuotas non-empty) only ever
    // receives the pool's `qtSd/*` combos — the key-permission step further down
    // discards the entire catalog for it. Building that catalog first costs ~1.2s
    // of CPU on a 1 vCPU host (measured), enough for Claude Code's 3s gateway model
    // discovery to time out under contention, and every byte of it is thrown away.
    // Everything the quota path needs (`combos`, `timestamp`,
    // `buildComboCatalogMetadata`) already exists here, so return before the
    // provider/auto-combo/registry loops start.
    const earlyApiKey = extractApiKey(request);
    if (earlyApiKey) {
      const { getApiKeyMetadata } = await import("@/lib/db/apiKeys");
      const earlyKeyMeta = await getApiKeyMetadata(earlyApiKey);
      if (earlyKeyMeta?.allowedQuotas && earlyKeyMeta.allowedQuotas.length > 0) {
        const { buildQuotaExclusiveModels } = await import("@/lib/quota/quotaCombos");
        const quotaModels = await buildQuotaExclusiveModels(
          earlyKeyMeta.allowedQuotas,
          combos,
          timestamp,
          (c) => buildComboCatalogMetadata(c, combos, comboMetadataCtx)
        );
        const quotaFinal = await applyCatalogPostFilters(request, quotaModels, {
          connections,
          prefixMode,
          aliasToProviderId,
          hideNoThinkVariants: settings.hideNoThinkVariants === true,
        });
        return finalizeCatalogResponse(request, quotaFinal, () => undefined, {
          ...corsHeaders,
          ...diagnosticHeaders,
        });
      }
    }

    // #4164: advertise the built-in zero-setup `auto/*` combos at the very top.
    // Extracted to catalogAutoCombos.ts to reduce file size.
    await synthesizeAutoCombos(
      {
        models,
        hideAuto,
        hidePaid,
        blockedProviders,
        listedIds,
        capabilityResolutionSnapshot,
        providerIdToAlias,
        aliasToProviderId,
        getComboTargetModelId,
        getConnectionsForProvider,
        getRegistryModel,
        comboSyncedModelsByProvider,
      },
      yieldCatalogBuildTurn
    );

    // Add combos first (they appear at the top) — only active ones
    for (const combo of combos) {
      if (combo.isActive === false || combo.isHidden === true) continue;
      if (typeof combo.name !== "string" || combo.name.length === 0) continue;
      if (listedIds.has(combo.name)) continue; // #4164: don't shadow a built-in auto/* id

      // Skip combos whose any underlying target model is hidden
      const comboTargets = resolveNestedComboTargets(
        combo as Parameters<typeof resolveNestedComboTargets>[0],
        combos as Parameters<typeof resolveNestedComboTargets>[1]
      ) as ComboCatalogTarget[];
      const visibleTargets = comboTargets.filter((target) => {
        const resolved = getComboTargetModelId(target);
        return resolved ? !isModelHiddenBulk(resolved.providerId, resolved.modelId) : true;
      });
      if (visibleTargets.length === 0) continue;

      const comboMetadata = buildComboCatalogMetadata(combo, visibleTargets, comboMetadataCtx);

      listedIds.add(combo.name);
      models.push({
        id: combo.name,
        object: "model",
        created: timestamp,
        owned_by: "combo",
        permission: [],
        root: combo.name,
        parent: null,
        ...comboMetadata,
      });

      // #9147: combos can number hundreds at catalog scale — yield periodically.
      await maybeYieldCatalogBuild();
    }

    let syncedModelsByProvider: Record<string, SyncedAvailableModel[]> = {};
    try {
      await yieldCatalogBuildTurn();
      syncedModelsByProvider = await getAllActiveSyncedModels();
      await yieldCatalogBuildTurn();
    } catch (e) {
      // DB unavailable — log and fall through; static models remain as defaults.
      console.log("[catalog] Could not fetch synced available models:", e);
    }
    const providersWithSyncedModels = new Set(
      Object.keys(syncedModelsByProvider).filter((pid) => {
        if (providerUsesCuratedModelsOnly(pid)) return false;
        const models = syncedModelsByProvider[pid];
        return (
          Array.isArray(models) &&
          models.some((model) => isUnifiedChatSourceModelSelectable(pid, model))
        );
      })
    );
    const _isRegisteredEffortVariant = (
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

    // Map canonical provider id -> set of synced display-model ids, so the static
    // loop below can decide which static models a provider's synced discovery list
    // actually covers (and which static models it must preserve).
    const syncedModelIdsByCanonicalProvider = buildSyncedModelIdsByCanonicalProvider(
      syncedModelsByProvider,
      resolveCanonicalProviderId,
      providerIdToPrefix,
      providerIdToAlias
    );

    // Add provider models (chat) + codex-native unprefixed models
    // Extracted to catalogStaticModels.ts to reduce file size.
    await addStaticProviderModels({
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
    });

    // Add synced (live-discovered) models
    // Extracted to catalogSyncedModels.ts to reduce file size.
    await addSyncedModels({
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
    });

    if (
      activeAliases.has("openrouter") &&
      !blockedProviders.has("openrouter") &&
      !providersWithSyncedModels.has("openrouter")
    ) {
      try {
        const openRouterCatalog = await getOpenRouterCatalog();
        const openRouterCaps: Record<string, ModelCapabilityEntry> = {};
        for (const openRouterModel of openRouterCatalog.data || []) {
          if (!openRouterModel?.id || typeof openRouterModel.id !== "string") continue;
          const qualifiedId = qualifyOpenRouterModelId(openRouterModel.id);
          if (models.some((existingModel: any) => existingModel?.id === qualifiedId)) continue;

          const inputModalities = normalizeOpenRouterModalities(
            openRouterModel.architecture?.input_modalities
          );
          const outputModalities = normalizeOpenRouterModalities(
            openRouterModel.architecture?.output_modalities
          );
          const modelType = getOpenRouterModelType(inputModalities, outputModalities);
          const isFree = isOpenRouterFreeModel(openRouterModel);
          if (hidePaid && !isFree) continue;
          // #9293: respect per-model hidden flags (e.g. operator hid google/chirp-3
          // from the OpenRouter provider, so it should not appear in the live catalog).
          if (isModelHiddenBulk("openrouter", openRouterModel.id)) continue;
          const supportedParameters = Array.isArray(openRouterModel.supported_parameters)
            ? openRouterModel.supported_parameters
            : [];
          const capabilities: Record<string, boolean> = {};
          if (inputModalities.includes("image")) capabilities.vision = true;
          if (
            supportedParameters.includes("reasoning") ||
            supportedParameters.includes("include_reasoning")
          ) {
            capabilities.reasoning = true;
          }
          if (supportedParameters.includes("tools")) capabilities.tool_calling = true;
          if (
            supportedParameters.includes("structured_outputs") ||
            supportedParameters.includes("response_format")
          ) {
            capabilities.structured_output = true;
          }

          models.push({
            id: qualifiedId,
            object: "model",
            created: openRouterModel.created || timestamp,
            owned_by: "openrouter",
            permission: [],
            root: openRouterModel.id,
            parent: null,
            name: getOpenRouterDisplayName(openRouterModel),
            type: modelType,
            ...(isFree ? { free: true } : {}),
            ...(typeof openRouterModel.context_length === "number"
              ? { context_length: openRouterModel.context_length }
              : {}),
            ...(typeof openRouterModel.top_provider?.max_completion_tokens === "number"
              ? { max_output_tokens: openRouterModel.top_provider.max_completion_tokens }
              : {}),
            ...(inputModalities.length > 0 ? { input_modalities: inputModalities } : {}),
            ...(outputModalities.length > 0 ? { output_modalities: outputModalities } : {}),
            ...(Object.keys(capabilities).length > 0 ? { capabilities } : {}),
          });
          const capEntry = openRouterCapabilityEntry(
            openRouterModel,
            inputModalities,
            outputModalities,
            capabilities
          );
          if (capEntry) openRouterCaps[openRouterModel.id] = capEntry;
          await maybeYieldCatalogBuild();
        }
        upsertSyncedCapabilities("openrouter", openRouterCaps);
      } catch (err) {
        console.error("[catalog] Error loading OpenRouter catalog:", err);
      }
    }

    // Add specialty models (embedding, image, rerank, audio, moderation, video, music)
    // Extracted to catalogSpecialtyModels.ts to reduce file size.
    await addSpecialtyModels({
      models,
      timestamp,
      providerIdToAlias,
      blockedProviders,
      activeAliases,
      providerIdToPrefix,
      resolveCanonicalProviderId,
      providerSupportsModel,
      isModelHiddenBulk,
      maybeYieldCatalogBuild,
    });

    // Add custom models (user-defined), alias-backed models, and managed fallback models
    // Extracted to catalogCustomModels.ts to reduce file size.
    await addCustomModels({
      models,
      timestamp,
      connections,
      providerIdToPrefix,
      providerIdToAlias,
      nodeIdToProviderType,
      aliasToProviderId,
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
      getConnectionsForProvider,
      maybeYieldCatalogBuild,
    });

    const apiKey = extractApiKey(request);
    let finalModels = models;
    if (apiKey) {
      const { isModelAllowedForKey, getApiKeyMetadata } = await import("@/lib/db/apiKeys");

      // Quota-exclusive keys (allowedQuotas non-empty): list ONLY the pool's qtSd/*
      // virtual models. #4806: build from the hidden qtSd/* combos directly — the base
      // `models` list drops hidden combos, so filtering it returned nothing (0 models).
      const keyMeta = await getApiKeyMetadata(apiKey);
      if (keyMeta && keyMeta.allowedQuotas && keyMeta.allowedQuotas.length > 0) {
        const { buildQuotaExclusiveModels } = await import("@/lib/quota/quotaCombos");
        finalModels = await buildQuotaExclusiveModels(
          keyMeta.allowedQuotas,
          combos,
          timestamp,
          (c) => buildComboCatalogMetadata(c, combos, comboMetadataCtx)
        );
      } else if (!keyMeta) {
        // #6406: A valid apiKey without a DB metadata row is an env-var master key
        // (OMNIROUTE_API_KEY / ROUTER_API_KEY per isValidApiKey). Those keys have no
        // per-key allow/deny/quota restrictions — they authenticate the request but
        // do NOT scope the catalog. Skipping the per-model filter matches the intent:
        // auth GATES access; env-var master keys see everything the unauth path sees.
        // Without this branch, isModelAllowedForKey returns false for every model
        // (metadata missing → deny), collapsing /v1/models to 0 entries.
      } else {
        const filtered = [];
        for (const m of models) {
          // m.id is the full identifier (e.g. openai/gpt-4o), m.root is the raw model string
          // check either one as the config could use either patterns
          if (
            (await isModelAllowedForKey(apiKey, m.id)) ||
            (await isModelAllowedForKey(apiKey, m.root))
          ) {
            filtered.push(m);
          }
        }
        finalModels = filtered;
      }
    }
    // ?configuredOnly — hide models that have no eligible DB connection.
    finalModels = await applyCatalogPostFilters(request, finalModels, {
      connections,
      prefixMode,
      aliasToProviderId,
      hideNoThinkVariants: settings.hideNoThinkVariants === true,
    });

    const getDefaultContextFallback = (model: any): number | undefined => {
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
        ? getTokenLimit(canonicalId, modelId, capabilityResolutionSnapshot)
        : getTokenLimit(canonicalId, null, capabilityResolutionSnapshot);
    };

    let enrichmentSnapshot: CatalogEnrichmentSnapshot | undefined;
    if (finalModels.some((model) => model.owned_by !== "combo")) {
      let modelsDevPricing: ReturnType<typeof getModelsDevPricing> | null = null;
      try {
        modelsDevPricing = getModelsDevPricing();
      } catch {
        // Pricing lookup is optional; hardcoded defaults still enrich the response.
      }
      enrichmentSnapshot = {
        modelsDevPricing,
        capabilityResolutionSnapshot,
        providerNodeIdsByPrefix: providerNodeIdByPrefix,
      };
      // The production profile identified pricing snapshot construction as the last
      // dominant synchronous stage. Let already-queued health checks run before the
      // remaining in-memory enrichment and JSON serialization.
      await yieldCatalogBuildTurn();
    }

    return finalizeCatalogResponse(
      request,
      finalModels,
      getDefaultContextFallback,
      {
        ...corsHeaders,
        ...diagnosticHeaders,
      },
      enrichmentSnapshot
    );
  } catch (error) {
    console.log("Error fetching models:", error);
    // Hard rule #12 — this is the realistically reachable 500 for the endpoint
    // (the wrapper's catch only fires on an in-flight rejection), so it must go
    // through the shared sanitizer too. Same status/type/code as before.
    return Response.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error), undefined, {
        type: "server_error",
        code: INTERNAL_PROXY_ERROR,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          ...diagnosticHeaders,
        },
      }
    );
  }
}
