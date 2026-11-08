import { NextResponse } from "next/server";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  discoverBedrockNativeModels,
  isBedrockNativeApiError,
} from "@omniroute/open-sse/services/bedrock.ts";
import {
  DATAROBOT_DEFAULT_BASE_URL,
  buildDataRobotCatalogUrl,
  isDataRobotDeploymentUrl,
} from "@omniroute/open-sse/config/datarobot.ts";
import { OCI_DEFAULT_BASE_URL, buildOciModelsUrl } from "@omniroute/open-sse/config/oci.ts";
import {
  SAP_DEFAULT_BASE_URL,
  buildSapModelsUrl,
  getSapResourceGroup,
} from "@omniroute/open-sse/config/sap.ts";
import {
  WATSONX_DEFAULT_BASE_URL,
  buildWatsonxModelsUrl,
} from "@omniroute/open-sse/config/watsonx.ts";
import {
  normalizeDataRobotCatalogResponse,
  normalizeSapModelsResponse,
  normalizeOpenAiLikeModelsResponse,
} from "../discovery/normalizers";
import {
  asRecord,
  toNonEmptyString,
  getProviderBaseUrl,
  buildOptionalBearerHeaders,
} from "../discovery/helpers";
import type { ProviderHandlerContext } from "./types";

/**
 * Bedrock: native model discovery via AWS Bedrock API.
 */
export async function handleBedrock(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "bedrock") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.apiKey || ctx.accessToken;
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
    return ctx.buildApiDiscoveryResponse(models, discovery.warnings[0]);
  } catch (error) {
    const status = isBedrockNativeApiError(error)
      ? error.status
      : getSafeOutboundFetchErrorStatus(error);
    if (status === 401 || status === 403) {
      const fallback = ctx.buildDiscoveryFallbackResponse({
        cacheWarning: `Auth failed (${status}) — using cached catalog`,
        localWarning: `Auth failed (${status}) — using local catalog`,
      });
      if (fallback) return fallback;
      return NextResponse.json({ error: `Auth failed: ${status}` }, { status });
    }
    if (status === 400) {
      return NextResponse.json({ error: "Invalid Bedrock region or models request" }, { status });
    }
    const fallback = ctx.buildDiscoveryFallbackResponse({
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

/**
 * DataRobot: catalog discovery with deployment URL detection.
 */
export async function handleDataRobot(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "datarobot") return null;

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

  const configuredBaseUrl =
    getProviderBaseUrl(ctx.connection.providerSpecificData) || DATAROBOT_DEFAULT_BASE_URL;

  if (isDataRobotDeploymentUrl(configuredBaseUrl)) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "Deployment URL does not expose catalog — using cached catalog",
      localWarning: "Deployment URL does not expose catalog — using local catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: ctx.toLocalCatalogModels(),
      source: "local_catalog",
      warning: "Deployment URL does not expose catalog — using local catalog",
    });
  }

  const catalogUrl = buildDataRobotCatalogUrl(configuredBaseUrl);
  if (!catalogUrl) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
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
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "DataRobot catalog unavailable — using cached catalog",
      localWarning: "DataRobot catalog unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
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
  return ctx.buildApiDiscoveryResponse(
    models.map((model) => ({ ...model, owned_by: "datarobot" }))
  );
}

/**
 * WatsonX: IBM WatsonX model discovery.
 */
export async function handleWatsonX(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "watsonx") return null;

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
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "watsonx models API unavailable — using cached catalog",
      localWarning: "watsonx models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return ctx.buildApiDiscoveryResponse(
    normalizeOpenAiLikeModelsResponse(await response.json(), "watsonx")
  );
}

/**
 * OCI: Oracle Cloud Infrastructure model discovery.
 */
export async function handleOCI(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "oci") return null;

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
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "OCI models API unavailable — using cached catalog",
      localWarning: "OCI models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return ctx.buildApiDiscoveryResponse(
    normalizeOpenAiLikeModelsResponse(await response.json(), "oci")
  );
}

/**
 * SAP: SAP AI Core model discovery.
 */
export async function handleSAP(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "sap") return null;

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
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error, {
      cacheWarning: "SAP models API unavailable — using cached catalog",
      localWarning: "SAP models API unavailable — using local catalog",
    });
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: `Models probe failed (${response.status}) — using cached catalog`,
      localWarning: `Models probe failed (${response.status}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  return ctx.buildApiDiscoveryResponse(normalizeSapModelsResponse(await response.json()));
}
