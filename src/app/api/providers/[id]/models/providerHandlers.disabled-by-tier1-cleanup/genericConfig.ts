import { NextResponse } from "next/server";
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { getProviderConnectionFamilyIds } from "@/shared/constants/providers";
import { resolveAlibabaProviderModelsUrl } from "@/shared/constants/alibabaProviderRegions";
import {
  type ProviderModelsConfigEntry,
  assembleProviderModelsHeaders,
  PROVIDER_MODELS_CONFIG,
} from "../discovery/providerModelsConfig";
import { deriveConfigFromRegistryModelsUrl } from "../discoveryConfig";
import { getProviderBaseUrl, mergeLocalCatalogModels } from "../discovery/helpers";
import type { ProviderHandlerContext } from "./types";

/**
 * Generic config-based discovery: uses PROVIDER_MODELS_CONFIG or
 * deriveConfigFromRegistryModelsUrl for providers without custom handlers.
 */
export async function handleGenericConfig(
  ctx: ProviderHandlerContext
): Promise<NextResponse | null> {
  const config =
    ctx.provider in PROVIDER_MODELS_CONFIG
      ? PROVIDER_MODELS_CONFIG[ctx.provider as keyof typeof PROVIDER_MODELS_CONFIG]
      : deriveConfigFromRegistryModelsUrl(ctx.provider);

  // Handle providers with no config but local catalog
  const localCatalog = mergeLocalCatalogModels(
    ctx.registryCatalogModels,
    ctx.specialtyCatalogModels
  );
  if (!config && localCatalog.length > 0) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: localCatalog.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        ...((m as Record<string, unknown>).apiFormat
          ? { apiFormat: (m as Record<string, unknown>).apiFormat as string | undefined }
          : {}),
        ...((m as Record<string, unknown>).supportedEndpoints
          ? {
              supportedEndpoints: (m as Record<string, unknown>).supportedEndpoints as
                | string[]
                | undefined,
            }
          : {}),
        ...(ctx.registryCatalogModels.length > 0 ? { owned_by: ctx.provider } : {}),
      })),
      source: "local_catalog",
      intentional: true,
      warning: "API unavailable — using local catalog",
    });
  }
  if (!config) {
    return NextResponse.json(
      { error: `Provider ${ctx.provider} does not support models listing` },
      { status: 400 }
    );
  }

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  // Get auth token
  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
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

  // Build request URL with provider-specific adjustments
  let url = config.url;
  if (
    ctx.provider === "alibaba" ||
    ctx.provider === "alibaba-cn" ||
    ctx.provider === "qwen-cloud"
  ) {
    url = resolveAlibabaProviderModelsUrl(
      ctx.provider,
      ctx.connection.providerSpecificData,
      config.url.replace(/\/models\/?$/, "")
    );
  }
  // VibeProxy: honor custom base URL for openai provider
  if (ctx.provider === "openai") {
    const customBaseUrl = getProviderBaseUrl(ctx.connection.providerSpecificData);
    if (customBaseUrl) {
      let base = customBaseUrl.replace(/\/$/, "");
      if (base.endsWith("/chat/completions")) {
        base = base.slice(0, -"/chat/completions".length);
      } else if (base.endsWith("/completions")) {
        base = base.slice(0, -"/completions".length);
      }
      if (base.endsWith("/v1") && !base.endsWith("://v1")) {
        base = base.slice(0, -"/v1".length);
      }
      url = `${base}/v1/models`;
    }
  }
  if (ctx.provider === "cloudflare-ai") {
    const pData = ctx.connection.providerSpecificData as Record<string, unknown> | null;
    const accountId =
      (typeof pData?.accountId === "string" && pData.accountId) ||
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
  const headerContext = { ...ctx.connection, accessToken: ctx.accessToken, apiKey: ctx.apiKey };
  const headers = assembleProviderModelsHeaders(config, token, headerContext);

  // Make request with pagination
  const fetchOptions: any = { method: config.method, headers };
  if (config.body && config.method === "POST") {
    fetchOptions.body = JSON.stringify(config.body);
  }

  let allModels: any[] = [];
  let pageUrl = url;
  let pageCount = 0;
  const MAX_PAGES = 20;
  const seenTokens = new Set<string>();

  while (pageUrl && pageCount < MAX_PAGES) {
    pageCount++;
    let response: Response;
    try {
      response = await safeOutboundFetch(pageUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsPagination,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        ...(ctx.provider === "ollama-cloud" ? { allowRedirect: true } : {}),
        ...fetchOptions,
      });
    } catch (error) {
      const fallback = ctx.buildDiscoveryErrorFallbackResponse(error);
      if (fallback) return fallback;
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Error fetching models from provider", {
        provider: ctx.provider,
        errorText,
      });
      const fallback = ctx.buildDiscoveryFallbackResponse();
      if (fallback) return fallback;
      return NextResponse.json(
        { error: `Failed to fetch models: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let pageModels = config.parseResponse(data);
    if (getProviderConnectionFamilyIds("alibaba").includes(ctx.provider)) {
      const { parseAlibabaModelStudioModelsForConnection } = await import(
        "./providerModelsConfig.ts"
      );
      pageModels = parseAlibabaModelStudioModelsForConnection(
        data,
        ctx.connection.providerSpecificData as Record<string, unknown> | null | undefined
      );
    }
    allModels = allModels.concat(pageModels);

    const nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
    if (seenTokens.has(nextPageToken)) {
      console.warn(
        `[models] ${ctx.provider}: duplicate nextPageToken detected, stopping pagination`
      );
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
      `[models] ${ctx.provider}: fetched ${allModels.length} models across ${pageCount} pages`
    );
  }

  // Alibaba free tier handling
  if (getProviderConnectionFamilyIds("alibaba").includes(ctx.provider)) {
    const { shouldUseLiveAlibabaFreeModelDiscovery } = await import(
      "@omniroute/open-sse/services/alibabaFreeTier.ts"
    );
    const { scheduleAlibabaFreeTierProbeRefresh } = await import(
      "@omniroute/open-sse/services/alibabaFreeTierDiscovery.ts"
    );
    const { scheduleAlibabaFreeTierQuotaRefresh, hasAlibabaConsoleFreeTierAuth } = await import(
      "@omniroute/open-sse/services/alibabaFreeTierQuotaFetcher.ts"
    );
    const { resolveAlibabaProviderBaseUrl } = await import(
      "@/shared/constants/alibabaProviderRegions.ts"
    );
    const providerSpecificData = ctx.connection.providerSpecificData as Record<
      string,
      unknown
    > | null;
    if (shouldUseLiveAlibabaFreeModelDiscovery(providerSpecificData)) {
      if (hasAlibabaConsoleFreeTierAuth(providerSpecificData)) {
        scheduleAlibabaFreeTierQuotaRefresh(ctx.provider, {
          id: ctx.connectionId,
          providerSpecificData,
        });
      } else {
        const baseUrl = resolveAlibabaProviderBaseUrl(
          ctx.provider,
          providerSpecificData,
          paginationBaseUrl.replace(/\/models$/, "")
        );
        scheduleAlibabaFreeTierProbeRefresh(
          ctx.provider,
          {
            id: ctx.connectionId,
            apiKey: token,
            providerSpecificData,
          },
          allModels,
          `${baseUrl.replace(/\/$/, "")}/chat/completions`
        );
      }
    }
  }

  return ctx.buildApiDiscoveryResponse(allModels);
}
