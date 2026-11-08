import { NextResponse } from "next/server";
import { resolveZedModels } from "@omniroute/open-sse/shared/zedAuth.ts";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import type { ProviderHandlerContext } from "./types";

/**
 * Zed Hosted: two-step auth model discovery requiring LLM token exchange.
 */
export async function handleZedHosted(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "zed-hosted") return null;

  const zedToken = ctx.accessToken || ctx.apiKey;
  if (!zedToken) {
    const fallback = ctx.buildDiscoveryFallbackResponse();
    if (fallback) return fallback;
    return NextResponse.json({ error: "Zed connection has no access token" }, { status: 400 });
  }

  let providerSpecificData: Record<string, unknown> = {};
  const rawPsd = (ctx.connection as { providerSpecificData?: unknown }).providerSpecificData;
  if (typeof rawPsd === "string") {
    try {
      providerSpecificData = JSON.parse(rawPsd) as Record<string, unknown>;
    } catch {
      providerSpecificData = {};
    }
  } else if (rawPsd && typeof rawPsd === "object") {
    providerSpecificData = rawPsd as Record<string, unknown>;
  }

  try {
    const catalog = await resolveZedModels({
      accessToken: zedToken,
      providerSpecificData,
    } as Parameters<typeof resolveZedModels>[0]);
    const zedModels = (catalog?.models ?? []).map((model) => ({
      id: model.id,
      name: model.name,
      context_length: model.contextLength,
      max_output_tokens: model.maxOutputTokens,
      supports_tools: model.supportsTools,
      supports_images: model.supportsImages,
    }));
    return ctx.buildApiDiscoveryResponse(zedModels);
  } catch (error) {
    console.log("Error fetching models from provider", {
      provider: ctx.provider,
      errorText: error instanceof Error ? error.message : String(error),
    });
    const fallback = ctx.buildDiscoveryFallbackResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      { error: `Failed to fetch models: ${sanitizeErrorMessage(error)}` },
      { status: 502 }
    );
  }
}
