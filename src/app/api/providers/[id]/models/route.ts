// oxlint-disable no-unused-vars
import { NextResponse } from "next/server";
import {
  getProviderConnectionFamilyIds,
  isOpenAICompatibleProvider,
  NOAUTH_PROVIDERS,
} from "@/shared/constants/providers";
import { getRegistryEntry } from "@omniroute/open-sse/config/providerRegistry.ts";
import { getModelsByProviderId } from "@/shared/constants/models";
import { resolveAlibabaProviderModelsUrl } from "@/shared/constants/alibabaProviderRegions";
import { getStaticModelsForProvider } from "@/lib/providers/staticModels";
import { providerUsesCuratedModelsOnly } from "@/lib/providers/modelListingCapability";
import { mergeModelsWithCustomPrecedence } from "@/lib/providers/modelMetadataPrecedence";
import { getCachedProviderConnectionById } from "@/lib/db/readCache";
import { resolveProxyForProvider } from "@/lib/db/proxies";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import {
  getProviderOutboundGuard,
  getProviderValidationGuard,
} from "@/shared/network/outboundUrlGuardPolicy";
import { errorResponse, sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

import { deriveConfigFromRegistryModelsUrl } from "./discoveryConfig";
import { resolveZedModels } from "@omniroute/open-sse/shared/zedAuth.ts";

import {
  discoverPromptQlModels,
  PROMPTQL_FALLBACK_MODELS,
} from "@omniroute/open-sse/services/promptqlModels.ts";
import {
  discoverNotionWebModels,
  NOTION_WEB_FALLBACK_MODELS,
} from "@omniroute/open-sse/services/notionWebModels.ts";
import {
  discoverMaxaiModels,
  MAXAI_REGISTRY_MODELS,
} from "@omniroute/open-sse/services/maxaiModels.ts";

import {
  getCachedDiscoveredModels,
  isAutoFetchModelsEnabled,
  persistDiscoveredModels,
} from "@/lib/providerModels/modelDiscovery";
import { buildProviderModelsUrl, getDiscoveryClientVersionOptions } from "./discoveryClientVersion";
import { getAdobeModels } from "./adobeFireflyDiscovery";

import { getSyncedAvailableModels, getCustomModels, getModelIsHidden } from "@/lib/db/models";
import { isConnectionUnavailableToAuxiliaryActivity } from "@/lib/exclusiveLeaseIsolation";
import { fetchCursorAgentModels } from "@/lib/providerModels/cursorAgent";
import { fetchCursorAvailableModels } from "@/lib/providerModels/cursorAvailableModels";
import { ensureCursorAutoCatalogEntry } from "@/lib/providerModels/cursorAutoCatalog";

import {
  asRecord,
  getProviderBaseUrl,
  isLocalOpenAIStyleProvider,
  mergeLocalCatalogModels,
  mergeSpecialtyCatalogIntoLiveModels,
  buildOptionalBearerHeaders,
  buildNamedOpenAiStyleHeaders,
  enrichOllamaLocalModels,
} from "./discovery/helpers";
import {
  fetchAntigravityDiscoveryModelsCached,
  normalizeOpenAiLikeModelsResponse,
} from "./discovery/normalizers";
import { isNamedOpenAIStyleProvider } from "./discovery/providerSets";
import { buildStaleEncryptionKeyResponse } from "./staleEncryptionGuard";
import {
  assembleProviderModelsHeaders,
  PROVIDER_MODELS_CONFIG,
} from "./discovery/providerModelsConfig";
import {
  buildCodexDiscoveryCatalog,
  enrichCodexModelsFromGithubCatalog,
  fetchCodexDiscoveryModels,
  fetchCodexGithubCatalogModels,
} from "./discovery/codex";
import { maybeHandleConolModelDiscovery } from "./conolDiscovery";
import { buildNoAuthModelsResponse, filterModelsForRoute } from "./modelRouteProjection";
import {
  handleBedrock,
  handleDataRobot,
  handleAzureAi,
  handleAzureOpenAI,
  handleGitHubCopilot,
  handleGheCopilot,
  handleGlm,
  handleWatsonx,
  handleOci,
  handleSap,
  handleKiro,
  handleVertex,
  handleOpenAICompatible,
  type HandlerContext,
  type HandlerHelpers,
} from "./handlers";

/**
 * GET /api/providers/[id]/models - Get models list from provider
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Check if we should exclude hidden models (used by MCP tools to prevent hidden model leaks)
    const { searchParams } = new URL(request.url);
    const excludeHidden = searchParams.get("excludeHidden") === "true";
    const excludeCustom = searchParams.get("excludeCustom") === "true";
    const refresh = searchParams.get("refresh") === "true";
    const chatOnly =
      searchParams.get("chatOnly") === "true" ||
      request.headers.get("x-omniroute-model-surface")?.toLowerCase() === "chat";

    const connection = await getCachedProviderConnectionById(id);
    const connectionProvider =
      typeof connection?.provider === "string" && connection.provider.trim().length > 0
        ? connection.provider
        : null;
    const noAuthProviderId =
      (NOAUTH_PROVIDERS as Record<string, { noAuth?: boolean }>)[id]?.noAuth === true
        ? id
        : connectionProvider &&
            (NOAUTH_PROVIDERS as Record<string, { noAuth?: boolean }>)[connectionProvider]
              ?.noAuth === true
          ? connectionProvider
          : null;

    // No-auth providers may persist a connection row solely for fingerprints
    // and account-proxy metadata. That row must not turn public model discovery
    // into an API-key flow that expects a token.
    if (noAuthProviderId) {
      return buildNoAuthModelsResponse(
        noAuthProviderId,
        typeof connection?.id === "string" ? connection.id : id,
        excludeHidden,
        chatOnly
      );
    }

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (await isConnectionUnavailableToAuxiliaryActivity(id))
      return errorResponse(409, "Model discovery deferred for managed connection");

    // #6148 — short-circuit when a stored credential is encrypted but no longer
    // decrypts (STORAGE_ENCRYPTION_KEY changed/unset). Otherwise the null key is
    // coerced to "", an empty-Bearer probe is sent, and the operator sees a
    // misleading "Auth failed: 401" instead of the real cause.
    const staleEncryptionResponse = buildStaleEncryptionKeyResponse(connection);
    if (staleEncryptionResponse) return staleEncryptionResponse;

    const provider = connectionProvider;
    if (!provider) {
      return NextResponse.json({ error: "Invalid connection provider" }, { status: 400 });
    }
    const usesCuratedModelsOnly = providerUsesCuratedModelsOnly(provider);

    // Resolve proxy for this provider (provider-level → global → direct)
    const proxy = await resolveProxyForProvider(provider);

    // #6247 — user-added custom models live in key_value namespace
    // `customModels`. Merge them with explicit custom metadata taking precedence
    // over discovered metadata for the same id.
    let customModelsForProvider: Array<Record<string, unknown> & { id: string; name?: string }> =
      [];
    if (!excludeCustom && !usesCuratedModelsOnly) {
      try {
        const custom = await getCustomModels(provider);
        if (Array.isArray(custom)) {
          customModelsForProvider = custom.flatMap((model) =>
            model && typeof model === "object" && typeof model.id === "string" ? [model] : []
          );
        }
      } catch {
        // DB unavailable — proceed without custom models.
      }
    }

    const mergeCustomModels = (models: any[]) => {
      if (customModelsForProvider.length === 0) return models;
      const base = (Array.isArray(models) ? models : []).flatMap((model) => {
        if (!model || typeof model !== "object" || typeof model.id !== "string") return [];
        return [model as Record<string, unknown> & { id: string }];
      });
      const customRows = customModelsForProvider.map((model) => ({
        ...model,
        name: model.name || model.id,
        owned_by: provider,
      }));
      return mergeModelsWithCustomPrecedence(base, customRows);
    };

    const buildResponse = (payload: any, statusConfig?: ResponseInit) => {
      if (payload.models && Array.isArray(payload.models)) {
        payload.models = mergeCustomModels(payload.models);
        payload.models = filterModelsForRoute(provider, payload.models, chatOnly);
      }
      if (excludeHidden && payload.models && Array.isArray(payload.models)) {
        payload.models = payload.models.filter((m: any) => !getModelIsHidden(provider, m.id));
      }
      return NextResponse.json(payload, statusConfig);
    };

    const connectionId = typeof connection.id === "string" ? connection.id : id;
    const apiKey = typeof connection.apiKey === "string" ? connection.apiKey : "";
    const accessToken = typeof connection.accessToken === "string" ? connection.accessToken : "";
    const autoFetchModels = isAutoFetchModelsEnabled(connection.providerSpecificData);
    const cachedDiscoveryModels = usesCuratedModelsOnly
      ? []
      : filterModelsForRoute(
          provider,
          await getCachedDiscoveredModels(provider, connectionId),
          chatOnly
        );

    // Check for synced models from ANY connection of this provider.
    // When sync has been performed (even on a different connection),
    // use the synced list as the authoritative source instead of static models.
    let providerSyncedModels: Array<{
      id: string;
      name: string;
      apiFormat?: string;
      supportedEndpoints?: string[];
    }> | null = null;
    try {
      const allSynced = usesCuratedModelsOnly ? [] : await getSyncedAvailableModels(provider);
      const selectableSynced = filterModelsForRoute(provider, allSynced, chatOnly);
      if (selectableSynced.length > 0) {
        providerSyncedModels = selectableSynced.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          ...(m.apiFormat ? { apiFormat: m.apiFormat } : {}),
          ...(m.supportedEndpoints ? { supportedEndpoints: m.supportedEndpoints } : {}),
        }));
      }
    } catch {
      // DB unavailable — fall through to static catalog
    }

    const registryCatalogModels = providerSyncedModels ?? (getModelsByProviderId(provider) || []);
    const specialtyCatalogModels = providerSyncedModels
      ? []
      : getStaticModelsForProvider(provider) || [];

    const toLocalCatalogModels = () => {
      const localCatalog = mergeLocalCatalogModels(registryCatalogModels, specialtyCatalogModels);
      return localCatalog.map((model) => ({
        id: model.id,
        name: model.name || model.id,
        ...((model as Record<string, unknown>).apiFormat
          ? { apiFormat: (model as Record<string, unknown>).apiFormat as string | undefined }
          : {}),
        ...((model as Record<string, unknown>).supportedEndpoints
          ? {
              supportedEndpoints: (model as Record<string, unknown>).supportedEndpoints as
                string[] | undefined,
            }
          : {}),
        ...(registryCatalogModels.length > 0 ? { owned_by: provider } : {}),
      }));
    };

    const buildCachedDiscoveryResponse = (warning?: string) =>
      buildResponse({
        provider,
        connectionId,
        models: cachedDiscoveryModels,
        source: "cache",
        ...(warning ? { warning } : {}),
      });

    const buildLocalCatalogResponse = (warning?: string, intentional = false) => {
      const localModels = toLocalCatalogModels();
      if (localModels.length === 0) return null;
      return buildResponse({
        provider,
        connectionId,
        models: localModels,
        source: "local_catalog",
        // #5460/#5465 — flag catalogs that are the provider's ONLY discovery
        // source (no remote /models endpoint). model-sync imports these instead
        // of treating them as a degraded remote-fetch failure (502).
        ...(intentional ? { intentional: true } : {}),
        ...(warning ? { warning } : {}),
      });
    };

    const buildDiscoveryFallbackResponse = ({
      cacheWarning = "API unavailable — using cached catalog",
      localWarning = "API unavailable — using local catalog",
      localIntentional = false,
    }: {
      cacheWarning?: string;
      localWarning?: string;
      localIntentional?: boolean;
    } = {}) => {
      if (cachedDiscoveryModels.length > 0) {
        return buildCachedDiscoveryResponse(cacheWarning);
      }
      return buildLocalCatalogResponse(localWarning, localIntentional);
    };

    const buildDiscoveryErrorFallbackResponse = (
      error: unknown,
      warnings?: {
        cacheWarning?: string;
        localWarning?: string;
      }
    ) => {
      // #6267 — a models-endpoint redirect (307/308) is not a fixable-config
      // error. safeOutboundFetch throws REDIRECT_BLOCKED which
      // getSafeOutboundFetchErrorStatus maps to 503, but unlike the other 503
      // Redirect blocks degrade to the local/cached catalog; invalid URLs remain hard errors.
      if (error instanceof SafeOutboundFetchError && error.code === "REDIRECT_BLOCKED") {
        return buildDiscoveryFallbackResponse(warnings);
      }
      const status = getSafeOutboundFetchErrorStatus(error);
      if (status === 400 || status === 503 || status === 504) return null;
      return buildDiscoveryFallbackResponse(warnings);
    };

    if (provider === "adobe-firefly") {
      const discovery = await getAdobeModels(apiKey, accessToken, connection.providerSpecificData);
      return buildResponse({ provider, connectionId, ...discovery });
    }

    const maybeReturnCachedDiscovery = () => {
      if (!refresh && cachedDiscoveryModels.length > 0) {
        return buildCachedDiscoveryResponse();
      }
      return null;
    };

    const maybeReturnAutoFetchDisabled = () => {
      if (refresh || autoFetchModels) return null;
      const fallback = buildDiscoveryFallbackResponse({
        cacheWarning: "Auto-fetch disabled — using cached catalog",
        localWarning: "Auto-fetch disabled — using local catalog",
      });
      if (fallback) return fallback;
      return buildResponse({
        provider,
        connectionId,
        models: [],
        source: "local_catalog",
        warning: "Auto-fetch disabled — no cached models available",
      });
    };

    const buildApiDiscoveryResponse = async (
      models: any[],
      warning?: string,
      extraPayload: Record<string, unknown> = {}
    ) => {
      const discoveredModels = await persistDiscoveredModels(provider, connectionId, models);
      if (discoveredModels.length > 0) {
        // #6976 — merge curated embedding/rerank specialty entries (e.g.
        // OpenRouter's embeddingRegistry catalog) into the live-discovery
        // response; the live /v1/models endpoint only lists chat models, and
        // the specialty catalog otherwise only reached local_catalog fallback.
        const mergedModels = mergeSpecialtyCatalogIntoLiveModels(models, provider);
        return buildResponse({
          provider,
          connectionId,
          models: mergedModels,
          source: "api",
          ...(warning ? { warning } : {}),
          ...extraPayload,
        });
      }

      // Empty discovery just cleared THIS connection's synced cache (via
      // persistDiscoveredModels([])). `providerSyncedModels` was read at the top
      // of the handler and is now stale, so it must not leak the just-cleared
      // models back into the response (#3148 made synced authoritative for the
      // normal path; here we re-read the current state instead). Re-derive the
      // local catalog from the provider's remaining synced models (union across
      // its other connections) or the static catalog when none remain.
      let freshSynced: Awaited<ReturnType<typeof getSyncedAvailableModels>> = [];
      try {
        freshSynced = filterModelsForRoute(
          provider,
          await getSyncedAvailableModels(provider),
          chatOnly
        );
      } catch {
        /* DB unavailable — fall through to static catalog */
      }
      const freshRegistry = freshSynced.length
        ? freshSynced.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            ...(m.apiFormat ? { apiFormat: m.apiFormat } : {}),
            ...(m.supportedEndpoints ? { supportedEndpoints: m.supportedEndpoints } : {}),
          }))
        : getModelsByProviderId(provider) || [];
      const freshSpecialty = freshSynced.length ? [] : getStaticModelsForProvider(provider) || [];
      const freshLocal = mergeLocalCatalogModels(freshRegistry, freshSpecialty).map((model) => ({
        id: model.id,
        name: model.name || model.id,
        ...((model as Record<string, unknown>).apiFormat
          ? { apiFormat: (model as Record<string, unknown>).apiFormat as string | undefined }
          : {}),
        ...((model as Record<string, unknown>).supportedEndpoints
          ? {
              supportedEndpoints: (model as Record<string, unknown>).supportedEndpoints as
                string[] | undefined,
            }
          : {}),
        ...(freshRegistry.length > 0 ? { owned_by: provider } : {}),
      }));
      if (freshLocal.length > 0) {
        return buildResponse({
          provider,
          connectionId,
          models: freshLocal,
          source: "local_catalog",
          warning: "No remote models discovered — using local catalog",
        });
      }

      return buildResponse({
        provider,
        connectionId,
        models: [],
        source: "api",
      });
    };

    // ── Handler dispatch ────────────────────────────────────────────────────
    // Build a HandlerContext + HandlerHelpers once, then delegate to extracted
    // handler modules. Each handler returns null when the provider doesn't match.
    const handlerCtx: HandlerContext = {
      provider,
      connectionId,
      apiKey,
      accessToken,
      autoFetchModels,
      refresh,
      excludeHidden,
      chatOnly,
      usesCuratedModelsOnly: usesCuratedModelsOnly,
      proxy,
      connection: {
        id: connectionId,
        provider,
        apiKey,
        accessToken,
        providerSpecificData: connection.providerSpecificData,
        projectId: connection.projectId,
      },
      customModelsForProvider,
      cachedDiscoveryModels,
      providerSyncedModels,
      registryCatalogModels,
      specialtyCatalogModels,
    };

    const handlerHelpers: HandlerHelpers = {
      buildResponse,
      buildApiDiscoveryResponse,
      buildCachedDiscoveryResponse,
      buildLocalCatalogResponse,
      buildDiscoveryFallbackResponse,
      buildDiscoveryErrorFallbackResponse,
      maybeReturnCachedDiscovery,
      maybeReturnAutoFetchDisabled,
      toLocalCatalogModels,
      mergeCustomModels,
    };

    const providerHandlers = [
      handleBedrock,
      handleDataRobot,
      handleAzureAi,
      handleAzureOpenAI,
      handleGitHubCopilot,
      handleGheCopilot,
      handleGlm,
      handleWatsonx,
      handleOci,
      handleSap,
      handleKiro,
      handleVertex,
      handleOpenAICompatible,
    ];

    for (const handler of providerHandlers) {
      const result = await handler(handlerCtx, handlerHelpers);
      if (result) return result;
    }
    // ── End handler dispatch ────────────────────────────────────────────────

    if (provider === "reka") {
      // reka has no remote model-discovery endpoint — the local catalog is the
      // intended source, not a degraded fallback (#5460).
      const localCatalog = buildLocalCatalogResponse(undefined, true);
      if (localCatalog) return localCatalog;
    }

    if (provider === "lmarena") {
      // Direct-chat allowlist is the intended source — no arena.ai HTML scrape
      // (avoids CF bot burn and thrashy initialModels rows).
      const localCatalog = buildLocalCatalogResponse(undefined, true);
      if (localCatalog) return localCatalog;
    }

    // PromptQL playground: live catalog via GraphQL FetchLlmConfigs (Bearer JWT).
    if (provider === "promptql" || provider === "pql") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      const token = (apiKey || accessToken || "").replace(/^Bearer\s+/i, "").trim();
      const seedModels = PROMPTQL_FALLBACK_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
      }));
      if (!token) {
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "No JWT configured — using cached catalog",
          localWarning: "No JWT configured — using local catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: seedModels,
          source: "local_catalog",
          intentional: true,
          warning: "No PromptQL Bearer JWT — using seed model list",
        });
      }

      try {
        const graphqlEndpoint =
          (typeof connection.providerSpecificData?.graphqlEndpoint === "string" &&
            connection.providerSpecificData.graphqlEndpoint) ||
          process.env.PROMPTQL_GRAPHQL_ENDPOINT ||
          "https://data.prompt.ql.app/promptql/playground-v2-hge/v1/graphql";
        const discovered = await discoverPromptQlModels({
          token,
          graphqlEndpoint,
        });
        const models = discovered.map((m) => ({ id: m.id, name: m.name }));
        return buildApiDiscoveryResponse(models);
      } catch (error) {
        console.log("Error fetching models from promptql", {
          error: error instanceof Error ? error.message : String(error),
        });
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "PromptQL FetchLlmConfigs failed — using cached catalog",
          localWarning: "PromptQL FetchLlmConfigs failed — using seed catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: seedModels,
          source: "local_catalog",
          intentional: true,
          warning: "API unavailable — using seed PromptQL model list",
        });
      }
    }

    // #7600 follow-up: notion-web live catalog via cookie-auth getAvailableModels.
    // Needs spaceId (from cookie or getSpaces); falls back to seeded local catalog.
    if (provider === "notion-web") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      const token = apiKey || accessToken;
      if (!token) {
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "No token configured — using cached catalog",
          localWarning: "No token configured — using local catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: NOTION_WEB_FALLBACK_MODELS,
          source: "local_catalog",
          intentional: true,
          warning: "No token_v2 cookie — using seed Notion AI model list",
        });
      }

      try {
        const discovery = await discoverNotionWebModels({
          token,
          fetchImpl: (url, init) =>
            safeOutboundFetch(url, {
              ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
              guard: getProviderOutboundGuard(),
              proxyConfig: proxy,
              ...init,
            }),
        });
        // Pass through plan-lock warnings (e.g. Fable 5 requires Business/Enterprise).
        return buildApiDiscoveryResponse(discovery.models, discovery.warning);
      } catch (error) {
        console.log("Error fetching models from notion-web", {
          error: error instanceof Error ? error.message : String(error),
        });
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "Notion getAvailableModels failed — using cached catalog",
          localWarning: "Notion getAvailableModels failed — using seed catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: NOTION_WEB_FALLBACK_MODELS,
          source: "local_catalog",
          intentional: true,
          warning: "API unavailable — using seed Notion AI model list",
        });
      }
    }

    // MaxAI: live catalog + per-model context windows from the signed
    // /models/get_config (the call the web app makes on load). Falls back to the
    // curated static registry catalog on any auth/transport/shape failure.
    if (provider === "maxai") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      try {
        const discovery = await discoverMaxaiModels({
          providerSpecificData: connection.providerSpecificData as
            Record<string, unknown> | null | undefined,
          accessToken: apiKey || accessToken,
          fetchImpl: (url, init) =>
            safeOutboundFetch(url, {
              ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
              guard: getProviderOutboundGuard(),
              proxyConfig: proxy,
              ...init,
            }),
        });
        return buildApiDiscoveryResponse(discovery.models, discovery.warning);
      } catch (error) {
        console.log("Error fetching models from maxai", {
          error: error instanceof Error ? error.message : String(error),
        });
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "MaxAI models/get_config failed — using cached catalog",
          localWarning: "MaxAI models/get_config failed — using curated catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: MAXAI_REGISTRY_MODELS,
          source: "local_catalog",
          intentional: true,
          warning: "MaxAI catalog unavailable — using curated model list",
        });
      }
    }

    const conolResponse = await maybeHandleConolModelDiscovery({
      provider,
      connectionId,
      apiKey,
      accessToken,
      providerSpecificData: connection.providerSpecificData,
      proxy,
      maybeReturnCachedDiscovery,
      maybeReturnAutoFetchDisabled,
      buildDiscoveryFallbackResponse,
      buildResponse,
      buildApiDiscoveryResponse,
    });
    if (conolResponse) return conolResponse;

    if (
      isOpenAICompatibleProvider(provider) ||
      isLocalOpenAIStyleProvider(provider) ||
      isNamedOpenAIStyleProvider(provider)
    ) {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      const registryEntry =
        isLocalOpenAIStyleProvider(provider) || isNamedOpenAIStyleProvider(provider)
          ? getRegistryEntry(provider)
          : null;
      const rawBaseUrl =
        getProviderBaseUrl(connection.providerSpecificData) ||
        (typeof registryEntry?.baseUrl === "string" ? registryEntry.baseUrl : null);
      const baseUrl = rawBaseUrl;
      if (!baseUrl) {
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "Base URL unavailable — using cached catalog",
          localWarning: "Base URL unavailable — using local catalog",
        });
        if (fallback) return fallback;
        return NextResponse.json(
          {
            error: isOpenAICompatibleProvider(provider)
              ? "No base URL configured for OpenAI compatible provider"
              : isLocalOpenAIStyleProvider(provider)
                ? "No base URL configured for local provider"
                : "No base URL configured for provider",
          },
          { status: 400 }
        );
      }

      let base = baseUrl.replace(/\/$/, "");
      if (base.endsWith("/chat/completions")) {
        base = base.slice(0, -17);
      } else if (base.endsWith("/completions")) {
        base = base.slice(0, -12);
      }

      // Strip trailing /v1 unconditionally so the next step re-adds it exactly once.
      // Without this, baseUrls that embed /v1 (e.g. "https://api.airforce/v1/chat/completions")
      // become "…/v1" after stripping "/chat/completions", and then appending "/v1/models"
      // produces "…/v1/v1/models" — a 308 redirect that blocked model fetch (#5899).
      // Guard against a literal "scheme://v1" authority so we never strip the host itself.
      if (base.endsWith("/v1") && !base.endsWith("://v1")) {
        base = base.slice(0, -3);
      }

      // T39: Try multiple endpoint formats
      const endpoints = [
        `${base}/v1/models`,
        `${base}/models`,
        `${baseUrl.replace(/\/$/, "")}/models`, // Original fallback
      ];

      // #8347: opt-in `client_version` query param on the model-LIST request only (never on
      // any inference URL, and never on this path by default) — see discoveryClientVersion.ts.
      const discoveryClientVersionOptions = getDiscoveryClientVersionOptions(
        connection.providerSpecificData
      );

      // Remove duplicates
      const uniqueEndpoints = [...new Set(endpoints)].map((endpoint) =>
        buildProviderModelsUrl(endpoint, discoveryClientVersionOptions)
      );
      let models = null;
      let lastErrorStatus = null;
      const token = apiKey || accessToken;

      for (const modelsUrl of uniqueEndpoints) {
        try {
          const response = await safeOutboundFetch(modelsUrl, {
            ...SAFE_OUTBOUND_FETCH_PRESETS.modelsProbe,
            // #6939: model-list discovery for local/OpenAI-compatible providers (e.g. LM
            // Studio on a LAN host) must use the same guard tier as the test-connection path
            // (getProviderValidationGuard — respects the local-first default) rather than the
            // stricter outbound guard, which never allows LAN hosts by default.
            guard: getProviderValidationGuard(),
            proxyConfig: proxy,
            method: "GET",
            headers: isNamedOpenAIStyleProvider(provider)
              ? buildNamedOpenAiStyleHeaders(provider, token)
              : buildOptionalBearerHeaders(token),
          });

          if (response.ok) {
            const data = await response.json();
            models = isNamedOpenAIStyleProvider(provider)
              ? normalizeOpenAiLikeModelsResponse(data, provider)
              : data.data || data.models || [];
            if (provider === "ollama-local")
              models = await enrichOllamaLocalModels(models, baseUrl, proxy, token);
            break; // Success!
          }

          if (response.status === 401 || response.status === 403) {
            lastErrorStatus = response.status;
            throw new Error("auth_failed");
          }
        } catch (err: any) {
          if (err.message === "auth_failed") break; // Don't try other endpoints if auth failed

          if (err?.code === "REDIRECT_BLOCKED") {
            continue; // Try next endpoint
          }

          const status = getSafeOutboundFetchErrorStatus(err);
          if (status) {
            throw err;
          }
        }
      }

      // If all endpoints failed (but not because of auth), fallback to local catalog
      if (!models) {
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning:
            lastErrorStatus === 401 || lastErrorStatus === 403
              ? `Auth failed (${lastErrorStatus}) — using cached catalog`
              : "API unavailable — using cached catalog",
          localWarning:
            lastErrorStatus === 401 || lastErrorStatus === 403
              ? `Auth failed (${lastErrorStatus}) — using local catalog`
              : "API unavailable — using local catalog",
        });
        if (fallback) return fallback;

        if (lastErrorStatus === 401 || lastErrorStatus === 403) {
          return NextResponse.json(
            { error: `Auth failed: ${lastErrorStatus}` },
            { status: lastErrorStatus }
          );
        }

        console.warn(`[models] All endpoints failed for ${provider}, using local catalog`);
        models = toLocalCatalogModels();
        return buildResponse({
          provider,
          connectionId,
          models,
          source: "local_catalog",
          warning: "API unavailable — using local catalog",
        });
      }
      return buildApiDiscoveryResponse(models);
    }

    if (provider === "cursor") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      const warnings: string[] = [];
      const token = (accessToken || apiKey || "").trim();
      const machineId =
        typeof connection?.providerSpecificData === "object" &&
        connection.providerSpecificData &&
        typeof (connection.providerSpecificData as { machineId?: unknown }).machineId === "string"
          ? (connection.providerSpecificData as { machineId: string }).machineId
          : null;

      if (token) {
        try {
          const models = await fetchCursorAvailableModels({
            accessToken: token,
            machineId,
          });
          return buildApiDiscoveryResponse(models);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log("[models] Cursor AvailableModels failed:", message);
          warnings.push(`AvailableModels unavailable (${message})`);
        }
      } else {
        warnings.push("no Cursor access token on connection");
      }

      try {
        const models = ensureCursorAutoCatalogEntry(await fetchCursorAgentModels());
        return buildApiDiscoveryResponse(models);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log("[models] cursor-agent fetch failed:", message);
        const detail = [...warnings, `cursor-agent unavailable (${message})`].join("; ");
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: `${detail} — using cached catalog`,
          localWarning: `${detail} — using local catalog`,
        });
        if (fallback) return fallback;
        return NextResponse.json(
          { error: `Failed to fetch Cursor models: ${detail}` },
          { status: 502 }
        );
      }
    }

    if (provider === "inner-ai") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      try {
        // Parse "TOKEN EMAIL" credential format
        const raw = apiKey.trim();
        const eqIdx = raw.indexOf("=");
        const stripped = eqIdx > 0 && !raw.startsWith("eyJ") ? raw.slice(eqIdx + 1).trim() : raw;
        const lastSpace = stripped.lastIndexOf(" ");
        let innerAiToken = stripped;
        let innerAiEmail = "";
        if (lastSpace > 0) {
          const possibleEmail = stripped.slice(lastSpace + 1).trim();
          if (possibleEmail.includes("@")) {
            innerAiToken = stripped.slice(0, lastSpace).trim();
            innerAiEmail = possibleEmail;
          }
        }

        // Decode device_id from JWT payload
        let innerAiDeviceId = "";
        try {
          const parts = innerAiToken.split(".");
          if (parts.length >= 2) {
            const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
            innerAiDeviceId = String(
              payload?.device_id ??
                payload?.deviceId ??
                payload?.["device-id"] ??
                payload?.did ??
                ""
            ).trim();
          }
        } catch {
          /* ignore */
        }

        const innerAiHeaders: Record<string, string> = {
          "USER-TOKEN": innerAiToken,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
          Origin: "https://app.innerai.com",
          Referer: "https://app.innerai.com/",
        };
        if (innerAiEmail) innerAiHeaders["USER-EMAIL"] = innerAiEmail;
        if (innerAiDeviceId) innerAiHeaders["DEVICE-ID"] = innerAiDeviceId;

        const modelsResp = await safeOutboundFetch(
          "https://platformapi.innerai.com/api/v1/ai_models",
          { headers: innerAiHeaders },
          getProviderOutboundGuard(provider)
        );
        if (!modelsResp.ok) {
          throw new Error(`Inner.ai models API returned HTTP ${modelsResp.status}`);
        }

        const modelsBody = await modelsResp.json().catch(() => null);
        const rawModels: Array<Record<string, unknown>> = Array.isArray(modelsBody?.ai_models)
          ? modelsBody.ai_models
          : Array.isArray(modelsBody)
            ? modelsBody
            : [];

        // Filter: enabled, available, text/chat category only.
        // Use ai_model_categories[].unique_identifier === "text" when available;
        // fall back to llm_model name heuristic for models without categories.
        const nonTextPattern =
          /image|video|audio|img|vid|sound|music|voice|tts|stt|track|clip|avatar|cartoon|flux|stable.diff|recraft|ideogram|leonardo|magnific|bria|seedream|luma|kling|pika|veo|wan-|heygen|did-|vidu|pixverse|sora-|gen-[0-9]|playground|gemini-fal|gamma|lyria|clothes|whisper/i;
        const textModels = rawModels.filter((m) => {
          if (m.enable === false || m.unavailable_api) return false;
          if (typeof m.llm_model !== "string") return false;
          const cats = Array.isArray(m.ai_model_categories) ? m.ai_model_categories : null;
          if (cats && cats.length > 0) {
            return cats.some(
              (c: Record<string, unknown>) =>
                String(c.unique_identifier ?? c.name ?? "").toLowerCase() === "text"
            );
          }
          // No categories field — fall back to name heuristic
          return !nonTextPattern.test(m.llm_model as string);
        });

        const models = textModels.map((m) => ({
          id: String(m.llm_model),
          name: String(m.name || m.llm_model),
        }));

        return buildApiDiscoveryResponse(models);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: `Inner.ai models unavailable (${message}) — using cached catalog`,
          localWarning: `Inner.ai models unavailable (${message}) — using local catalog`,
        });
        if (fallback) return fallback;
        return NextResponse.json(
          { error: `Failed to fetch Inner.ai models: ${message}` },
          { status: 502 }
        );
      }
    }

    if (provider === "antigravity" || provider === "agy") {
      const cachedResponse = maybeReturnCachedDiscovery();
      if (cachedResponse) return cachedResponse;

      const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
      if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

      const staticModels = getStaticModelsForProvider(provider) || [];

      if (!accessToken) {
        const fallback = buildDiscoveryFallbackResponse({
          cacheWarning: "OAuth token unavailable — using cached catalog",
          localWarning: "OAuth token unavailable — using local catalog",
        });
        if (fallback) return fallback;
        return buildResponse({
          provider,
          connectionId,
          models: staticModels,
          source: "local_catalog",
          warning: "OAuth token unavailable — using local catalog",
        });
      }

      const remoteModels = await fetchAntigravityDiscoveryModelsCached(
        accessToken,
        connectionId,
        proxy,
        connection.providerSpecificData,
        provider
      );
      if (remoteModels.length > 0) {
        return buildApiDiscoveryResponse(remoteModels);
      }

      const fallback = buildDiscoveryFallbackResponse();
      if (fallback) return fallback;

      return buildResponse({
        provider,
        connectionId,
        models: staticModels,
        source: "local_catalog",
        ...(usesCuratedModelsOnly ? {} : { warning: "API unavailable — using local catalog" }),
      });
    }

    // Zed Hosted needs a two-step auth the generic discovery path cannot express:
    // `cloud.zed.dev/models` rejects the account access token and requires an LLM
    // token minted by POST /client/llm_tokens (authorized with Zed's own
    // `<userId> <accessToken>` scheme). The registry `modelsUrl` otherwise falls
    // through to deriveConfigFromRegistryModelsUrl(), which hardcodes
    // `Bearer <token>` and always 401s with "Invalid Authorization header".
    // ProviderModelsConfigEntry.buildHeaders is synchronous, so the token
    // exchange cannot be expressed there — hence a dedicated branch that reuses
    // the executor's own resolveZedModels().
    if (provider === "zed-hosted") {
      const zedToken = accessToken || apiKey;
      if (!zedToken) {
        const fallback = buildDiscoveryFallbackResponse();
        if (fallback) return fallback;
        return NextResponse.json({ error: "Zed connection has no access token" }, { status: 400 });
      }
      let providerSpecificData: Record<string, unknown> = {};
      const rawPsd = (connection as { providerSpecificData?: unknown }).providerSpecificData;
      if (typeof rawPsd === "string") {
        try {
          providerSpecificData = JSON.parse(rawPsd) as Record<string, unknown>;
        } catch {
          providerSpecificData = {};
        }
      } else if (rawPsd && typeof rawPsd === "object") {
        providerSpecificData = rawPsd as Record<string, unknown>;
      }

      try {
        const catalog = await resolveZedModels({
          accessToken: zedToken,
          providerSpecificData,
        } as Parameters<typeof resolveZedModels>[0]);
        const zedModels = (catalog?.models ?? []).map((model) => ({
          id: model.id,
          name: model.name,
          context_length: model.contextLength,
          max_output_tokens: model.maxOutputTokens,
          supports_tools: model.supportsTools,
          supports_images: model.supportsImages,
        }));
        return buildApiDiscoveryResponse(zedModels);
      } catch (error) {
        console.log("Error fetching models from provider", {
          provider,
          errorText: error instanceof Error ? error.message : String(error),
        });
        const fallback = buildDiscoveryFallbackResponse();
        if (fallback) return fallback;
        return NextResponse.json(
          { error: `Failed to fetch models: ${sanitizeErrorMessage(error)}` },
          { status: 502 }
        );
      }
    }

    const config =
      provider in PROVIDER_MODELS_CONFIG
        ? PROVIDER_MODELS_CONFIG[provider as keyof typeof PROVIDER_MODELS_CONFIG]
        : deriveConfigFromRegistryModelsUrl(provider);
    if (provider === "codex") {
      // Auto-merge live/GitHub/local (future-proof discovery), then apply explicit
      // denylist filters (e.g. drop GPT-5.4 family). Do not gate remote-only IDs.
      const staticCodexCatalog = mergeLocalCatalogModels(
        getModelsByProviderId("codex") || [],
        getStaticModelsForProvider("codex") || []
      );
      const finalizeCodexCatalog = (remoteModels: typeof cachedDiscoveryModels) =>
        buildCodexDiscoveryCatalog(remoteModels, staticCodexCatalog);
      const cachedCatalogModels = finalizeCodexCatalog(cachedDiscoveryModels);
      const cachedIdsMatchFinalCatalog =
        cachedDiscoveryModels.length === cachedCatalogModels.length &&
        cachedDiscoveryModels.every((model, index) => model.id === cachedCatalogModels[index]?.id);
      const persistFilteredCacheIfNeeded = async () => {
        if (cachedIdsMatchFinalCatalog) return;
        await persistDiscoveredModels(provider, connectionId, cachedCatalogModels);
      };

      if (!refresh && cachedDiscoveryModels.length > 0) {
        await persistFilteredCacheIfNeeded();
        return buildResponse({
          provider,
          connectionId,
          models: cachedCatalogModels,
          source: "cache",
        });
      }

      if (!refresh && !autoFetchModels) {
        return buildResponse({
          provider,
          connectionId,
          models: finalizeCodexCatalog([]),
          source: "local_catalog",
          warning: "Auto-fetch disabled — using local catalog",
        });
      }

      const liveModels = await fetchCodexDiscoveryModels({
        accessToken: accessToken || null,
        providerSpecificData: connection.providerSpecificData,
        fetchImpl: (url, init) =>
          safeOutboundFetch(url, {
            ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
            guard: getProviderOutboundGuard(),
            proxyConfig: proxy,
            ...init,
          }),
      });
      const githubCatalogModels = await fetchCodexGithubCatalogModels({
        fetchImpl: (url, init) =>
          safeOutboundFetch(url, {
            ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
            guard: "public-only",
            proxyConfig: proxy,
            ...init,
          }),
      });
      if (liveModels && liveModels.length > 0) {
        const enrichedLiveModels =
          githubCatalogModels && githubCatalogModels.length > 0
            ? enrichCodexModelsFromGithubCatalog(liveModels, githubCatalogModels)
            : liveModels;
        return buildApiDiscoveryResponse(finalizeCodexCatalog(enrichedLiveModels));
      }

      if (githubCatalogModels && githubCatalogModels.length > 0) {
        return buildResponse({
          provider,
          connectionId,
          models: finalizeCodexCatalog(githubCatalogModels),
          source: "github_catalog",
          warning: "Codex live catalog unavailable — using GitHub model catalog",
        });
      }

      if (cachedDiscoveryModels.length > 0) {
        await persistFilteredCacheIfNeeded();
        return buildResponse({
          provider,
          connectionId,
          models: cachedCatalogModels,
          source: "cache",
          warning: "Codex live catalog unavailable — using cached catalog",
        });
      }
      return buildResponse({
        provider,
        connectionId,
        models: finalizeCodexCatalog([]),
        source: "local_catalog",
        intentional: true,
        warning: "Codex live and GitHub catalogs unavailable — using local catalog",
      });
    }

    const localCatalog = mergeLocalCatalogModels(registryCatalogModels, specialtyCatalogModels);
    if (!config && localCatalog.length > 0) {
      return buildResponse({
        provider,
        connectionId,
        models: localCatalog.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          ...((m as Record<string, unknown>).apiFormat
            ? { apiFormat: (m as Record<string, unknown>).apiFormat as string | undefined }
            : {}),
          ...((m as Record<string, unknown>).supportedEndpoints
            ? {
                supportedEndpoints: (m as Record<string, unknown>).supportedEndpoints as
                  string[] | undefined,
              }
            : {}),
          ...(registryCatalogModels.length > 0 ? { owned_by: provider } : {}),
        })),
        source: "local_catalog",
        // #5460/#5465 — providers with no discovery config (embedding/rerank/
        // web-cookie providers like voyage-ai, jina-ai, t3-web) are
        // intentionally local-catalog-only; model-sync imports rather than 502s.
        intentional: true,
        warning: "API unavailable — using local catalog",
      });
    }
    if (!config) {
      return NextResponse.json(
        { error: `Provider ${provider} does not support models listing` },
        { status: 400 }
      );
    }

    const cachedResponse = maybeReturnCachedDiscovery();
    if (cachedResponse) return cachedResponse;

    const autoFetchDisabledResponse = maybeReturnAutoFetchDisabled();
    if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

    // Get auth token
    const token = accessToken || apiKey;
    if (!token) {
      const fallback = buildDiscoveryFallbackResponse({
        cacheWarning: "No token configured — using cached catalog",
        localWarning: "No token configured — using local catalog",
      });
      if (fallback) return fallback;
      return NextResponse.json(
        {
          error:
            "No API key configured for this provider. Please add an API key in the provider settings.",
        },
        { status: 400 }
      );
    }

    // Build request URL
    let url = config.url;
    if (provider === "alibaba" || provider === "alibaba-cn" || provider === "qwen-cloud") {
      url = resolveAlibabaProviderModelsUrl(
        provider,
        connection.providerSpecificData,
        config.url.replace(/\/models\/?$/, "")
      );
    }
    // VibeProxy: honor a user-configured custom base URL for the built-in
    // `openai` provider (e.g. an OpenAI-compatible gateway / proxy). Without
    // this, model discovery always hit the hardcoded api.openai.com and ignored
    // the configured endpoint — returning the wrong catalog (or failing auth)
    // for gateway users, and preventing instant access to gateway-served models.
    // Falls back to config.url (api.openai.com) when no custom base URL is set.
    if (provider === "openai") {
      const customBaseUrl = getProviderBaseUrl(connection.providerSpecificData);
      if (customBaseUrl) {
        let base = customBaseUrl.replace(/\/$/, "");
        if (base.endsWith("/chat/completions")) {
          base = base.slice(0, -"/chat/completions".length);
        } else if (base.endsWith("/completions")) {
          base = base.slice(0, -"/completions".length);
        }
        // Strip a trailing /v1 unconditionally (same #5899 double-prefix guard as the
        // discovery path above): a customBaseUrl like ".../v1/chat/completions" would
        // otherwise leave base as ".../v1" and produce ".../v1/v1/models" below.
        if (base.endsWith("/v1") && !base.endsWith("://v1")) {
          base = base.slice(0, -"/v1".length);
        }
        url = `${base}/v1/models`;
      }
    }
    if (provider === "cloudflare-ai") {
      const pData = asRecord(connection.providerSpecificData);
      const accountId =
        (typeof pData.accountId === "string" && pData.accountId) ||
        process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!accountId) {
        return NextResponse.json(
          { error: "Cloudflare Workers AI requires an Account ID in provider settings." },
          { status: 400 }
        );
      }
      url = url.replace("{accountId}", accountId);
    }
    const paginationBaseUrl = url;
    if (config.authQuery) {
      url += `${url.includes("?") ? "&" : "?"}${config.authQuery}=${token}`;
    }

    // Build headers
    const headerContext = { ...connection, accessToken, apiKey };
    const headers = assembleProviderModelsHeaders(config, token, headerContext);

    // Make request (with pagination for providers that use nextPageToken, e.g. Gemini)
    const fetchOptions: any = {
      method: config.method,
      headers,
    };

    if (config.body && config.method === "POST") {
      fetchOptions.body = JSON.stringify(config.body);
    }

    let allModels: any[] = [];
    let pageUrl = url;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit
    const seenTokens = new Set<string>();

    while (pageUrl && pageCount < MAX_PAGES) {
      pageCount++;
      let response: Response;
      try {
        response = await safeOutboundFetch(pageUrl, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.modelsPagination,
          guard: getProviderOutboundGuard(),
          proxyConfig: proxy,
          // Ollama Cloud /v1/models returns 301 redirects (#1381)
          ...(provider === "ollama-cloud" ? { allowRedirect: true } : {}),
          ...fetchOptions,
        });
      } catch (error) {
        const fallback = buildDiscoveryErrorFallbackResponse(error);
        if (fallback) return fallback;
        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error fetching models from provider", { provider, errorText });
        const fallback = buildDiscoveryFallbackResponse();
        if (fallback) return fallback;
        return NextResponse.json(
          { error: `Failed to fetch models: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      let pageModels = config.parseResponse(data);
      if (getProviderConnectionFamilyIds("alibaba").includes(provider)) {
        const { parseAlibabaModelStudioModelsForConnection } =
          await import("./discovery/providerModelsConfig.ts");
        pageModels = parseAlibabaModelStudioModelsForConnection(
          data,
          connection.providerSpecificData as Record<string, unknown> | null | undefined
        );
      }
      allModels = allModels.concat(pageModels);

      const nextPageToken = data.nextPageToken;
      if (!nextPageToken) break;
      if (seenTokens.has(nextPageToken)) {
        console.warn(`[models] ${provider}: duplicate nextPageToken detected, stopping pagination`);
        break;
      }
      seenTokens.add(nextPageToken);
      pageUrl = `${paginationBaseUrl}${paginationBaseUrl.includes("?") ? "&" : "?"}pageToken=${encodeURIComponent(nextPageToken)}`;
      if (config.authQuery) {
        pageUrl += `&${config.authQuery}=${token}`;
      }
    }

    if (pageCount > 1) {
      console.log(
        `[models] ${provider}: fetched ${allModels.length} models across ${pageCount} pages`
      );
    }

    if (getProviderConnectionFamilyIds("alibaba").includes(provider)) {
      const { shouldUseLiveAlibabaFreeModelDiscovery } =
        await import("@omniroute/open-sse/services/alibabaFreeTier.ts");
      const { scheduleAlibabaFreeTierProbeRefresh } =
        await import("@omniroute/open-sse/services/alibabaFreeTierDiscovery.ts");
      const { scheduleAlibabaFreeTierQuotaRefresh, hasAlibabaConsoleFreeTierAuth } =
        await import("@omniroute/open-sse/services/alibabaFreeTierQuotaFetcher.ts");
      const { resolveAlibabaProviderBaseUrl } =
        await import("@/shared/constants/alibabaProviderRegions.ts");
      const providerSpecificData = connection.providerSpecificData as Record<
        string,
        unknown
      > | null;
      if (shouldUseLiveAlibabaFreeModelDiscovery(providerSpecificData)) {
        if (hasAlibabaConsoleFreeTierAuth(providerSpecificData)) {
          scheduleAlibabaFreeTierQuotaRefresh(provider, {
            id: connectionId,
            providerSpecificData,
          });
        } else {
          const baseUrl = resolveAlibabaProviderBaseUrl(
            provider,
            providerSpecificData,
            paginationBaseUrl.replace(/\/models$/, "")
          );
          scheduleAlibabaFreeTierProbeRefresh(
            provider,
            {
              id: connectionId,
              apiKey: token,
              providerSpecificData,
            },
            allModels,
            `${baseUrl.replace(/\/$/, "")}/chat/completions`
          );
        }
      }
    }

    return buildApiDiscoveryResponse(allModels);
  } catch (error) {
    if (error instanceof SafeOutboundFetchError && error.code === "URL_GUARD_BLOCKED") {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    const status = getSafeOutboundFetchErrorStatus(error);
    if (status) {
      const message = error instanceof Error ? error.message : "Failed to fetch models";
      return NextResponse.json({ error: message }, { status });
    }
    console.log("Error fetching provider models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
