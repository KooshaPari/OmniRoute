import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { fetchKiroAvailableModels } from "@omniroute/open-sse/services/kiroModels.ts";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles Kiro model discovery via CodeWhisperer ListAvailableModels API.
 */
export async function handleKiro(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "kiro") return null;

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  if (!ctx.accessToken) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "OAuth token unavailable — using cached catalog",
      localWarning: "OAuth token unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return h.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: h.toLocalCatalogModels(),
      source: "local_catalog",
      warning: "OAuth token unavailable — using local catalog",
    });
  }

  const discovery = await fetchKiroAvailableModels({
    accessToken: ctx.accessToken,
    providerSpecificData: ctx.connection.providerSpecificData,
    fetchImpl: (url, init) =>
      safeOutboundFetch(url as string, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        ...(init as Record<string, unknown>),
      }),
    fallbackModels: h.toLocalCatalogModels(),
  });

  if (discovery.source === "api" && discovery.models.length > 0) {
    return h.buildApiDiscoveryResponse(discovery.models);
  }

  const fallback = h.buildDiscoveryFallbackResponse({
    cacheWarning: "Kiro models API unavailable — using cached catalog",
    localWarning: "Kiro models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return h.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: discovery.models,
    source: "local_catalog",
    warning: "Kiro models API unavailable — using local catalog",
  });
}
