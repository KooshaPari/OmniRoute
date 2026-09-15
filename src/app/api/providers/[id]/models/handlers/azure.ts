import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  getProviderBaseUrl,
  normalizeAzureOpenAIBaseUrl,
  getAzureOpenAIApiVersion,
} from "../discovery/helpers";
import {
  normalizeAzureModelsResponse,
  normalizeOpenAiLikeModelsResponse,
} from "../discovery/normalizers";
import {
  AZURE_AI_DEFAULT_BASE_URL,
  buildAzureAiModelsUrl,
} from "@omniroute/open-sse/config/azureAi.ts";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles Azure AI model discovery (multi-URL probe).
 */
export async function handleAzureAi(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "azure-ai") {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    const fallback = h.buildDiscoveryFallbackResponse({
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
        headers: {
          "Content-Type": "application/json",
          "api-key": token,
        },
      });
    } catch (error) {
      const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
        cacheWarning: "Azure AI models API unavailable — using cached catalog",
        localWarning: "Azure AI models API unavailable — using local catalog",
      });
      if (fallback) return fallback;
      throw error;
    }

    if (response.ok) {
      const normalized = normalizeAzureModelsResponse(await response.json(), "azure-ai");
      if (normalized.length > 0) {
        return h.buildApiDiscoveryResponse(normalized);
      }
    }

    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) break;
  }

  const fallback = h.buildDiscoveryFallbackResponse({
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
 * Handles Azure OpenAI model discovery.
 */
export async function handleAzureOpenAI(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "azure-openai") {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
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
        headers: {
          "Content-Type": "application/json",
          "api-key": token,
        },
      });
    } catch (error) {
      const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
        cacheWarning: "Azure OpenAI models API unavailable — using cached catalog",
        localWarning: "Azure OpenAI models API unavailable — using local catalog",
      });
      if (fallback) return fallback;
      throw error;
    }

    if (response.ok) {
      return h.buildApiDiscoveryResponse(
        normalizeOpenAiLikeModelsResponse(await response.json(), "azure-openai")
      );
    }

    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) break;
  }

  const fallback = h.buildDiscoveryFallbackResponse({
    cacheWarning: `Azure OpenAI models probe failed (${lastStatus}) — using cached catalog`,
    localWarning: `Azure OpenAI models probe failed (${lastStatus}) — using local catalog`,
  });
  if (fallback) return fallback;
  return NextResponse.json(
    { error: `Failed to fetch models: ${lastStatus || "unknown"}` },
    { status: lastStatus || 502 }
  );
}
