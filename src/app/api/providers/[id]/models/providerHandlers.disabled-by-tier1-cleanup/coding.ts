import { NextResponse } from "next/server";
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  buildGlmCodingHeaders,
  buildGlmModelsUrl,
} from "@omniroute/open-sse/config/glmProvider.ts";
import { fetchKiroAvailableModels } from "@omniroute/open-sse/services/kiroModels.ts";
import { fetchCursorAgentModels } from "@/lib/providerModels/cursorAgent";
import { fetchCursorAvailableModels } from "@/lib/providerModels/cursorAvailableModels";
import { ensureCursorAutoCatalogEntry } from "@/lib/providerModels/cursorAutoCatalog";
import { fetchAntigravityDiscoveryModelsCached } from "../discovery/normalizers";
import {
  buildCodexDiscoveryCatalog,
  enrichCodexModelsFromGithubCatalog,
  fetchCodexDiscoveryModels,
  fetchCodexGithubCatalogModels,
} from "../discovery/codex";
import {
  asRecord,
  getProviderBaseUrl,
  mergeLocalCatalogModels,
  buildOptionalBearerHeaders,
} from "../discovery/helpers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { getStaticModelsForProvider } from "@/lib/providers/staticModels";
import { persistDiscoveredModels } from "@/lib/providerModels/modelDiscovery";
import type { ProviderHandlerContext } from "./types";

/**
 * Cursor: OAuth-based model discovery with machine ID support.
 */
export async function handleCursor(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "cursor") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const warnings: string[] = [];
  const token = (ctx.accessToken || ctx.apiKey || "").trim();
  const machineId =
    typeof ctx.connection?.providerSpecificData === "object" &&
    ctx.connection.providerSpecificData &&
    typeof (ctx.connection.providerSpecificData as { machineId?: unknown }).machineId === "string"
      ? (ctx.connection.providerSpecificData as { machineId: string }).machineId
      : null;

  if (token) {
    try {
      const models = await fetchCursorAvailableModels({ accessToken: token, machineId });
      return ctx.buildApiDiscoveryResponse(models);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log("[models] Cursor AvailableModels failed:", message);
      warnings.push(`AvailableModels unavailable (${message})`);
    }
  } else {
    warnings.push("no Cursor access token on connection");
  }

  try {
    const models = ensureCursorAutoCatalogEntry(await fetchCursorAgentModels());
    return ctx.buildApiDiscoveryResponse(models);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("[models] cursor-agent fetch failed:", message);
    const detail = [...warnings, `cursor-agent unavailable (${message})`].join("; ");
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: `${detail} — using cached catalog`,
      localWarning: `${detail} — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch Cursor models: ${detail}` },
      { status: 502 }
    );
  }
}

/**
 * Inner.ai: custom JWT-based model discovery with device ID parsing.
 */
export async function handleInnerAI(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "inner-ai") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  try {
    // Parse "TOKEN EMAIL" credential format
    const raw = ctx.apiKey.trim();
    const eqIdx = raw.indexOf("=");
    const stripped = eqIdx > 0 && !raw.startsWith("eyJ") ? raw.slice(eqIdx + 1).trim() : raw;
    const lastSpace = stripped.lastIndexOf(" ");
    let innerAiToken = stripped;
    let innerAiEmail = "";
    if (lastSpace > 0) {
      const possibleEmail = stripped.slice(lastSpace + 1).trim();
      if (possibleEmail.includes("@")) {
        innerAiToken = stripped.slice(0, lastSpace).trim();
        innerAiEmail = possibleEmail;
      }
    }

    // Decode device_id from JWT payload
    let innerAiDeviceId = "";
    try {
      const parts = innerAiToken.split(".");
      if (parts.length >= 2) {
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
        innerAiDeviceId = String(
          payload?.device_id ?? payload?.deviceId ?? payload?.["device-id"] ?? payload?.did ?? ""
        ).trim();
      }
    } catch {
      /* ignore */
    }

    const innerAiHeaders: Record<string, string> = {
      "USER-TOKEN": innerAiToken,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      Origin: "https://app.innerai.com",
      Referer: "https://app.innerai.com/",
    };
    if (innerAiEmail) innerAiHeaders["USER-EMAIL"] = innerAiEmail;
    if (innerAiDeviceId) innerAiHeaders["DEVICE-ID"] = innerAiDeviceId;

    const modelsResp = await safeOutboundFetch(
      "https://platformapi.innerai.com/api/v1/ai_models",
      { headers: innerAiHeaders },
      getProviderOutboundGuard(ctx.provider)
    );
    if (!modelsResp.ok) {
      throw new Error(`Inner.ai models API returned HTTP ${modelsResp.status}`);
    }

    const modelsBody = await modelsResp.json().catch(() => null);
    const rawModels: Array<Record<string, unknown>> = Array.isArray(modelsBody?.ai_models)
      ? modelsBody.ai_models
      : Array.isArray(modelsBody)
        ? modelsBody
        : [];

    // Filter: enabled, available, text/chat category only.
    const nonTextPattern =
      /image|video|audio|img|vid|sound|music|voice|tts|stt|track|clip|avatar|cartoon|flux|stable.diff|recraft|ideogram|leonardo|magnific|bria|seedream|luma|kling|pika|veo|wan-|heygen|did-|vidu|pixverse|sora-|gen-[0-9]|playground|gemini-fal|gamma|lyria|clothes|whisper/i;
    const textModels = rawModels.filter((m) => {
      if (m.enable === false || m.unavailable_api) return false;
      if (typeof m.llm_model !== "string") return false;
      const cats = Array.isArray(m.ai_model_categories) ? m.ai_model_categories : null;
      if (cats && cats.length > 0) {
        return cats.some(
          (c: Record<string, unknown>) =>
            String(c.unique_identifier ?? c.name ?? "").toLowerCase() === "text"
        );
      }
      return !nonTextPattern.test(m.llm_model as string);
    });

    const models = textModels.map((m) => ({
      id: String(m.llm_model),
      name: String(m.name || m.llm_model),
    }));

    return ctx.buildApiDiscoveryResponse(models);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: `Inner.ai models unavailable (${message}) — using cached catalog`,
      localWarning: `Inner.ai models unavailable (${message}) — using local catalog`,
    });
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch Inner.ai models: ${message}` },
      { status: 502 }
    );
  }
}

/**
 * GLM / GLM-CN / GLMT: dual-transport (OpenAI + Anthropic) model discovery.
 */
export async function handleGLM(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "glm" && ctx.provider !== "glm-cn" && ctx.provider !== "glmt") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = ctx.apiKey || ctx.accessToken;
  const glmProviderSpecificData = {
    ...asRecord(ctx.connection.providerSpecificData),
    ...(ctx.provider === "glm-cn" ? { apiRegion: "china" } : {}),
  };
  const discoveredTargets = [
    { transport: "openai" as const, url: buildGlmModelsUrl(glmProviderSpecificData, "openai") },
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
    const fallback = ctx.buildDiscoveryErrorFallbackResponse(error);
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
    const fallback = ctx.buildDiscoveryFallbackResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${response?.status || 502}` },
      { status: response?.status || 502 }
    );
  }

  const data = await response.json();
  const models = data.data || data.models || [];
  return ctx.buildApiDiscoveryResponse(models);
}

/**
 * Antigravity / Agy: OAuth-based discovery with static model fallback.
 */
export async function handleAntigravity(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "antigravity" && ctx.provider !== "agy") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const staticModels = getStaticModelsForProvider(ctx.provider) || [];

  if (!ctx.accessToken) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "OAuth token unavailable — using cached catalog",
      localWarning: "OAuth token unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: staticModels,
      source: "local_catalog",
      warning: "OAuth token unavailable — using local catalog",
    });
  }

  const remoteModels = await fetchAntigravityDiscoveryModelsCached(
    ctx.accessToken,
    ctx.connectionId,
    ctx.proxy,
    ctx.connection.providerSpecificData,
    ctx.provider
  );
  if (remoteModels.length > 0) {
    return ctx.buildApiDiscoveryResponse(remoteModels);
  }

  const fallback = ctx.buildDiscoveryFallbackResponse();
  if (fallback) return fallback;

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: staticModels,
    source: "local_catalog",
    ...(ctx.usesCuratedModelsOnly ? {} : { warning: "API unavailable — using local catalog" }),
  });
}

/**
 * Kiro: AWS CodeWhisperer-based model discovery.
 */
export async function handleKiro(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "kiro") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  if (!ctx.accessToken) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "OAuth token unavailable — using cached catalog",
      localWarning: "OAuth token unavailable — using local catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: ctx.toLocalCatalogModels(),
      source: "local_catalog",
      warning: "OAuth token unavailable — using local catalog",
    });
  }

  const discovery = await fetchKiroAvailableModels({
    accessToken: ctx.accessToken,
    providerSpecificData: ctx.connection.providerSpecificData,
    fetchImpl: (url, init) =>
      safeOutboundFetch(url as string, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        ...(init as Record<string, unknown>),
      }),
    fallbackModels: ctx.toLocalCatalogModels(),
  });

  if (discovery.source === "api" && discovery.models.length > 0) {
    return ctx.buildApiDiscoveryResponse(discovery.models);
  }

  const fallback = ctx.buildDiscoveryFallbackResponse({
    cacheWarning: "Kiro models API unavailable — using cached catalog",
    localWarning: "Kiro models API unavailable — using local catalog",
  });
  if (fallback) return fallback;
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: discovery.models,
    source: "local_catalog",
    warning: "Kiro models API unavailable — using local catalog",
  });
}

/**
 * Codex: multi-source discovery (live + GitHub catalog + local).
 */
export async function handleCodex(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "codex") return null;

  const config = ctx.provider in {} ? undefined : undefined; // Codex doesn't use PROVIDER_MODELS_CONFIG
  const staticCodexCatalog = mergeLocalCatalogModels(
    getModelsByProviderId("codex") || [],
    getStaticModelsForProvider("codex") || []
  );
  const finalizeCodexCatalog = (remoteModels: typeof ctx.cachedDiscoveryModels) =>
    buildCodexDiscoveryCatalog(remoteModels, staticCodexCatalog);
  const cachedCatalogModels = finalizeCodexCatalog(ctx.cachedDiscoveryModels);
  const cachedIdsMatchFinalCatalog =
    ctx.cachedDiscoveryModels.length === cachedCatalogModels.length &&
    ctx.cachedDiscoveryModels.every((model, index) => model.id === cachedCatalogModels[index]?.id);
  const persistFilteredCacheIfNeeded = async () => {
    if (cachedIdsMatchFinalCatalog) return;
    await persistDiscoveredModels(ctx.provider, ctx.connectionId, cachedCatalogModels);
  };

  if (!ctx.refresh && ctx.cachedDiscoveryModels.length > 0) {
    await persistFilteredCacheIfNeeded();
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: cachedCatalogModels,
      source: "cache",
    });
  }

  if (!ctx.refresh && !ctx.autoFetchModels) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: finalizeCodexCatalog([]),
      source: "local_catalog",
      warning: "Auto-fetch disabled — using local catalog",
    });
  }

  const liveModels = await fetchCodexDiscoveryModels({
    accessToken: ctx.accessToken || null,
    providerSpecificData: ctx.connection.providerSpecificData,
    fetchImpl: (url, init) =>
      safeOutboundFetch(url, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: getProviderOutboundGuard(),
        proxyConfig: ctx.proxy,
        ...init,
      }),
  });
  const githubCatalogModels = await fetchCodexGithubCatalogModels({
    fetchImpl: (url, init) =>
      safeOutboundFetch(url, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
        guard: "public-only",
        proxyConfig: ctx.proxy,
        ...init,
      }),
  });

  if (liveModels && liveModels.length > 0) {
    const enrichedLiveModels =
      githubCatalogModels && githubCatalogModels.length > 0
        ? enrichCodexModelsFromGithubCatalog(liveModels, githubCatalogModels)
        : liveModels;
    return ctx.buildApiDiscoveryResponse(finalizeCodexCatalog(enrichedLiveModels));
  }

  if (githubCatalogModels && githubCatalogModels.length > 0) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: finalizeCodexCatalog(githubCatalogModels),
      source: "github_catalog",
      warning: "Codex live catalog unavailable — using GitHub model catalog",
    });
  }

  if (ctx.cachedDiscoveryModels.length > 0) {
    await persistFilteredCacheIfNeeded();
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: cachedCatalogModels,
      source: "cache",
      warning: "Codex live catalog unavailable — using cached catalog",
    });
  }
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: finalizeCodexCatalog([]),
    source: "local_catalog",
    intentional: true,
    warning: "Codex live and GitHub catalogs unavailable — using local catalog",
  });
}
