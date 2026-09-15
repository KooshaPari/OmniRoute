import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { getProviderBaseUrl } from "../discovery/helpers";
import { normalizeDataRobotCatalogResponse } from "../discovery/normalizers";
import {
  DATAROBOT_DEFAULT_BASE_URL,
  buildDataRobotCatalogUrl,
  isDataRobotDeploymentUrl,
} from "@omniroute/open-sse/config/datarobot.ts";
import { buildOptionalBearerHeaders } from "../discovery/helpers";
import type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";

/**
 * Handles DataRobot model discovery from the catalog API.
 */
export async function handleDataRobot(
  ctx: HandlerContext,
  h: HandlerHelpers
): Promise<HandlerResult> {
  if (ctx.provider !== "datarobot") {
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

  const configuredBaseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) || DATAROBOT_DEFAULT_BASE_URL;

  if (isDataRobotDeploymentUrl(configuredBaseUrl)) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "Deployment URL does not expose catalog — using cached catalog",
      localWarning: "Deployment URL does not expose catalog — using local catalog",
    });
    if (fallback) return fallback;
    return h.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: h.toLocalCatalogModels(),
      source: "local_catalog",
      warning: "Deployment URL does not expose catalog — using local catalog",
    });
  }

  const catalogUrl = buildDataRobotCatalogUrl(configuredBaseUrl);
  if (!catalogUrl) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: "Invalid DataRobot base URL — using cached catalog",
      localWarning: "Invalid DataRobot base URL — using local catalog",
    });
    if (fallback) return fallback;
    return NextResponse.json({ error: "Invalid DataRobot base URL" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await safeOutboundFetch(catalogUrl, {
      ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
      guard: getProviderOutboundGuard(),
      proxyConfig: ctx.proxy,
      method: "GET",
      headers: buildOptionalBearerHeaders(token),
    });
  } catch (error) {
    const fallback = h.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "DataRobot catalog unavailable — using cached catalog",
      localWarning: "DataRobot catalog unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = h.buildDiscoveryFallbackResponse({
      cacheWarning: `Catalog probe failed (${response.status}) — using cached catalog`,
      localWarning: `Catalog probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  const models = normalizeDataRobotCatalogResponse(await response.json());
  return h.buildApiDiscoveryResponse(
    models.map((model) => ({
      ...model,
      owned_by: "datarobot",
    }))
  );
}
