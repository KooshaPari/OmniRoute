import { NextResponse } from "next/server";
import { getRegistryEntry } from "@omniroute/open-sse/config/providerRegistry.ts";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import {
  getProviderBaseUrl,
  isLocalOpenAIStyleProvider,
  buildOptionalBearerHeaders,
  buildNamedOpenAiStyleHeaders,
  enrichOllamaLocalModels,
} from "../discovery/helpers";
import { normalizeOpenAiLikeModelsResponse } from "../discovery/normalizers";
import { getProviderValidationGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { isNamedOpenAIStyleProvider } from "../discovery/providerSets";
import {
  buildProviderModelsUrl,
  getDiscoveryClientVersionOptions,
} from "../discoveryClientVersion";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles OpenAI-compatible, local OpenAI-style, and named OpenAI-style
 * providers by probing multiple /models endpoint variants.
 */
export async function handleOpenAICompatible(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  const { isOpenAICompatibleProvider } = await import("@/shared/constants/providers");

  if (
    !isOpenAICompatibleProvider(ctx.provider) &&
    !isLocalOpenAIStyleProvider(ctx.provider) &&
    !isNamedOpenAIStyleProvider(ctx.provider)
  ) {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const { isOpenAICompatibleProvider: isOpenAICompat } =
    await import("@/shared/constants/providers");

  const registryEntry =
    isLocalOpenAIStyleProvider(ctx.provider) || isNamedOpenAIStyleProvider(ctx.provider)
      ? getRegistryEntry(ctx.provider)
      : null;
  const rawBaseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) ||
    (typeof registryEntry?.baseUrl === "string" ? registryEntry.baseUrl : null);
  const baseUrl = rawBaseUrl;
  if (!baseUrl) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "Base URL unavailable — using cached catalog",
      localWarning: "Base URL unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return NextResponse.json(
      {
        error: isOpenAICompat(ctx.provider)
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
    ctx.connection.providerSpecificData
  );

  // Remove duplicates
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
        // #6939: model-list discovery for local/OpenAI-compatible providers (e.g. LM
        // Studio on a LAN host) must use the same guard tier as the test-connection path
        // (getProviderValidationGuard — respects the local-first default) rather than the
        // stricter outbound guard, which never allows LAN hosts by default.
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
    const fallback = h.buildDiscoveryFallbackResponse({
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
    models = h.toLocalCatalogModels();
    return h.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models,
      source: "local_catalog",
      warning: "API unavailable — using local catalog",
    });
  }
  return h.buildApiDiscoveryResponse(models);
}
