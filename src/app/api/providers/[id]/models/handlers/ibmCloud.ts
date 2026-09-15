import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  getProviderBaseUrl,
  asRecord,
  toNonEmptyString,
  buildOptionalBearerHeaders,
} from "../discovery/helpers";
import { normalizeOpenAiLikeModelsResponse, normalizeSapModelsResponse } from "../discovery/normalizers";
import {
  WATSONX_DEFAULT_BASE_URL,
  buildWatsonxModelsUrl,
} from "@omniroute/open-sse/config/watsonx.ts";
import { OCI_DEFAULT_BASE_URL, buildOciModelsUrl } from "@omniroute/open-sse/config/oci.ts";
import {
  SAP_DEFAULT_BASE_URL,
  buildSapModelsUrl,
  getSapResourceGroup,
} from "@omniroute/open-sse/config/sap.ts";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles watsonx model discovery.
 */
export async function handleWatsonx(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "watsonx") return null;

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

  const baseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) || WATSONX_DEFAULT_BASE_URL;

  let response: Response;
  try {
    response = await safeOutboundFetch(buildWatsonxModelsUrl(baseUrl), {
      ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
      guard: getProviderOutboundGuard(),
      proxyConfig: ctx.proxy,
      method: "GET",
      headers: buildOptionalBearerHeaders(token),
    });
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "watsonx models API unavailable — using cached catalog",
      localWarning: "watsonx models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return h.buildApiDiscoveryResponse(
    normalizeOpenAiLikeModelsResponse(await response.json(), "watsonx")
  );
}

/**
 * Handles OCI model discovery.
 */
export async function handleOci(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "oci") return null;

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

  const psd = asRecord(ctx.connection.providerSpecificData);
  const baseUrl = getProviderBaseUrl(psd) || OCI_DEFAULT_BASE_URL;
  const projectId =
    ctx.connection.projectId || toNonEmptyString(psd.projectId) || toNonEmptyString(psd.project);

  let response: Response;
  try {
    response = await safeOutboundFetch(buildOciModelsUrl(baseUrl), {
      ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
      guard: getProviderOutboundGuard(),
      proxyConfig: ctx.proxy,
      method: "GET",
      headers: {
        ...buildOptionalBearerHeaders(token),
        ...(projectId ? { "OpenAI-Project": projectId } : {}),
      },
    });
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "OCI models API unavailable — using cached catalog",
      localWarning: "OCI models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return h.buildApiDiscoveryResponse(
    normalizeOpenAiLikeModelsResponse(await response.json(), "oci")
  );
}

/**
 * Handles SAP model discovery.
 */
export async function handleSap(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "sap") return null;

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

  const psd = asRecord(ctx.connection.providerSpecificData);
  const baseUrl = getProviderBaseUrl(psd) || SAP_DEFAULT_BASE_URL;
  const resourceGroup = getSapResourceGroup(psd);

  let response: Response;
  try {
    response = await safeOutboundFetch(buildSapModelsUrl(baseUrl), {
      ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
      guard: getProviderOutboundGuard(),
      proxyConfig: ctx.proxy,
      method: "GET",
      headers: {
        ...buildOptionalBearerHeaders(token),
        "AI-Resource-Group": resourceGroup,
      },
    });
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "SAP models API unavailable — using cached catalog",
      localWarning: "SAP models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return h.buildApiDiscoveryResponse(normalizeSapModelsResponse(await response.json()));
}
