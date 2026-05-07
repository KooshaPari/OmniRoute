import type { CompressionConfig, CompressionMode, CompressionResult } from "./types.ts";
import { applyLiteCompression } from "./lite.ts";
import { cavemanCompress } from "./caveman.ts";
import { compressAggressive } from "./aggressive.ts";
import { ultraCompress } from "./ultra.ts";
import { createCompressionStats } from "./stats.ts";
import {
  detectCachingContext,
  getCacheAwareStrategy,
  type CachingDetectionContext,
} from "./cachingAware.ts";

export function checkComboOverride(
  config: CompressionConfig,
  comboId: string | null
): CompressionMode | null {
  if (!comboId || !config.comboOverrides) return null;
  return config.comboOverrides[comboId] ?? null;
}

export function shouldAutoTrigger(config: CompressionConfig, estimatedTokens: number): boolean {
  return config.autoTriggerTokens > 0 && estimatedTokens >= config.autoTriggerTokens;
}

export function getEffectiveMode(
  config: CompressionConfig,
  comboId: string | null,
  estimatedTokens: number
): CompressionMode {
  if (!config.enabled) return "off";

  const comboMode = checkComboOverride(config, comboId);
  if (comboMode) return comboMode;

  if (shouldAutoTrigger(config, estimatedTokens)) return "lite";

  return config.defaultMode;
}

export function selectCompressionStrategy(
  config: CompressionConfig,
  comboId: string | null,
  estimatedTokens: number,
  body?: Record<string, unknown>,
  context?: CachingDetectionContext
): CompressionMode {
  const selectedMode = getEffectiveMode(config, comboId, estimatedTokens);

  // Apply caching-aware adjustments if body is provided
  if (body) {
    const ctx = detectCachingContext(body, context);
    const cacheAware = getCacheAwareStrategy(selectedMode, ctx);
    return cacheAware.strategy as CompressionMode;
  }

  return selectedMode;
}

export function applyCompression(
  body: Record<string, unknown>,
  mode: CompressionMode,
  options?: { model?: string; supportsVision?: boolean | null; config?: CompressionConfig }
): CompressionResult {
  if (mode === "off") {
    return { body, compressed: false, stats: null };
  }
  if (mode === "lite") {
    return applyLiteCompression(body, options);
  }
  if (mode === "standard") {
    return cavemanCompress(
      body as Parameters<typeof cavemanCompress>[0],
      options?.config?.cavemanConfig
    );
  }
  if (mode === "aggressive") {
    const messages = (body.messages ?? []) as Array<{
      role: string;
      content?: string | Array<{ type: string; text?: string }>;
      [key: string]: unknown;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { body, compressed: false, stats: null };
    }
    const aggressiveConfig = options?.config?.aggressive;
    const result = compressAggressive(messages, aggressiveConfig);
    const compressedBody = { ...body, messages: result.messages };
    return {
      body: compressedBody,
      compressed: result.stats.savingsPercent > 0,
      stats: createCompressionStats(
        body,
        compressedBody,
        mode,
        ["aggressive"],
        result.stats.rulesApplied,
        result.stats.durationMs
      ),
    };
  }
  if (mode === "ultra") {
    const messages = (body.messages ?? []) as Array<{
      role: string;
      content?: string | unknown[];
      [key: string]: unknown;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { body, compressed: false, stats: null };
    }
    const ultraConfig = options?.config?.ultra;
    const result = ultraCompress(messages, ultraConfig ?? {});
    const compressedBody = { ...body, messages: result.messages };
    return {
      body: compressedBody,
      compressed: result.stats.savingsPercent > 0,
      stats: createCompressionStats(
        body,
        compressedBody,
        mode,
        ["ultra"],
        result.stats.rulesApplied,
        result.stats.durationMs
      ),
    };
  }
  return { body, compressed: false, stats: null };
}
