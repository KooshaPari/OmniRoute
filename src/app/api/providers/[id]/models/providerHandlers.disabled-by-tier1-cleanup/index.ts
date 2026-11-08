import { NextResponse } from "next/server";
import type { ProviderHandlerContext, ProviderHandler } from "./types";
import { handleSpecialtyProviders, handleMaxAI } from "./specialty";
import { handleBedrock, handleDataRobot, handleWatsonX, handleOCI, handleSAP } from "./enterprise";
import { handleOpenAICompatible } from "./openaiStyle";
import { handleAzureAi, handleAzureOpenAI } from "./azure";
import {
  handleCursor,
  handleInnerAI,
  handleGLM,
  handleAntigravity,
  handleKiro,
  handleCodex,
} from "./coding";
import { handleGitHubCopilot, handleGHECopilot } from "./copilot";
import { handleZedHosted } from "./zed";
import { handleAnthropicCompatible } from "./anthropicStyle";
import { handleVertex } from "./vertex";
import { handleGenericConfig } from "./genericConfig";
import { maybeHandleConolModelDiscovery } from "../conolDiscovery";
import { getAdobeModels } from "../adobeFireflyDiscovery";

/**
 * Provider handler chain — each handler checks if it applies to the current
 * provider and returns a response, or returns null to delegate to the next.
 *
 * Order matters: specialized providers must be checked before generic ones.
 */
const PROVIDER_HANDLERS: ProviderHandler[] = [
  // Simple local-only providers (no remote discovery)
  handleLocalOnlyProviders,

  // Specialty providers with custom discovery
  handleSpecialtyProviders,
  handleMaxAI,

  // Conol (delegates to external module)
  handleConolWrapper,

  // Enterprise providers
  handleBedrock,

  // OpenAI-compatible / Local / Named providers
  handleOpenAICompatible,

  // Cloud providers
  handleDataRobot,
  handleAzureAi,
  handleAzureOpenAI,
  handleWatsonX,
  handleOCI,
  handleSAP,

  // Coding/IDE providers
  handleCursor,
  handleInnerAI,
  handleGLM,
  handleAntigravity,

  // Copilot providers
  handleGitHubCopilot,
  handleGHECopilot,

  // IDE-specific
  handleKiro,

  // Cloud AI platforms
  handleVertex,

  // Anthropic-compatible
  handleAnthropicCompatible,

  // Zed
  handleZedHosted,

  // Codex
  handleCodex,

  // Generic config-based (fallback)
  handleGenericConfig,
];

/**
 * Dispatch to the appropriate provider handler.
 * Returns the first non-null response from the handler chain.
 */
export async function dispatchToProviderHandler(
  ctx: ProviderHandlerContext
): Promise<NextResponse> {
  for (const handler of PROVIDER_HANDLERS) {
    const result = await handler(ctx);
    if (result) return result;
  }

  // Should never reach here if genericConfig is in the chain,
  // but fall back to a 400 error just in case.
  return NextResponse.json(
    { error: `Provider ${ctx.provider} does not support models listing` },
    { status: 400 }
  );
}

// --- Simple inline handlers for local-only providers ---

async function handleLocalOnlyProviders(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  // Reka: local catalog is the intended source
  if (ctx.provider === "reka") {
    const localCatalog = ctx.buildLocalCatalogResponse(undefined, true);
    if (localCatalog) return localCatalog;
    return null;
  }

  // LM Arena: direct-chat allowlist is the intended source
  if (ctx.provider === "lmarena") {
    const localCatalog = ctx.buildLocalCatalogResponse(undefined, true);
    if (localCatalog) return localCatalog;
    return null;
  }

  // Adobe Firefly: custom discovery
  if (ctx.provider === "adobe-firefly") {
    const discovery = await getAdobeModels(
      ctx.apiKey,
      ctx.accessToken,
      ctx.connection.providerSpecificData
    );
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      ...discovery,
    });
  }

  return null;
}

/**
 * Conol wrapper — delegates to the existing conolDiscovery module.
 */
async function handleConolWrapper(ctx: ProviderHandlerContext): Promise<NextResponse | null> {
  return maybeHandleConolModelDiscovery({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    apiKey: ctx.apiKey,
    accessToken: ctx.accessToken,
    providerSpecificData: ctx.connection.providerSpecificData,
    proxy: ctx.proxy,
    maybeReturnCachedDiscovery: ctx.maybeReturnCachedDiscovery,
    maybeReturnAutoFetchDisabled: ctx.maybeReturnAutoFetchDisabled,
    buildDiscoveryFallbackResponse: ctx.buildDiscoveryFallbackResponse,
    buildResponse: ctx.buildResponse,
    buildApiDiscoveryResponse: ctx.buildApiDiscoveryResponse,
  });
}
