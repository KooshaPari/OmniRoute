import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { parseGeminiModelsList } from "@/lib/providerModels/geminiModelsParser";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles Vertex AI and Vertex partner model discovery.
 * Paginates the Generative Language v1beta/models endpoint and optionally
 * fetches Anthropic partner models from Model Garden.
 */
export async function handleVertex(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "vertex" && ctx.provider !== "vertex-partner") {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  // Vertex AI lists models from the Generative Language `v1beta/models` endpoint, which both
  // Express-mode API keys (via ?key=) and Service Account JSON (via a minted OAuth Bearer
  // token) can reach.
  const credential = (ctx.apiKey || "").trim();
  let queryKey: string | null = null;
  let bearerToken: string | null = null;
  try {
    const { parseSAFromApiKey, getAccessToken } =
      await import("@omniroute/open-sse/executors/vertex.ts");
    if (ctx.accessToken) {
      bearerToken = ctx.accessToken;
    } else if (credential) {
      let isServiceAccountJson = false;
      try {
        const parsed = JSON.parse(credential);
        isServiceAccountJson = !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
      } catch {
        isServiceAccountJson = false;
      }

      if (isServiceAccountJson) {
        bearerToken = await getAccessToken(parseSAFromApiKey(credential));
      } else {
        queryKey = credential;
      }
    }
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "Vertex credential unavailable — using cached catalog",
      localWarning: "Vertex credential unavailable — using local catalog",
    });
    if (fallback) return fallback;
  }

  if (!queryKey && !bearerToken) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "No usable Vertex credential — using cached catalog",
      localWarning: "No usable Vertex credential — using local catalog",
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: "No usable Vertex AI credential configured for model discovery." },
      { status: 400 }
    );
  }

  const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;

  const allModels: any[] = [];
  let pageUrl = queryKey ? `${baseUrl}&key=${encodeURIComponent(queryKey)}` : baseUrl;
  let pageCount = 0;
  const MAX_PAGES = 20;
  const seenTokens = new Set<string>();

  try {
    while (pageUrl && pageCount < MAX_PAGES) {
      pageCount++;
      const response = await safeOutboundFetch(pageUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsPagination,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers,
      });

      if (!response.ok) {
        console.log("[models] Vertex model discovery failed", {
          provider: ctx.provider,
          status: response.status,
        });
        const fallback = h.buildDiscoveryFallbackResponse();
        if (fallback) return fallback;
        return NextResponse.json(
          { error: `Failed to fetch Vertex models: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      allModels.push(...parseGeminiModelsList(data));

      const nextPageToken = data.nextPageToken;
      if (!nextPageToken || seenTokens.has(nextPageToken)) break;
      seenTokens.add(nextPageToken);
      pageUrl = `${baseUrl}&pageToken=${encodeURIComponent(nextPageToken)}`;
      if (queryKey) pageUrl += `&key=${encodeURIComponent(queryKey)}`;
    }
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error);
    if (fallback) return fallback;
    throw error;
  }

  // Anthropic partner models via Model Garden publisher endpoint (Bearer only).
  if (bearerToken) {
    const anthropicModelsUrl =
      "https://aiplatform.googleapis.com/v1beta1/publishers/anthropic/models";

    try {
      const anthropicResponse = await safeOutboundFetch(anthropicModelsUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
      });
      if (anthropicResponse.ok) {
        const anthropicData = await anthropicResponse.json();
        const { parseVertexAnthropicModels } =
          await import("@/lib/providerModels/vertexAnthropicModelsParser");
        allModels.push(...parseVertexAnthropicModels(anthropicData));
      } else {
        console.log("[models] Vertex Anthropic partner discovery failed", {
          provider: ctx.provider,
          status: anthropicResponse.status,
        });
      }
    } catch (err) {
      console.log("[models] Vertex Anthropic partner discovery error", {
        provider: ctx.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (allModels.length > 0) {
    return h.buildApiDiscoveryResponse(allModels);
  }

  const fallback = h.buildDiscoveryFallbackResponse();
  if (fallback) return fallback;
  return h.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: [],
    source: "api",
  });
}
