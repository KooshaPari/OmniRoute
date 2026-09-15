import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { asRecord, toNonEmptyString } from "../discovery/helpers";
import {
  fetchGitHubCopilotModels,
  fetchGheCopilotModels,
} from "@omniroute/open-sse/services/githubCopilotModels.ts";
import { resolveCopilotDiscoveryToken } from "@/lib/providerModels/copilotDiscoveryToken";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles GitHub Copilot model discovery.
 */
export async function handleGitHubCopilot(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "github") return null;

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const psd = asRecord(ctx.connection.providerSpecificData);
  const copilotToken = resolveCopilotDiscoveryToken({
    accessToken: ctx.accessToken,
    copilotToken: psd.copilotToken,
  });

  const discovery = await fetchGitHubCopilotModels({
    token: copilotToken,
    fetchImpl: (url, init) =>
      safeOutboundFetch(url as string, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        ...(init as Record<string, unknown>),
      }),
    fallbackModels: h.toLocalCatalogModels(),
  });

  if (discovery.source === "api") {
    return h.buildApiDiscoveryResponse(discovery.models);
  }

  const fallback = h.buildDiscoveryFallbackResponse({
    cacheWarning: "Copilot models API unavailable — using cached catalog",
    localWarning: "Copilot models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return h.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: discovery.models,
    source: "local_catalog",
    warning: "Copilot models API unavailable — using local catalog",
  });
}

/**
 * Handles GHE Copilot model discovery.
 */
export async function handleGheCopilot(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "ghe-copilot") return null;

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const psd = asRecord(ctx.connection.providerSpecificData);
  const copilotToken = resolveCopilotDiscoveryToken({
    accessToken: ctx.accessToken,
    copilotToken: psd.copilotToken,
  });

  const copilotApiUrl =
    toNonEmptyString(psd.copilotApiUrl) || toNonEmptyString(psd.copilotProxyUrl) || null;

  const models = await fetchGheCopilotModels({
    apiUrl: copilotApiUrl,
    token: copilotToken,
    fetchImpl: (url, init) => fetch(url as string, init as RequestInit),
  });

  if (models.length > 0) {
    return h.buildApiDiscoveryResponse(models);
  }

  const fallback = h.buildDiscoveryFallbackResponse({
    cacheWarning: "GHE Copilot models API unavailable — using cached catalog",
    localWarning: "GHE Copilot models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return h.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: [],
    source: "local_catalog",
    warning: "GHE Copilot models API unavailable — using local catalog",
  });
}
