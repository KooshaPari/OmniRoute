import { NextResponse } from "next/server";
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuardPolicy";
import {
  discoverPromptQlModels,
  PROMPTQL_FALLBACK_MODELS,
} from "@omniroute/open-sse/services/promptqlModels.ts";
import {
  discoverNotionWebModels,
  NOTION_WEB_FALLBACK_MODELS,
} from "@omniroute/open-sse/services/notionWebModels.ts";
import {
  discoverMaxaiModels,
  MAXAI_REGISTRY_MODELS,
} from "@omniroute/open-sse/services/maxaiModels.ts";
import type { ProviderHandlerContext } from "./types";

/**
 * PromptQL: live catalog via GraphQL FetchLlmConfigs (Bearer JWT).
 */
export async function handlePromptQL(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "promptql" && ctx.provider !== "pql") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  const token = (ctx.apiKey || ctx.accessToken || "").replace(/^Bearer\s+/i, "").trim();
  const seedModels = PROMPTQL_FALLBACK_MODELS.map((m) => ({ id: m.id, name: m.name }));
  if (!token) {
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "No JWT configured — using cached catalog",
      localWarning: "No JWT configured — using local catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: seedModels,
      source: "local_catalog",
      intentional: true,
      warning: "No PromptQL Bearer JWT — using seed model list",
    });
  }

  try {
    const graphqlEndpoint =
      (typeof ctx.connection.providerSpecificData?.graphqlEndpoint === "string" &&
        ctx.connection.providerSpecificData.graphqlEndpoint) ||
      process.env.PROMPTQL_GRAPHQL_ENDPOINT ||
      "https://data.prompt.ql.app/promptql/playground-v2-hge/v1/graphql";
    const discovered = await discoverPromptQlModels({ token, graphqlEndpoint });
    const models = discovered.map((m) => ({ id: m.id, name: m.name }));
    return ctx.buildApiDiscoveryResponse(models);
  } catch (error) {
    console.log("Error fetching models from promptql", {
      error: error instanceof Error ? error.message : String(error),
    });
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "PromptQL FetchLlmConfigs failed — using cached catalog",
      localWarning: "PromptQL FetchLlmConfigs failed — using seed catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: seedModels,
      source: "local_catalog",
      intentional: true,
      warning: "API unavailable — using seed PromptQL model list",
    });
  }
}

/**
 * Notion Web: live catalog via cookie-auth getAvailableModels.
 */
export async function handleNotionWeb(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "notion-web") return null;

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
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: NOTION_WEB_FALLBACK_MODELS,
      source: "local_catalog",
      intentional: true,
      warning: "No token_v2 cookie — using seed Notion AI model list",
    });
  }

  try {
    const discovery = await discoverNotionWebModels({
      token,
      fetchImpl: (url, init) =>
        safeOutboundFetch(url, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
          guard: getProviderOutboundGuard(),
          proxyConfig: ctx.proxy,
          ...init,
        }),
    });
    return ctx.buildApiDiscoveryResponse(discovery.models, discovery.warning);
  } catch (error) {
    console.log("Error fetching models from notion-web", {
      error: error instanceof Error ? error.message : String(error),
    });
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "Notion getAvailableModels failed — using cached catalog",
      localWarning: "Notion getAvailableModels failed — using seed catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: NOTION_WEB_FALLBACK_MODELS,
      source: "local_catalog",
      intentional: true,
      warning: "API unavailable — using seed Notion AI model list",
    });
  }
}

/**
 * MaxAI: live catalog + per-model context windows from the signed
 * /models/get_config.
 */
export async function handleMaxAI(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "maxai") return null;

  const cachedResponse = ctx.maybeReturnCachedDiscovery();
  if (cachedResponse) return cachedResponse;

  const autoFetchDisabledResponse = ctx.maybeReturnAutoFetchDisabled();
  if (autoFetchDisabledResponse) return autoFetchDisabledResponse;

  try {
    const discovery = await discoverMaxaiModels({
      providerSpecificData: ctx.connection.providerSpecificData as
        | Record<string, unknown>
        | null
        | undefined,
      accessToken: ctx.apiKey || ctx.accessToken,
      fetchImpl: (url, init) =>
        safeOutboundFetch(url, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.modelsDiscovery,
          guard: getProviderOutboundGuard(),
          proxyConfig: ctx.proxy,
          ...init,
        }),
    });
    return ctx.buildApiDiscoveryResponse(discovery.models, discovery.warning);
  } catch (error) {
    console.log("Error fetching models from maxai", {
      error: error instanceof Error ? error.message : String(error),
    });
    const fallback = ctx.buildDiscoveryFallbackResponse({
      cacheWarning: "MaxAI models/get_config failed — using cached catalog",
      localWarning: "MaxAI models/get_config failed — using curated catalog",
    });
    if (fallback) return fallback;
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: MAXAI_REGISTRY_MODELS,
      source: "local_catalog",
      intentional: true,
      warning: "MaxAI catalog unavailable — using curated model list",
    });
  }
}
