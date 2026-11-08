import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  AZURE_AI_DEFAULT_BASE_URL,
  buildAzureAiModelsUrl,
} from "@omniroute/open-sse/config/azureAi.ts";
import {
  normalizeAzureModelsResponse,
  normalizeOpenAiLikeModelsResponse,
} from "../discovery/normalizers";
import {
  getProviderBaseUrl,
  normalizeAzureOpenAIBaseUrl,
  getAzureOpenAIApiVersion,
} from "../discovery/helpers";
import type { ProviderHandlerContext } from "./types";

/**
 * Azure AI: multi-endpoint discovery with Azure-specific auth.
 */
export async function handleAzureAi(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "azure-ai") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

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

  const rawBaseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) || AZURE_AI_DEFAULT_BASE_URL;
  const baseUrl = normalizeAzureOpenAIBaseUrl(rawBaseUrl);
  const apiVersion = encodeURIComponent(
    getAzureOpenAIApiVersion(ctx.connection.providerSpecificData) || "2024-12-01-preview"
  );

  const discoveryUrls = [
    buildAzureAiModelsUrl(rawBaseUrl),
    `${baseUrl}/deployments`,
    `${baseUrl}/openai/deployments?api-version=${apiVersion}`,
    `${baseUrl}/openai/models?api-version=${apiVersion}`,
  ];

  let lastStatus = 0;
  for (const modelsUrl of discoveryUrls) {
    let response: Response;
    try {
      response = await safeOutboundFetch(modelsUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers: { "Content-Type": "application/json", "api-key": token },
      });
    } catch (error) {
      const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
        cacheWarning: "Azure AI models API unavailable — using cached catalog",
        localWarning: "Azure AI models API unavailable — using local catalog",
      });
      if (fallback) return fallback;
      throw error;
    }

    if (response.ok) {
      const normalized = normalizeAzureModelsResponse(await response.json(), "azure-ai");
      if (normalized.length > 0) {
        return ctx.buildApiDiscoveryResponse(normalized);
      }
    }

    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) break;
  }

  const fallback = ctx.buildDiscoveryFallbackResponse({
    cacheWarning: `Azure AI models probe failed (${lastStatus || "empty"}) — using cached catalog`,
    localWarning: `Azure AI models probe failed (${lastStatus || "empty"}) — using local catalog`,
  });
  if (fallback) return fallback;
  return NextResponse.json(
    { error: `Failed to fetch models: ${lastStatus || "unknown"}` },
    { status: lastStatus || 502 }
  );
}

/**
 * Azure OpenAI: resource-specific model discovery.
 */
export async function handleAzureOpenAI(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "azure-openai") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "No API key configured for this provider. Please add an API key in the provider settings.",
      },
      { status: 400 }
    );
  }

  const rawBaseUrl = getProviderBaseUrl(ctx.connection.providerSpecificData);
  if (!rawBaseUrl) {
    return NextResponse.json(
      { error: "No Azure OpenAI resource endpoint configured" },
      { status: 400 }
    );
  }

  const baseUrl = normalizeAzureOpenAIBaseUrl(rawBaseUrl);
  const apiVersion = encodeURIComponent(
    getAzureOpenAIApiVersion(ctx.connection.providerSpecificData)
  );
  const discoveryUrls = [
    `${baseUrl}/openai/deployments?api-version=${apiVersion}`,
    `${baseUrl}/openai/models?api-version=${apiVersion}`,
  ];

  let lastStatus = 0;
  for (const modelsUrl of discoveryUrls) {
    let response: Response;
    try {
      response = await safeOutboundFetch(modelsUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers: { "Content-Type": "application/json", "api-key": token },
      });
    } catch (error) {
      const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
        cacheWarning: "Azure OpenAI models API unavailable — using cached catalog",
        localWarning: "Azure OpenAI models API unavailable — using local catalog",
      });
      if (fallback) return fallback;
      throw error;
    }

    if (response.ok) {
      return ctx.buildApiDiscoveryResponse(
        normalizeOpenAiLikeModelsResponse(await response.json(), "azure-openai")
      );
    }

    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) break;
  }

  const fallback = ctx.buildDiscoveryFallbackResponse({
    cacheWarning: `Azure OpenAI models probe failed (${lastStatus}) — using cached catalog`,
    localWarning: `Azure OpenAI models probe failed (${lastStatus}) — using local catalog`,
  });
  if (fallback) return fallback;
  return NextResponse.json(
    { error: `Failed to fetch models: ${lastStatus || "unknown"}` },
    { status: lastStatus || 502 }
  );
}
