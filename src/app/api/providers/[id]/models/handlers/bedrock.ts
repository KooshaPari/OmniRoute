import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
  getSafeOutboundFetchErrorStatus,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  discoverBedrockNativeModels,
  isBedrockNativeApiError,
} from "@omniroute/open-sse/services/bedrock.ts";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles AWS Bedrock native model discovery.
 */
export async function handleBedrock(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "bedrock") {
    return null;
  }

  const cachedResponse = h.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = h.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.apiKey || ctx.accessToken;
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

  try {
    const discovery = await discoverBedrockNativeModels({
      apiKey: token,
      providerSpecificData: ctx.connection.providerSpecificData,
      fetcher: (url, init) =>
        safeOutboundFetch(url, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
          guard: getProviderOutboundGuard(),
          proxyConfig: ctx.proxy,
          ...init,
        }),
    });
    const models = discovery.models.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      owned_by: model.provider || "bedrock",
      source: model.source,
      ...(model.supportsStreaming !== undefined
        ? { supportsStreaming: model.supportsStreaming }
        : {}),
      ...(model.supportsVision !== undefined ? { supportsVision: model.supportsVision } : {}),
      ...(typeof model.inputTokenLimit === "number"
        ? { inputTokenLimit: model.inputTokenLimit }
        : {}),
      ...(typeof model.outputTokenLimit === "number"
        ? { outputTokenLimit: model.outputTokenLimit }
        : {}),
    }));
    return h.buildApiDiscoveryResponse(models, discovery.warnings[0]);
  } catch (error) {
    const status = isBedrockNativeApiError(error)
      ? error.status
      : getSafeOutboundFetchErrorStatus(error);
    if (status === 401 || status === 403) {
      const fallback = h.buildDiscoveryFallbackResponse({
        cacheWarning: `Auth failed (${status}) — using cached catalog`,
        localWarning: `Auth failed (${status}) — using local catalog`,
      });
      if (fallback) return fallback;
      return NextResponse.json({ error: `Auth failed: ${status}` }, { status });
    }
    if (status === 400) {
      return NextResponse.json(
        { error: "Invalid Bedrock region or models request" },
        { status }
      );
    }
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "Bedrock models API unavailable — using cached catalog",
      localWarning: "Bedrock models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    if (status) {
      return NextResponse.json({ error: `Bedrock models API failed: ${status}` }, { status });
    }
    throw error;
  }
}
