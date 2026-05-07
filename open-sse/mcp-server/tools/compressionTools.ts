/**
 * OmniRoute MCP Compression Tools — Manage and monitor prompt compression.
 *
 * Tools:
 *   1. omniroute_compression_status   — Get compression config, analytics, and cache stats
 *   2. omniroute_compression_configure — Update compression settings
 */

import { logToolCall } from "../audit.ts";
import {
  getCompressionSettings,
  updateCompressionSettings,
} from "../../../src/lib/db/compression.ts";
import { getCompressionAnalyticsSummary } from "../../../src/lib/db/compressionAnalytics.ts";
import { getCacheStatsSummary } from "../../../src/lib/db/compressionCacheStats.ts";
import type { McpToolExtraLike } from "../scopeEnforcement.ts";

/**
 * Handle compression_status tool: return current compression config, analytics, and cache stats
 */
export async function handleCompressionStatus(
  args: Record<string, never>,
  extra?: McpToolExtraLike
): Promise<{
  enabled: boolean;
  strategy: string;
  settings: {
    maxTokens: number;
    targetRatio: number;
    aggressiveness: string;
  };
  analytics: {
    totalRequests: number;
    compressedRequests: number;
    tokensSaved: number;
    avgCompressionRatio: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: string;
    tokensSaved: number;
  } | null;
}> {
  const start = Date.now();
  try {
    const settings = await getCompressionSettings();
    const analyticsSummary = getCompressionAnalyticsSummary();
    const cacheStats = getCacheStatsSummary();

    const result = {
      enabled: settings.enabled,
      strategy: settings.defaultMode || "standard",
      settings: {
        maxTokens: settings.autoTriggerTokens,
        targetRatio: 0.7, // Default target ratio
        aggressiveness: settings.defaultMode || "standard",
      },
      analytics: {
        totalRequests: analyticsSummary.totalRequests,
        compressedRequests: analyticsSummary.byMode?.standard?.count || 0,
        tokensSaved: analyticsSummary.totalTokensSaved,
        avgCompressionRatio: analyticsSummary.byMode?.standard?.avgSavingsPct || 0,
      },
      cacheStats: cacheStats
        ? {
            hits: Math.round(cacheStats.cacheHitRate * (cacheStats.totalRequests || 1)),
            misses: Math.round((1 - cacheStats.cacheHitRate) * (cacheStats.totalRequests || 1)),
            hitRate: `${(cacheStats.cacheHitRate * 100).toFixed(2)}%`,
            tokensSaved: Math.round(cacheStats.avgNetSavings),
          }
        : null,
    };

    const duration = Date.now() - start;
    await logToolCall("omniroute_compression_status", args, result, duration, true);

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logToolCall(
      "omniroute_compression_status",
      args,
      { error: errorMessage },
      duration,
      false,
      "ERROR"
    );
    throw error;
  }
}

/**
 * Handle compression_configure tool: update compression settings
 */
export async function handleCompressionConfigure(
  args: {
    enabled?: boolean;
    strategy?: string;
    maxTokens?: number;
    targetRatio?: number;
    aggressiveness?: string;
  },
  extra?: McpToolExtraLike
): Promise<{
  success: boolean;
  updated: Record<string, unknown>;
  settings: {
    enabled: boolean;
    strategy: string;
    maxTokens: number;
    targetRatio: number;
    aggressiveness: string;
  };
}> {
  const start = Date.now();
  try {
    const updates: Record<string, unknown> = {};

    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }
    if (args.strategy !== undefined) {
      updates.defaultMode = args.strategy;
    }
    if (args.maxTokens !== undefined) {
      updates.autoTriggerTokens = args.maxTokens;
    }
    if (args.aggressiveness !== undefined) {
      updates.defaultMode = args.aggressiveness;
    }

    const settings = await updateCompressionSettings(updates);

    const result = {
      success: true,
      updated: updates,
      settings: {
        enabled: settings.enabled,
        strategy: settings.defaultMode || "standard",
        maxTokens: settings.autoTriggerTokens,
        targetRatio: 0.7, // Default target ratio
        aggressiveness: settings.defaultMode || "standard",
      },
    };

    const duration = Date.now() - start;
    await logToolCall("omniroute_compression_configure", args, result, duration, true);

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logToolCall(
      "omniroute_compression_configure",
      args,
      { error: errorMessage },
      duration,
      false,
      "ERROR"
    );
    throw error;
  }
}

import { z } from "zod";
import { compressionStatusInput, compressionConfigureInput } from "../schemas/tools.ts";

export const compressionTools = {
  omniroute_compression_status: {
    name: "omniroute_compression_status",
    description:
      "Returns current compression configuration, strategy, analytics summary (requests compressed, tokens saved, avg ratio), and provider-aware cache statistics.",
    inputSchema: compressionStatusInput,
    handler: (args: z.infer<typeof compressionStatusInput>) => handleCompressionStatus(args),
  },
  omniroute_compression_configure: {
    name: "omniroute_compression_configure",
    description:
      "Configure compression settings at runtime. Supports enabling/disabling compression, changing strategy (none/standard/aggressive/ultra), adjusting maxTokens threshold, targetRatio, and aggressiveness level.",
    inputSchema: compressionConfigureInput,
    handler: (args: z.infer<typeof compressionConfigureInput>) => handleCompressionConfigure(args),
  },
};
