import { NextResponse } from "next/server";
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  isClaudeCodeCompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";
import {
  asRecord,
  toNonEmptyString,
  getProviderBaseUrl,
  buildOptionalBearerHeaders,
} from "../discovery/helpers";
import type { ProviderHandlerContext } from "./types";

/**
 * Anthropic-compatible providers: /models endpoint with Anthropic headers.
 */
export async function handleAnthropicCompatible(
  ctx: ProviderHandlerContext
): Promise<NextResponse | null> {
  if (!isAnthropicCompatibleProvider(ctx.provider)) return null;

  // CC providers never support models listing
  if (isClaudeCodeCompatibleProvider(ctx.provider)) {
    return NextResponse.json(
      { error: `Provider ${ctx.provider} does not support models listing` },
      { status: 400 }
    );
  }

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  let baseUrl = getProviderBaseUrl(ctx.connection.providerSpecificData);
  if (!baseUrl) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "Base URL unavailable — using cached catalog",
      localWarning: "Base URL unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: "No base URL configured for Anthropic compatible provider" },
      { status: 400 }
    );
  }

  baseUrl = baseUrl.replace(/\/$/, "");
  if (baseUrl.endsWith("/messages")) {
    baseUrl = baseUrl.slice(0, -9);
  }

  const psd = asRecord(ctx.connection.providerSpecificData);
  const modelsPath = toNonEmptyString(psd.modelsPath) || "/models";
  const url = `${baseUrl}${modelsPath}`;
  const token = ctx.accessToken || ctx.apiKey;

  let response: Response;
  try {
    response = await safeOutboundFetch(url, {
      ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
      guard: getProviderOutboundGuard(),
      proxyConfig: ctx.proxy,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
        "anthropic-version": "2023-06-01",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error);
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.log("Error fetching models from provider", {
      provider: ctx.provider,
      errorText,
    });
    const fallback = ctx.buildDiscoveryFallbackResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const models = data.data || data.models || [];
  return ctx.buildApiDiscoveryResponse(models);
}
