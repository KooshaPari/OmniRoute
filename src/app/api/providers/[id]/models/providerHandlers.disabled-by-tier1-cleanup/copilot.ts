import { NextResponse } from "next/server";
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  fetchGitHubCopilotModels,
  fetchGheCopilotModels,
} from "@omniroute/open-sse/services/githubCopilotModels.ts";
import { resolveCopilotDiscoveryToken } from "@/lib/providerModels/copilotDiscoveryToken";
import {
  asRecord,
  toNonEmptyString,
  getProviderBaseUrl,
  mergeLocalCatalogModels,
  buildOptionalBearerHeaders,
} from "../discovery/helpers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { getStaticModelsForProvider } from "@/lib/providers/staticModels";
import type { ProviderHandlerContext } from "./types";

/**
 * GitHub Copilot: per-account catalog discovery with Copilot token exchange.
 */
export async function handleGitHubCopilot(
  ctx: ProviderHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "github") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
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
    fallbackModels: ctx.toLocalCatalogModels(),
  });

  if (discovery.source === "api") {
    return ctx.buildApiDiscoveryResponse(discovery.models);
  }

  const fallback = ctx.buildDiscoveryFallbackResponse({
    cacheWarning: "Copilot models API unavailable — using cached catalog",
    localWarning: "Copilot models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: discovery.models,
    source: "local_catalog",
    warning: "Copilot models API unavailable — using local catalog",
  });
}

/**
 * GHE Copilot: enterprise-specific catalog discovery.
 */
export async function handleGHECopilot(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "ghe-copilot") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
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
    return ctx.buildApiDiscoveryResponse(models);
  }

  const fallback = ctx.buildDiscoveryFallbackResponse({
    cacheWarning: "GHE Copilot models API unavailable — using cached catalog",
    localWarning: "GHE Copilot models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: [],
    source: "local_catalog",
    warning: "GHE Copilot models API unavailable — using local catalog",
  });
}
