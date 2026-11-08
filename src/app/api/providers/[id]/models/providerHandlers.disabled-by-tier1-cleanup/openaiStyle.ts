import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import {
  getProviderValidationGuard,
  getProviderOutboundGuard,
} from "@/shared/network/outboundUrlGuardPolicy";
import { isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { getRegistryEntry } from "@omniroute/open-sse/config/providerRegistry.ts";
import { getProviderBaseUrl } from "../discovery/helpers";
import {
  isLocalOpenAIStyleProvider,
  normalizeOpenAiLikeModelsResponse,
  buildOptionalBearerHeaders,
  buildNamedOpenAiStyleHeaders,
  enrichOllamaLocalModels,
} from "../discovery/helpers";
import { isNamedOpenAIStyleProvider } from "../discovery/providerSets";
import {
  buildProviderModelsUrl,
  getDiscoveryClientVersionOptions,
} from "../discoveryClientVersion";
import type { ProviderHandlerContext } from "./types";

/**
 * OpenAI-compatible / Local / Named providers: multi-endpoint discovery
 * with fallback chain.
 */
export async function handleOpenAICompatible(
  ctx: ProviderHandlerContext
): Promise<NextResponse | null> {
  if (
    !isOpenAICompatibleProvider(ctx.provider) &&
    !isLocalOpenAIStyleProvider(ctx.provider) &&
    !isNamedOpenAIStyleProvider(ctx.provider)
  ) {
    return null;
  }

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const registryEntry =
    isLocalOpenAIStyleProvider(ctx.provider) || isNamedOpenAIStyleProvider(ctx.provider)
      ? getRegistryEntry(ctx.provider)
      : null;
  const rawBaseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) ||
    (typeof registryEntry?.baseUrl === "string" ? registryEntry.baseUrl : null);
  const baseUrl = rawBaseUrl;

  if (!baseUrl) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "Base URL unavailable — using cached catalog",
      localWarning: "Base URL unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return NextResponse.json(
      {
        error: isOpenAICompatibleProvider(ctx.provider)
          ? "No base URL configured for OpenAI compatible provider"
          : isLocalOpenAIStyleProvider(ctx.provider)
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

  // Strip trailing /v1 to avoid double-prefix issues (#5899)
  if (base.endsWith("/v1") && !base.endsWith("://v1")) {
    base = base.slice(0, -3);
  }

  const endpoints = [`${base}/v1/models`, `${base}/models`, `${baseUrl.replace(/\/$/, "")}/models`];

  const discoveryClientVersionOptions = getDiscoveryClientVersionOptions(
    ctx.connection.providerSpecificData
  );

  const uniqueEndpoints = [...new Set(endpoints)].map((endpoint) =>
    buildProviderModelsUrl(endpoint, discoveryClientVersionOptions)
  );

  let models = null;
  let lastErrorStatus = null;
  const token = ctx.apiKey || ctx.accessToken;

  for (const modelsUrl of uniqueEndpoints) {
    try {
      const response = await safeOutboundFetch(modelsUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsProbe,
        guard: getProviderValidationGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers: isNamedOpenAIStyleProvider(ctx.provider)
          ? buildNamedOpenAiStyleHeaders(ctx.provider, token)
          : buildOptionalBearerHeaders(token),
      });

      if (response.ok) {
        const data = await response.json();
        models = isNamedOpenAIStyleProvider(ctx.provider)
          ? normalizeOpenAiLikeModelsResponse(data, ctx.provider)
          : data.data || data.models || [];
        if (ctx.provider === "ollama-local")
          models = await enrichOllamaLocalModels(models, baseUrl, ctx.proxy, token);
        break;
      }

      if (response.status === 401 || response.status === 403) {
        lastErrorStatus = response.status;
        throw new Error("auth_failed");
      }
    } catch (err: any) {
      if (err.message === "auth_failed") break;
      if (err?.code === "REDIRECT_BLOCKED") continue;

      const status = getSafeOutboundFetchErrorStatus(err);
      if (status) throw err;
    }
  }

  if (!models) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
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

    console.warn(`[models] All endpoints failed for ${ctx.provider}, using local catalog`);
    models = ctx.toLocalCatalogModels();
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models,
      source: "local_catalog",
      warning: "API unavailable — using local catalog",
    });
  }

  return ctx.buildApiDiscoveryResponse(models);
}
