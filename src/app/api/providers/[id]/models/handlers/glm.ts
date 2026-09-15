import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { asRecord } from "../discovery/helpers";
import {
  buildGlmCodingHeaders,
  buildGlmModelsUrl,
} from "@omniroute/open-sse/config/glmProvider.ts";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles GLM (Zhipu) model discovery across openai and anthropic transports.
 */
export async function handleGlm(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "glm" && ctx.provider !== "glm-cn" && ctx.provider !== "glmt") {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.apiKey || ctx.accessToken;
  const glmProviderSpecificData = {
    ...asRecord(ctx.connection.providerSpecificData),
    ...(ctx.provider === "glm-cn" ? { apiRegion: "china" } : {}),
  };
  const discoveredTargets = [
    {
      transport: "openai" as const,
      url: buildGlmModelsUrl(glmProviderSpecificData, "openai"),
    },
    {
      transport: "anthropic" as const,
      url: buildGlmModelsUrl(glmProviderSpecificData, "anthropic"),
    },
  ];
  const discoveryTargets = discoveredTargets.filter(
    (target, index, all) => all.findIndex((other) => other.url === target.url) === index
  );

  let response: Response | null = null;
  try {
    for (const target of discoveryTargets) {
      response = await safeOutboundFetch(target.url, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        method: "GET",
        headers:
          target.transport === "openai"
            ? token
              ? buildGlmCodingHeaders(token, false)
              : { "Content-Type": "application/json", Accept: "application/json" }
            : {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(token ? { "x-api-key": token } : {}),
                "anthropic-version": "2023-06-01",
              },
      });
      if (response.ok) break;
      if (response.status === 401 || response.status === 403) break;
    }
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error);
    if (fallback) return fallback;
    throw error;
  }

  if (!response?.ok) {
    if (response?.status === 401 || response?.status === 403) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${response.status}` },
        { status: response.status }
      );
    }
    const fallback = h.buildDiscoveryFallbackResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response?.status || 502}` },
      { status: response?.status || 502 }
    );
  }

  const data = await response.json();
  const models = data.data || data.models || [];

  return h.buildApiDiscoveryResponse(models);
}
