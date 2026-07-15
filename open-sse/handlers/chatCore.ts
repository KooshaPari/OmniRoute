<<<<<<< Updated upstream
import { injectMemoryAndSkills } from "./chatCore/memorySkillsInjection.ts";
import { resolveChatCoreRequestSetup } from "./chatCore/requestSetup.ts";
import { buildFailureUsageRecord } from "./chatCore/failureUsage.ts";
import { extractSystemRoleMessages } from "./chatCore/claudeSystemRole.ts";
export { extractSystemRoleMessages } from "./chatCore/claudeSystemRole.ts";
import { checkIdempotencyCache } from "./chatCore/idempotency.ts";
import { checkSemanticCache } from "./chatCore/semanticCache.ts";
import { applyClientUsageBuffer } from "./chatCore/clientUsageBuffer.ts";
import { buildPostCallGuardrailContext } from "./chatCore/postCallGuardrailContext.ts";
import { storeSemanticCacheResponse } from "./chatCore/semanticCacheStore.ts";
import { buildNonStreamingResponseHeaders } from "./chatCore/nonStreamingResponseHeaders.ts";
import { buildNonStreamingJsonResponse } from "./chatCore/nonStreamingJsonResponse.ts";
import { maybeConvertJsonBodyToSse } from "./chatCore/jsonBodyToSse.ts";
import { assembleStreamingResponseHeaders } from "./chatCore/streamingResponseHeaders.ts";
import { storeStreamingSemanticCacheResponse } from "./chatCore/streamingSemanticCacheStore.ts";
import { assembleStreamingPipeline } from "./chatCore/streamingPipeline.ts";
import { sanitizeChatRequestBody } from "./chatCore/sanitization.ts";
import {
  getHeaderValueCaseInsensitive,
  isNoMemoryRequested,
  resolveCompressionHeader,
  isStripReasoningRequested,
} from "./chatCore/headers.ts";
import { markCodexScopeRateLimited } from "./chatCore/codexFailover.ts";
import { trackDevice, extractIpFromHeaders } from "../services/deviceTracker.ts";
import { getCombosCached } from "./chatCore/comboContextCache.ts";
export { clearCombosCache, clearUpstreamProxyConfigCache } from "./chatCore/comboContextCache.ts";
import {
  resolveAccountSemaphoreKey,
  resolveAccountSemaphoreMaxConcurrency,
  buildClaudePromptCacheLogMeta,
} from "./chatCore/executorHelpers.ts";
import {
  shouldUseNativeCodexPassthrough,
  redactPassthroughThinkingSignatures,
  isClaudeCodeSemanticPassthroughRequest,
} from "./chatCore/passthroughHelpers.ts";
import {
  buildStreamingResponseHeaders,
  materializeDeduplicatedExecutionResult,
  stripNextMiddlewareControlHeaders,
  stripStaleForwardingHeaders,
} from "./chatCore/responseHeaders.ts";
import {
  forwardDashboardEventToLiveWs,
  maybeSyncClaudeExtraUsageState,
} from "./chatCore/telemetryHelpers.ts";
// Re-export the previously inline-defined helpers so existing importers of these
// symbols from chatCore.ts (tests, sibling modules) keep resolving after the split.
export {
  shouldUseNativeCodexPassthrough,
  redactPassthroughThinkingSignatures,
  isClaudeCodeSemanticPassthroughRequest,
  buildStreamingResponseHeaders,
  stripStaleForwardingHeaders,
};
import {
  extractMemoryTextFromResponse,
  extractMemoryTextFromRequestBody,
  resolveMemoryOwnerId,
} from "./chatCore/memoryExtraction.ts";
import { CORS_HEADERS } from "../utils/cors.ts";
import { checkHeapPressureGuard } from "../utils/heapPressure.ts";
import { normalizeHeaders } from "../utils/headers.ts";
import { resolveChatCoreRequestFormat } from "./chatCore/requestFormat.ts";
import { resolveChatCoreTargetFormat } from "./chatCore/targetFormat.ts";
import { defaultClaudeToolType } from "./chatCore/claudeToolDefaults.ts";
import { injectSystemPrompt, injectCustomSystemPrompt } from "../services/systemPrompt.ts";
import { translateRequest, needsTranslation } from "../translator/index.ts";
import { FORMATS } from "../translator/formats.ts";
import { sanitizeKiroTools } from "../utils/kiroSanitizer.ts";
import { splitMisplacedToolResults } from "../translator/helpers/claudeHelper.ts";
=======
import { CORS_HEADERS } from "../utils/cors.ts";
import { detectFormatFromEndpoint, getTargetFormat } from "../services/provider.ts";
import { translateRequest, needsTranslation } from "../translator/index.ts";
import { FORMATS } from "../translator/formats.ts";
>>>>>>> Stashed changes
import {
  createSSETransformStreamWithLogger,
  createPassthroughStreamWithLogger,
  COLORS,
  withBodyTimeout,
} from "../utils/stream.ts";
import { ensureStreamReadiness } from "../utils/streamReadiness.ts";
<<<<<<< Updated upstream
import { resolveSuppressThinkClose, THINKING_MARKER_HEADER } from "../utils/thinkCloseMarker.ts";
import { resolveStreamReadinessTimeout } from "../utils/streamReadinessPolicy.ts";
import { resolveAgentGoalPolicy } from "../utils/agentGoalPolicy.ts";
import { createStreamController } from "../utils/streamHandler.ts";
import * as streamFailure from "../utils/streamFailureFinalization.ts";
import { createSseHeartbeatTransform, shapeForClientFormat } from "../utils/sseHeartbeat.ts";
import { addBufferToUsage, filterUsageForFormat, estimateUsage } from "../utils/usageTracking.ts";
import {
  refreshWithRetry,
  isUnrecoverableRefreshError,
  runWithOnPersist,
  runWithCasGuard,
} from "../services/tokenRefresh.ts";
import { createRequestLogger } from "../utils/requestLogger.ts";
import { createPreparedRequestLogger, runWithCapture } from "../utils/providerRequestLogging.ts";
import { summarizeToolSources } from "../utils/toolSources.ts";
import { applyResponsesPreviousResponseIdPolicy } from "../utils/responsesStatePolicy.ts";
import { applyClaudeEffortVariant } from "./chatCore/claudeEffortVariant.ts";
import { DEFAULT_THINKING_CLAUDE_SIGNATURE } from "../config/defaultThinkingSignature.ts";
=======
import { createStreamController, pipeWithDisconnect } from "../utils/streamHandler.ts";
import { addBufferToUsage, filterUsageForFormat, estimateUsage } from "../utils/usageTracking.ts";
import { refreshWithRetry } from "../services/tokenRefresh.ts";
import { createRequestLogger } from "../utils/requestLogger.ts";
import { getModelTargetFormat, PROVIDER_ID_TO_ALIAS } from "../config/providerModels.ts";
>>>>>>> Stashed changes
import {
  getStripTypesForProviderModel,
  stripIncompatibleMessageContent,
} from "../services/modelStrip.ts";
import { resolveModelAlias } from "../services/modelDeprecation.ts";
<<<<<<< Updated upstream
import { normalizeMimoThinking } from "../services/mimoThinking.ts";
import { normalizeClaudeAdaptiveThinking } from "../services/claudeAdaptiveThinking.ts";
import { normalizeClaudeHaikuConstraints } from "../services/claudeHaikuConstraints.ts";
import { echoModelInObject } from "../services/responseModelEcho.ts";
import { stripGpt5SamplingWhenReasoning } from "../services/gpt5SamplingGuard.ts";
import { getUnsupportedParams, REGISTRY } from "../config/providerRegistry.ts";
import { supportsMaxTokens } from "@/lib/modelCapabilities.ts";
import { normalizeThinkingForModel } from "@/shared/constants/modelSpecs.ts";
=======
import { getUnsupportedParams } from "../config/providerRegistry.ts";
>>>>>>> Stashed changes
import {
  buildErrorBody,
  createErrorResult,
  parseUpstreamError,
  formatProviderError,
} from "../utils/error.ts";
import { reportMalformed200, detectMalformedNonStream } from "../utils/diagnostics.ts";
import {
  COOLDOWN_MS,
  HTTP_STATUS,
<<<<<<< Updated upstream
  FETCH_BODY_TIMEOUT_MS,
  PROVIDER_MAX_TOKENS,
  STREAM_IDLE_TIMEOUT_MS,
  STREAM_READINESS_MAX_TIMEOUT_MS,
  STREAM_READINESS_TIMEOUT_MS,
  ANTIGRAVITY_PRE_RESPONSE_TIMEOUT_CODE,
  STREAM_RECOVERY,
=======
  PROVIDER_MAX_TOKENS,
  STREAM_IDLE_TIMEOUT_MS,
>>>>>>> Stashed changes
} from "../config/constants.ts";
import { createRecoverableStream, makeContinuationBody } from "../services/streamRecovery.ts";
import {
  resolveResilienceSettings,
  isStreamRecoveryExplicitlyConfigured,
} from "@/lib/resilience/settings";
import {
  classifyProviderError,
  PROVIDER_ERROR_TYPES,
  isEmptyContentResponse,
} from "../services/errorClassifier.ts";
<<<<<<< Updated upstream
import { updateProviderConnection, getProviderConnectionById } from "@/lib/db/providers";
import { wasRefreshTokenRotated } from "@omniroute/open-sse/services/refreshSerializer.ts";
import { connectionHasExtraKeys } from "../services/apiKeyRotator.ts";
import { recordKeyHealthStatus as recordKeyHealthStatusFor } from "./chatCore/keyHealth.ts";
import { getSkillsModelIdForFormat } from "./chatCore/skillsFormat.ts";
import { readNonStreamingResponseBody } from "./chatCore/nonStreamingResponseBody.ts";
import {
  isSemaphoreCapacityError,
  createStreamingErrorResult,
  getUpstreamErrorIdentifier,
} from "./chatCore/streamErrorResult.ts";
import { wrapReadableStreamWithFinalize } from "./chatCore/streamFinalize.ts";
import { buildCacheUsageLogMeta } from "./chatCore/cacheUsageMeta.ts";
import { buildExecutorClientHeaders } from "./chatCore/executorClientHeaders.ts";
import { resolveExecutionCredentials as resolveExecutionCredentialsFor } from "./chatCore/executionCredentials.ts";
import { resolveExecutorWithProxy as resolveExecutorWithProxyFor } from "./chatCore/executorProxy.ts";
import type { ClaudeMessage } from "./chatCore/claudeMessageTypes.ts";
import { normalizeClaudeUpstreamMessages as normalizeClaudeUpstreamMessagesFor } from "./chatCore/claudeUpstreamMessages.ts";
import {
  persistAttemptLogs as persistAttemptLogsFor,
  type PersistAttemptLogsArgs,
} from "./chatCore/attemptLogging.ts";
import { stageTrace } from "./chatCore/stageTrace.ts";
import { attachCompressionUsageReceiptAfterAnalytics as attachCompressionUsageReceiptAfterAnalyticsFor } from "./chatCore/compressionUsageReceipt.ts";
import { prepareUpstreamBody } from "./chatCore/upstreamBody.ts";
import { getQuotaScopeLabelForProvider } from "../services/antigravityQuotaFamily.ts";

import {
  getCallLogPipelineCaptureStreamChunks,
  getCallLogPipelineMaxSizeBytes,
} from "@/lib/logEnv";
import { logAuditEvent } from "@/lib/compliance";
import { emit } from "@/lib/events/eventBus";
import { adaptBodyForCompression } from "../services/compression/bodyAdapter.ts";
import { ensureEngineBreakdown } from "../services/compression/engineBreakdown.ts";
import { handleBypassRequest } from "../utils/bypassHandler.ts";
import { saveRequestUsage, trackPendingRequest, appendRequestLog } from "@/lib/usageDb";
import { finalizePendingScope, updatePendingScope } from "@/lib/usage/pendingRequestScope";
=======
import { updateProviderConnection } from "@/lib/db/providers";
import { isDetailedLoggingEnabled } from "@/lib/db/detailedLogs";
import { getCallLogPipelineCaptureStreamChunks } from "@/lib/logEnv";
import { logAuditEvent } from "@/lib/compliance";
import { extractProviderWarnings } from "@/lib/compliance/providerAudit";
import { handleBypassRequest } from "../utils/bypassHandler.ts";
import {
  saveRequestUsage,
  trackPendingRequest,
  updatePendingRequest,
  appendRequestLog,
  saveCallLog,
} from "@/lib/usageDb";
import {
  getLoggedInputTokens,
  getLoggedOutputTokens,
  formatUsageLog,
} from "@/lib/usage/tokenAccounting";
>>>>>>> Stashed changes
import { recordCost } from "@/domain/costRules";
import { calculateCost } from "@/lib/usage/costCalculator";
import {
<<<<<<< Updated upstream
  buildClaudePassthroughToolNameMap,
  restoreClaudePassthroughToolNames,
  mergeResponseToolNameMap,
} from "./chatCore/passthroughToolNames.ts";
import { resolveCompressionSettings } from "./chatCore/compressionSettings.ts";
import {
  isBuiltinStackedPipeline,
  isStackedCompressionCombo,
  type RuntimeCompressionCombo,
} from "./chatCore/compressionComboPredicates.ts";
import { emitOutputStyleTelemetry } from "./chatCore/outputStyleTelemetry.ts";
import {
  writeCompressionAnalytics,
  writeCompressionSkip,
} from "./chatCore/compressionAnalyticsWrite.ts";
import { runPluginOnRequestHook } from "./chatCore/pluginOnRequest.ts";
import { recordContextEditingTelemetryHook } from "./chatCore/contextEditingTelemetry.ts";
import { recordCompressionCacheStats } from "./chatCore/compressionCacheStats.ts";
import { writeCavemanOutputAnalytics } from "./chatCore/cavemanOutputAnalytics.ts";
import { scheduleQuotaShareConsumption } from "./chatCore/quotaShareConsumption.ts";
import { emitRequestGamificationEvent } from "./chatCore/gamificationEvent.ts";
import { runPluginOnResponseHook } from "./chatCore/pluginOnResponse.ts";
import { scheduleStreamingQuotaShareConsumption } from "./chatCore/streamingQuotaShare.ts";
import { recordStreamingUsageStats } from "./chatCore/streamingUsageStats.ts";
import { recordStreamingCost } from "./chatCore/streamingCost.ts";
import {
  appendNonStreamingSseTerminalSignal,
  type NonStreamingSseTerminalState,
} from "./chatCore/nonStreamingSse.ts";
import { parseNonStreamingResponseBody } from "./chatCore/nonStreamingResponseParse.ts";
import { unwrapClinepassEnvelope } from "../utils/clinepassEnvelope.ts";
import { recordNonStreamingUsageStats } from "./chatCore/nonStreamingUsageStats.ts";
import {
  createBodyTimeoutError,
  readStreamChunkWithTimeout,
  computeBillableTokens,
  normalizeExecutorResult,
  executeWithUpstreamStartTimeout,
} from "./chatCore/upstreamTimeouts.ts";
import { getModelNormalizeToolCallId, getModelPreserveOpenAIDeveloperRole } from "@/lib/localDb";
import { getProviderCredentials, extractSessionAffinityKey } from "@/sse/services/auth";
import { deleteSessionAccountAffinity } from "@/lib/db/sessionAccountAffinity";
import { getCacheControlSettings } from "@/lib/cacheControlSettings";
import { guardrailRegistry } from "@/lib/guardrails";
import { shouldPreserveCacheControl } from "../utils/cacheControlPolicy.ts";
import { getCachedSettings } from "@/lib/db/readCache";
import { applyCodexGlobalFastServiceTier } from "@/lib/providers/codexFastTier";
import { buildUpstreamHeadersForExecute as buildUpstreamHeadersForExecuteFor } from "./chatCore/upstreamExecuteHeaders.ts";
import {
  resolveEffectiveServiceTier as resolveEffectiveServiceTierFor,
  resolveReportedServiceTier as resolveReportedServiceTierFor,
  type EffectiveServiceTier,
} from "./chatCore/serviceTier.ts";
import { cacheReasoningFromAssistantMessage } from "../services/reasoningCache.ts";
import { sanitizeOpenAITool } from "../services/toolSchemaSanitizer.ts";
import {
  setDetectedToolLimit,
  parseToolLimitFromError,
  shouldDetectLimit,
} from "../services/toolLimitDetector.ts";
=======
  getModelNormalizeToolCallId,
  getModelPreserveOpenAIDeveloperRole,
  getModelUpstreamExtraHeaders,
  getUpstreamProxyConfig,
} from "@/lib/localDb";
import { getExecutor } from "../executors/index.ts";
import { getCacheControlSettings } from "@/lib/cacheControlSettings";
import { guardrailRegistry, resolveDisabledGuardrails } from "@/lib/guardrails";
import {
  applyConfiguredPayloadRules,
  resolvePayloadRuleProtocols,
} from "../services/payloadRules.ts";
import {
  shouldPreserveCacheControl,
  providerSupportsCaching,
} from "../utils/cacheControlPolicy.ts";
import { getCacheMetrics } from "@/lib/db/settings.ts";
import { getCachedSettings } from "@/lib/db/readCache";
import { cacheReasoningFromAssistantMessage } from "../services/reasoningCache.ts";
import { sanitizeOpenAITool } from "../services/toolSchemaSanitizer.ts";
>>>>>>> Stashed changes

import { isCompactResponsesEndpoint } from "../executors/codex.ts";
import { buildCodexQuotaPersistence } from "./chatCore/codexQuota.ts";
import { invalidateCodexQuotaCache } from "../services/codexQuotaFetcher.ts";
import { translateNonStreamingResponse } from "./responseTranslator.ts";
import { unwrapClineNonStreamingEnvelope } from "./chatCore/clineResponseEnvelope.ts";
import { extractUsageFromResponse } from "./usageExtractor.ts";
import {
<<<<<<< Updated upstream
  sanitizeOpenAIResponse,
  sanitizeResponsesApiResponse,
  shouldParseTextualReasoningTags,
} from "./responseSanitizer.ts";
=======
  parseSSEToClaudeResponse,
  parseSSEToOpenAIResponse,
  parseSSEToResponsesOutput,
} from "./sseParser.ts";
import { sanitizeOpenAIResponse, sanitizeResponsesApiResponse } from "./responseSanitizer.ts";
>>>>>>> Stashed changes
import {
  withRateLimit,
  updateFromHeaders,
  updateFromResponseBody,
  initializeRateLimits,
} from "../services/rateLimitManager.ts";
import {
  acquire as acquireAccountSemaphore,
  markBlocked as markAccountSemaphoreBlocked,
} from "../services/accountSemaphore.ts";
import { lockModelIfPerModelQuota } from "../services/accountFallback.ts";
import {
  generateSignature,
  getCachedResponse,
  setCachedResponse,
  isCacheableForRead,
  isCacheableForWrite,
} from "@/lib/semanticCache";
<<<<<<< Updated upstream
import { saveIdempotency } from "@/lib/idempotencyLayer";
=======
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from "@/lib/idempotencyLayer";
import { createProgressTransform, wantsProgress } from "../utils/progressTracker.ts";
>>>>>>> Stashed changes
import {
  isModelUnavailableError,
  getNextFamilyFallback,
  isContextOverflowError,
  findLargerContextModel,
  getModelFamily,
} from "../services/modelFamilyFallback.ts";
import { computeRequestHash, deduplicate, shouldDeduplicate } from "../services/requestDedup.ts";
<<<<<<< Updated upstream
import {
  compressContext,
  estimateTokens,
  getTokenLimit,
  resolveComboContextLimit,
} from "../services/contextManager.ts";
import { resolveBackgroundTaskRedirect } from "./chatCore/backgroundRedirect.ts";
import type { CompressionConfig, CompressionPipelineStep } from "../services/compression/types.ts";
=======
import { compressContext, estimateTokens, getTokenLimit } from "../services/contextManager.ts";
import {
  getBackgroundTaskReason,
  getDegradedModel,
  getBackgroundDegradationConfig,
} from "../services/backgroundTaskDetector.ts";
import {
  shouldUseFallback,
  isFallbackDecision,
  EMERGENCY_FALLBACK_CONFIG,
} from "../services/emergencyFallback.ts";
>>>>>>> Stashed changes
import { prepareWebSearchFallbackBody } from "../services/webSearchFallback.ts";
import {
  resolveExplicitStreamAlias,
  resolveStreamFlag,
  stripMarkdownCodeFence,
} from "../utils/aiSdkCompat.ts";
import { generateRequestId } from "@/shared/utils/requestId";
import { extractFacts } from "@/lib/memory/extraction";
import { injectMemory, shouldInjectMemory } from "@/lib/memory/injection";
import { retrieveMemories } from "@/lib/memory/retrieval";
import {
  DEFAULT_MEMORY_SETTINGS,
  getMemorySettings,
  toMemoryRetrievalConfig,
} from "@/lib/memory/settings";
import { injectSkills } from "@/lib/skills/injection";
import { handleToolCallExecution } from "@/lib/skills/interception";
import { OMNIROUTE_RESPONSE_HEADERS } from "@/shared/constants/headers";
import { getClaudeCodeCompatibleRequestDefaults } from "@/lib/providers/requestDefaults";
import {
  buildClaudeCodeCompatibleRequest,
  isClaudeCodeCompatibleProvider,
  resolveClaudeCodeCompatibleSessionId,
} from "../services/claudeCodeCompatible.ts";
import { setGeminiThoughtSignatureMode } from "../services/geminiThoughtSignatureStore.ts";
import { fetchLiveProviderLimits } from "@/lib/usage/providerLimits";
import { isClaudeExtraUsageBlockEnabled } from "@/lib/providers/claudeExtraUsage";

<<<<<<< Updated upstream
// ── Global memory pressure guard ────────────────────────────────────────
// Prevents OOM by rejecting new requests when V8 heap exceeds threshold.
// Self-healing: no counters to leak, no cleanup needed. The threshold
// auto-calibrates to 85% of the actual V8 heap ceiling (see heapPressure.ts) so
// it tracks --max-old-space-size across 1GB/2GB/large VPS instead of a fixed
// 200MB that sat below the app's own ~260MB baseline and rejected every request.

import { isSmallEnoughForSemanticCache } from "../utils/estimateSize.ts";
=======
const MEMORY_EXTRACTION_TEXT_LIMIT = 64 * 1024;
const CHAT_LOG_TEXT_LIMIT = 64 * 1024;
const CHAT_LOG_ARRAY_TAIL_ITEMS = 24;
const CHAT_LOG_MAX_DEPTH = 6;
const CHAT_LOG_MAX_OBJECT_KEYS = 80;

function capMemoryExtractionText(value: string): string {
  if (value.length <= MEMORY_EXTRACTION_TEXT_LIMIT) return value;
  return value.slice(-MEMORY_EXTRACTION_TEXT_LIMIT);
}

function truncateChatLogText(value: string): string {
  if (value.length <= CHAT_LOG_TEXT_LIMIT) return value;
  const head = value.slice(0, Math.floor(CHAT_LOG_TEXT_LIMIT / 2));
  const tail = value.slice(-Math.ceil(CHAT_LOG_TEXT_LIMIT / 2));
  return `${head}\n[...truncated ${value.length - CHAT_LOG_TEXT_LIMIT} chars...]\n${tail}`;
}

function cloneBoundedChatLogPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateChatLogText(value);
  if (typeof value !== "object") return value;
  if (depth >= CHAT_LOG_MAX_DEPTH) return "[MaxDepth]";

  if (Array.isArray(value)) {
    const retained =
      value.length > CHAT_LOG_ARRAY_TAIL_ITEMS ? value.slice(-CHAT_LOG_ARRAY_TAIL_ITEMS) : value;
    const cloned = retained.map((item) => cloneBoundedChatLogPayload(item, depth + 1));
    if (value.length > CHAT_LOG_ARRAY_TAIL_ITEMS) {
      return [
        {
          _omniroute_truncated_array: true,
          originalLength: value.length,
          retainedTailItems: CHAT_LOG_ARRAY_TAIL_ITEMS,
        },
        ...cloned,
      ];
    }
    return cloned;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, item] of entries.slice(0, CHAT_LOG_MAX_OBJECT_KEYS)) {
    result[key] = cloneBoundedChatLogPayload(item, depth + 1);
  }
  if (entries.length > CHAT_LOG_MAX_OBJECT_KEYS) {
    result._omniroute_truncated_keys = entries.length - CHAT_LOG_MAX_OBJECT_KEYS;
  }
  return result;
}

function isSmallEnoughForSemanticCache(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= 256 * 1024;
  } catch {
    return false;
  }
}

function extractMemoryTextFromResponse(
  response: Record<string, unknown> | null | undefined
): string {
  if (!response || typeof response !== "object") return "";

  const openAIText = response?.choices?.[0]?.message?.content;
  if (typeof openAIText === "string") {
    return capMemoryExtractionText(openAIText.trim());
  }

  if (Array.isArray(response?.content)) {
    const contentText = response.content
      .filter(
        (part: Record<string, unknown>) => part?.type === "text" && typeof part?.text === "string"
      )
      .map((part: Record<string, unknown>) => String(part.text).trim())
      .filter(Boolean)
      .join("\n");
    if (contentText) return capMemoryExtractionText(contentText);
  }

  if (typeof response?.output_text === "string") {
    return capMemoryExtractionText(response.output_text.trim());
  }

  return "";
}

function extractMemoryTextFromRequestBody(
  body: Record<string, unknown> | null | undefined
): string {
  if (!body || typeof body !== "object") return "";

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (messages && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i] as Record<string, unknown>;
      if (msg?.role !== "user") continue;

      if (typeof msg.content === "string" && msg.content.trim().length > 0) {
        return capMemoryExtractionText(msg.content.trim());
      }

      if (Array.isArray(msg.content)) {
        const text = msg.content
          .map((part: Record<string, unknown>) => {
            if (typeof part?.text === "string") return part.text.trim();
            if (part?.type === "input_text" && typeof part?.text === "string")
              return part.text.trim();
            return "";
          })
          .filter(Boolean)
          .join("\n")
          .trim();
        if (text) return capMemoryExtractionText(text);
      }
    }
  }

  const input = Array.isArray(body.input) ? body.input : null;
  if (input && input.length > 0) {
    for (let i = input.length - 1; i >= 0; i -= 1) {
      const item = input[i] as Record<string, unknown>;
      const role = typeof item?.role === "string" ? item.role.trim().toLowerCase() : "";
      const itemType = typeof item?.type === "string" ? item.type.trim().toLowerCase() : "";
      if (role && role !== "user") continue;
      if (itemType && itemType !== "message") continue;

      if (typeof item?.content === "string" && item.content.trim()) {
        return capMemoryExtractionText(item.content.trim());
      }
      if (Array.isArray(item?.content)) {
        const text = item.content
          .map((part: Record<string, unknown>) => {
            if (typeof part?.text === "string") return part.text.trim();
            if (part?.type === "input_text" && typeof part?.text === "string")
              return part.text.trim();
            return "";
          })
          .filter(Boolean)
          .join("\n")
          .trim();
        if (text) return capMemoryExtractionText(text);
      }
    }

    const tailChunks: string[] = [];
    let tailLength = 0;
    for (let i = input.length - 1; i >= 0 && tailLength < MEMORY_EXTRACTION_TEXT_LIMIT; i -= 1) {
      const item = input[i] as Record<string, unknown>;
      const text = (() => {
        const role = typeof item?.role === "string" ? item.role.trim().toLowerCase() : "";
        const itemType = typeof item?.type === "string" ? item.type.trim().toLowerCase() : "";
        if (role && role !== "user") return "";
        if (itemType && itemType !== "message") return "";

        if (typeof item?.content === "string") return item.content.trim();
        if (Array.isArray(item?.content)) {
          return item.content
            .map((part: Record<string, unknown>) => {
              if (typeof part?.text === "string") return part.text.trim();
              if (part?.type === "input_text" && typeof part?.text === "string")
                return part.text.trim();
              return "";
            })
            .filter(Boolean)
            .join("\n")
            .trim();
        }
        return "";
      })();
      if (!text) continue;
      tailChunks.unshift(text);
      tailLength += text.length + 1;
    }
    const chunks = tailChunks.join("\n").trim();
    if (chunks) return capMemoryExtractionText(chunks);
  }

  return "";
}

async function maybeSyncClaudeExtraUsageState({
  provider,
  connectionId,
  providerSpecificData,
  log,
}: {
  provider: string | null | undefined;
  connectionId: string | null | undefined;
  providerSpecificData: unknown;
  log?: { debug?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } | null;
}) {
  if (!connectionId || !isClaudeExtraUsageBlockEnabled(provider, providerSpecificData)) {
    return;
  }

  try {
    await fetchLiveProviderLimits(connectionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.debug?.("CLAUDE_USAGE", `Failed to sync Claude extra-usage state: ${message}`);
  }
}

function resolveMemoryOwnerId(apiKeyInfo: Record<string, unknown> | null): string | null {
  const rawId = apiKeyInfo?.id;
  if (typeof rawId === "string" && rawId.trim().length > 0) {
    return rawId;
  }
  return null;
}

export function shouldUseNativeCodexPassthrough({
  provider,
  sourceFormat,
  endpointPath,
}: {
  provider?: string | null;
  sourceFormat?: string | null;
  endpointPath?: string | null;
}): boolean {
  if (provider !== "codex") return false;
  if (sourceFormat !== FORMATS.OPENAI_RESPONSES) return false;
  let normalizedEndpoint = String(endpointPath || "");
  while (normalizedEndpoint.endsWith("/")) normalizedEndpoint = normalizedEndpoint.slice(0, -1);
  const segments = normalizedEndpoint.split("/");
  return segments.includes("responses");
}

function buildClaudePassthroughToolNameMap(body: Record<string, unknown> | null | undefined) {
  if (!body || !Array.isArray(body.tools)) return null;

  const toolNameMap = new Map<string, string>();
  for (const tool of body.tools) {
    const toolRecord = tool as Record<string, unknown>;
    const toolData =
      toolRecord?.type === "function" &&
      toolRecord.function &&
      typeof toolRecord.function === "object"
        ? (toolRecord.function as Record<string, unknown>)
        : toolRecord;
    const originalName = typeof toolData?.name === "string" ? toolData.name.trim() : "";
    if (!originalName) continue;
    toolNameMap.set(`${CLAUDE_OAUTH_TOOL_PREFIX}${originalName}`, originalName);
  }

  return toolNameMap.size > 0 ? toolNameMap : null;
}

function restoreClaudePassthroughToolNames(
  responseBody: Record<string, unknown>,
  toolNameMap: Map<string, string> | null
) {
  if (!toolNameMap || !Array.isArray(responseBody?.content)) return responseBody;

  let changed = false;
  const content = responseBody.content.map((block: Record<string, unknown>) => {
    if (block?.type !== "tool_use" || typeof block?.name !== "string") return block;
    const restoredName = toolNameMap.get(block.name) ?? block.name;
    if (restoredName === block.name) return block;
    changed = true;
    return {
      ...block,
      name: restoredName,
    };
  });

  if (!changed) return responseBody;
  return {
    ...responseBody,
    content,
  };
}

function mergeResponseToolNameMap(
  baseToolNameMap: Map<string, string> | null,
  transformedBody: Record<string, unknown> | null | undefined
) {
  const executorToolNameMap =
    transformedBody && transformedBody._toolNameMap instanceof Map
      ? (transformedBody._toolNameMap as Map<string, string>)
      : null;

  if (!executorToolNameMap?.size) return baseToolNameMap;
  if (!baseToolNameMap?.size) return executorToolNameMap;

  const merged = new Map(baseToolNameMap);
  for (const [toolName, originalName] of executorToolNameMap.entries()) {
    merged.set(toolName, originalName);
  }
  return merged;
}

function materializeDeduplicatedExecutionResult<T extends Record<string, unknown>>(result: T): T {
  const snapshot =
    result && typeof result === "object"
      ? ((result as Record<string, unknown>)._dedupSnapshot as
          | {
              status: number;
              statusText: string;
              headers: [string, string][];
              payload: string;
            }
          | undefined)
      : undefined;

  if (!snapshot) return result;

  return {
    ...result,
    response: new Response(snapshot.payload, {
      status: snapshot.status,
      statusText: snapshot.statusText,
      headers: snapshot.headers,
    }),
  } as T;
}

function getSkillsProviderForFormat(format: string): "openai" | "anthropic" | "google" | "other" {
  switch (format) {
    case FORMATS.CLAUDE:
      return "anthropic";
    case FORMATS.GEMINI:
      return "google";
    default:
      return "openai";
  }
}

function getSkillsModelIdForFormat(format: string): string {
  switch (format) {
    case FORMATS.CLAUDE:
      return "claude";
    case FORMATS.GEMINI:
      return "gemini";
    default:
      return "openai";
  }
}

function parseNonStreamingSSEPayload(
  rawBody: string,
  preferredFormat: string,
  fallbackModel: string
): { body: Record<string, unknown>; format: string } | null {
  const formatsToTry: string[] = [];
  const seen = new Set<string>();
  const queueFormat = (format: string) => {
    if (!format || seen.has(format)) return;
    seen.add(format);
    formatsToTry.push(format);
  };

  queueFormat(preferredFormat);
  queueFormat(FORMATS.OPENAI_RESPONSES);
  queueFormat(FORMATS.CLAUDE);
  queueFormat(FORMATS.OPENAI);

  for (const format of formatsToTry) {
    const parsed =
      format === FORMATS.OPENAI_RESPONSES
        ? parseSSEToResponsesOutput(rawBody, fallbackModel)
        : format === FORMATS.CLAUDE
          ? parseSSEToClaudeResponse(rawBody, fallbackModel)
          : parseSSEToOpenAIResponse(rawBody, fallbackModel);
    if (parsed && typeof parsed === "object") {
      return {
        body: parsed as Record<string, unknown>,
        format,
      };
    }
  }

  return null;
}

function convertNDJSONToSSE(rawBody: string): string {
  const chunks = String(rawBody || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (chunks.length === 0) return rawBody;

  return `${chunks.map((chunk) => `data: ${chunk}\n`).join("\n")}\n`;
}

function normalizeNonStreamingEventPayload(rawBody: string, contentType: string): string {
  if (contentType.includes("application/x-ndjson")) {
    return convertNDJSONToSSE(rawBody);
  }
  return rawBody;
}

function getHeaderValueCaseInsensitive(
  headers: Record<string, unknown> | null | undefined,
  targetName: string
) {
  if (!headers || typeof headers !== "object") return null;
  const lowered = targetName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowered && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isSemaphoreTimeoutError(error: unknown): error is Error & { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "SEMAPHORE_TIMEOUT"
  );
}

function wrapReadableStreamWithFinalize<T>(
  readable: ReadableStream<T>,
  finalize: () => void
): ReadableStream<T> {
  const reader = readable.getReader();
  let finalized = false;

  const runFinalize = () => {
    if (finalized) return;
    finalized = true;
    finalize();
  };

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          runFinalize();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        runFinalize();
        controller.error(error);
      }
    },

    async cancel(reason) {
      runFinalize();
      try {
        await reader.cancel(reason);
      } catch (error) {
        // Ignored
      }
    },
  });
}

function resolveAccountSemaphoreAccountKey(
  connectionId: string | null | undefined,
  credentials: Record<string, unknown> | null | undefined
): string | null {
  if (typeof connectionId === "string" && connectionId.trim().length > 0) {
    return connectionId;
  }

  const candidateKeys = [
    credentials?.connectionId,
    credentials?.id,
    credentials?.email,
    credentials?.name,
    credentials?.displayName,
  ];

  for (const candidate of candidateKeys) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function resolveAccountSemaphoreMaxConcurrency(
  credentials: Record<string, unknown> | null | undefined
): number | null {
  return toFiniteNumberOrNull(credentials?.maxConcurrent);
}

function resolveAccountSemaphoreKey({
  provider,
  model,
  connectionId,
  credentials,
}: {
  provider: string | null | undefined;
  model: string;
  connectionId: string | null | undefined;
  credentials: Record<string, unknown> | null | undefined;
}): string | null {
  const accountKey = resolveAccountSemaphoreAccountKey(connectionId, credentials);
  if (!accountKey || !provider) return null;
  return buildAccountSemaphoreKey({ provider, accountKey });
}

function buildClaudePromptCacheLogMeta(
  targetFormat: string,
  finalBody: Record<string, unknown> | null | undefined,
  providerHeaders: Record<string, unknown> | null | undefined
) {
  if (targetFormat !== FORMATS.CLAUDE || !finalBody || typeof finalBody !== "object") return null;

  const describeCacheControl = (cacheControl: Record<string, unknown> | undefined, extra = {}) => ({
    type:
      cacheControl && typeof cacheControl.type === "string" && cacheControl.type.trim()
        ? cacheControl.type.trim()
        : "ephemeral",
    ttl:
      cacheControl && typeof cacheControl.ttl === "string" && cacheControl.ttl.trim()
        ? cacheControl.ttl.trim()
        : null,
    ...extra,
  });

  const systemBreakpoints = Array.isArray(finalBody.system)
    ? finalBody.system.flatMap((block, index) => {
        if (!block || typeof block !== "object") return [];
        const text =
          typeof block.text === "string" && block.text.trim().length > 0 ? block.text.trim() : "";
        if (text.startsWith("x-anthropic-billing-header:")) {
          return [];
        }
        const cacheControl =
          block.cache_control && typeof block.cache_control === "object"
            ? block.cache_control
            : null;
        return cacheControl ? [describeCacheControl(cacheControl, { index })] : [];
      })
    : [];

  const toolBreakpoints = Array.isArray(finalBody.tools)
    ? finalBody.tools.flatMap((tool, index) => {
        if (!tool || typeof tool !== "object") return [];
        const cacheControl =
          tool.cache_control && typeof tool.cache_control === "object" ? tool.cache_control : null;
        const name = typeof tool.name === "string" && tool.name.trim() ? tool.name.trim() : null;
        return cacheControl ? [describeCacheControl(cacheControl, { index, name })] : [];
      })
    : [];

  const messageBreakpoints = Array.isArray(finalBody.messages)
    ? finalBody.messages.flatMap((message, messageIndex) => {
        if (!message || typeof message !== "object" || !Array.isArray(message.content)) return [];
        const role =
          typeof message.role === "string" && message.role.trim() ? message.role.trim() : "unknown";
        return message.content.flatMap((block, contentIndex) => {
          if (!block || typeof block !== "object") return [];
          const cacheControl =
            block.cache_control && typeof block.cache_control === "object"
              ? block.cache_control
              : null;
          if (!cacheControl) return [];
          return [
            describeCacheControl(cacheControl, {
              messageIndex,
              contentIndex,
              role,
              blockType:
                typeof block.type === "string" && block.type.trim() ? block.type.trim() : "unknown",
            }),
          ];
        });
      })
    : [];

  const totalBreakpoints =
    systemBreakpoints.length + toolBreakpoints.length + messageBreakpoints.length;
  const anthropicBeta = getHeaderValueCaseInsensitive(providerHeaders, "Anthropic-Beta");

  if (totalBreakpoints === 0 && !anthropicBeta) return null;

  return {
    applied: totalBreakpoints > 0,
    totalBreakpoints,
    anthropicBeta,
    systemBreakpoints,
    toolBreakpoints,
    messageBreakpoints,
  };
}

function toPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function buildCacheUsageLogMeta(usage: Record<string, unknown> | null | undefined) {
  if (!usage || typeof usage !== "object") return null;
  const promptTokenDetails =
    usage.prompt_tokens_details && typeof usage.prompt_tokens_details === "object"
      ? (usage.prompt_tokens_details as Record<string, unknown>)
      : undefined;
  const hasCacheFields =
    "cache_read_input_tokens" in usage ||
    "cached_tokens" in usage ||
    "cache_creation_input_tokens" in usage ||
    (!!promptTokenDetails &&
      ("cached_tokens" in promptTokenDetails || "cache_creation_tokens" in promptTokenDetails));
  const cacheReadTokens = toPositiveNumber(
    usage.cache_read_input_tokens ?? usage.cached_tokens ?? promptTokenDetails?.cached_tokens
  );
  const cacheCreationTokens = toPositiveNumber(
    usage.cache_creation_input_tokens ?? promptTokenDetails?.cache_creation_tokens
  );
  if (!hasCacheFields) return null;
  return {
    cacheReadTokens,
    cacheCreationTokens,
  };
}

function attachLogMeta(
  payload: Record<string, unknown> | null | undefined,
  meta: Record<string, unknown> | null | undefined
) {
  if (!meta || typeof meta !== "object") return payload;
  const compactMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== null && value !== undefined)
  );
  if (Object.keys(compactMeta).length === 0) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { _omniroute: compactMeta, _payload: payload ?? null };
  }
  const existing =
    payload._omniroute &&
    typeof payload._omniroute === "object" &&
    !Array.isArray(payload._omniroute)
      ? payload._omniroute
      : {};
  return {
    ...payload,
    _omniroute: {
      ...existing,
      ...compactMeta,
    },
  };
}
>>>>>>> Stashed changes

/**
 * Core chat handler - shared between SSE and Worker
 * Returns { success, response, status, error } for caller to handle fallback
 * @param {object} options
 * @param {object} options.body - Request body
 * @param {object} options.modelInfo - { provider, model }
 * @param {object} options.credentials - Provider credentials
 * @param {object} options.log - Logger instance (optional)
 * @param {function} options.onCredentialsRefreshed - Callback when credentials are refreshed
 * @param {function} options.onRequestSuccess - Callback when request succeeds (to clear error status)
 * @param {function} options.onDisconnect - Callback when client disconnects
 * @param {string} options.connectionId - Connection ID for usage tracking
 * @param {object} options.apiKeyInfo - API key metadata for usage attribution
 * @param {string} options.userAgent - Client user agent for caching decisions
 * @param {string} options.comboName - Combo name if this is a combo request
 * @param {string} options.comboStrategy - Combo routing strategy (e.g., 'priority', 'cost-optimized')
 * @param {boolean} options.isCombo - Whether this request is from a combo
 * @param {string} options.connectionId - Connection ID for settings lookup
 */

<<<<<<< Updated upstream
// extractSystemRoleMessages extracted to chatCore/claudeSystemRole.ts (#3501); re-exported above so
// existing importers (e.g. tests/unit/system-role-extraction.test.ts) keep resolving it from here.
=======
/**
 * Module-level cache for upstream proxy config (shared across all requests).
 * 10s TTL prevents per-request DB lookups while staying fresh enough for setting changes.
 */
const _proxyConfigCache = new Map<string, { mode: string; enabled: boolean; ts: number }>();
const PROXY_CONFIG_CACHE_TTL = 10_000;

/**
 * Module-level cache for all combos data (shared across all requests).
 * Uses cached promises to prevent thundering herd — all concurrent callers
 * wait for the same underlying DB query while it's in flight.
 */
let _combosPromise: Promise<unknown[]> | null = null;
let _combosCacheTs = 0;
const COMBOS_CACHE_TTL = 10_000;

async function getCombosCached(): Promise<unknown[]> {
  const now = Date.now();
  if (_combosPromise && now - _combosCacheTs < COMBOS_CACHE_TTL) {
    return _combosPromise;
  }
  _combosCacheTs = now;
  _combosPromise = (async () => {
    const { getCombos } = await import("@/lib/localDb");
    return getCombos();
  })();
  return _combosPromise;
}

export function clearCombosCache() {
  _combosPromise = null;
  _combosCacheTs = 0;
}

export function clearUpstreamProxyConfigCache(providerId?: string) {
  if (providerId) {
    _proxyConfigCache.delete(providerId);
    return;
  }
  _proxyConfigCache.clear();
}

async function getUpstreamProxyConfigCached(providerId: string) {
  const cached = _proxyConfigCache.get(providerId);
  if (cached && Date.now() - cached.ts < PROXY_CONFIG_CACHE_TTL) return cached;
  const cfg = await getUpstreamProxyConfig(providerId).catch(() => null);
  const result = cfg
    ? { mode: cfg.mode, enabled: cfg.enabled, ts: Date.now() }
    : { mode: "native" as const, enabled: false, ts: Date.now() };
  _proxyConfigCache.set(providerId, result);
  return result;
}

function buildExecutorClientHeaders(
  headers: Headers | Record<string, unknown> | null | undefined,
  userAgent?: string | null
) {
  const normalized: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
  } else if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        normalized[key] = value;
      }
    }
  }

  const normalizedUserAgent = typeof userAgent === "string" ? userAgent.trim() : "";
  if (normalizedUserAgent && !normalized["user-agent"] && !normalized["User-Agent"]) {
    normalized["user-agent"] = normalizedUserAgent;
    normalized["User-Agent"] = normalizedUserAgent;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}
>>>>>>> Stashed changes

export async function handleChatCore({
  body,
  modelInfo,
  credentials,
  log,
  onCredentialsRefreshed,
  onRequestSuccess,
  onStreamFailure,
  onDisconnect,
  clientRawRequest,
  connectionId,
  apiKeyInfo = null,
  userAgent,
  comboName,
  comboStrategy = null,
  isCombo = false,
  comboStepId = null,
  comboExecutionKey = null,
<<<<<<< Updated upstream
  cachedSettings = null,
  skipUpstreamRetry = false,
  createPiiTransform = null,
  correlationId = null,
}) {
  let { provider, model, extendedContext } = modelInfo;
  // ── Memory pressure guard ────────────────────────────────────────────
  // Reject early if V8 heap is already near the 256MB limit. Prevents
  // cascading OOM when many large-context requests arrive concurrently.
  try {
    const heapUsedMB = process.memoryUsage().heapUsed / (1024 * 1024);
    const heapGuard = checkHeapPressureGuard(heapUsedMB);
    if (heapGuard) return heapGuard;
  } catch {
    /* memoryUsage() never throws */
  }

  // Per-request model-routing metadata (first extracted slice of the request-setup phase).
  const { apiFormat, customModelTargetFormat, requestedModel } = resolveChatCoreRequestSetup(
    modelInfo,
    body,
    model
  );
  const isModelScope = () => isModelScopeProvider(provider, credentials?.providerSpecificData);
  const startTime = Date.now();
  // Per-request trace id + checkpoint helper. Lets us see exactly which await
  // a hung request was sitting on in `[STAGE_TRACE]` log lines. Uses crypto RNG
  // (not Math.random) purely to satisfy CodeQL js/insecure-randomness — this id
  // is a log-correlation token, not a security secret.
  const traceId = globalThis.crypto.randomUUID().slice(0, 6);

  // Emit request.started event for real-time dashboard
  setImmediate(() => {
    emit("request.started", {
      id: traceId,
      model: model || "unknown",
      provider: provider || "unknown",
      timestamp: startTime,
      comboName: comboName || undefined,
    });
  });
  const traceEnabled = process.env.OMNIROUTE_TRACE === "true" || process.env.DEBUG === "true";
  // Stage trace extracted to chatCore/stageTrace.ts (#3501); bind the per-request inputs once so the
  // call sites stay byte-identical.
  const trace = (label: string, extra?: Record<string, unknown>) =>
    stageTrace(label, extra, { traceEnabled, startTime, traceId, log });
  const getCurrentConnectionId = () => {
    const credentialConnectionId =
      typeof credentials?.connectionId === "string" && credentials.connectionId.trim().length > 0
        ? credentials.connectionId.trim()
        : null;
    return credentialConnectionId || connectionId || null;
  };
  let tokensCompressed: number | null = null;
  body = injectSystemPrompt(body);
  // ── Per-endpoint custom system prompt (port of upstream #2063) ──
  // Reads from cachedSettings if available (passed in from combo/chat layer)
  // to avoid an extra DB read on the hot path. Falls through to getCachedSettings()
  // only when this function is called outside the normal chat dispatch.
  {
    const _s = cachedSettings ?? (await getCachedSettings());
    if (
      _s.customSystemPromptEnabled === true &&
      typeof _s.customSystemPrompt === "string" &&
      _s.customSystemPrompt
    ) {
      body = injectCustomSystemPrompt(body as Record<string, unknown>, _s.customSystemPrompt);
      log?.debug?.("CUSTOMSP", "custom system prompt injected");
    }
  }
  // ── Plugin onRequest hook ──
  // Dynamic import cached by Node.js after first call — minimal overhead
  const pluginGate = await runPluginOnRequestHook({
    requestId: traceId,
    body,
    model,
    provider,
    apiKeyInfo,
    log,
  });
  if (pluginGate.blocked) {
    return {
      success: false,
      status: 403,
      error: "Request blocked by plugin",
      response: pluginGate.response,
    };
  }
  if (pluginGate.body) {
    body = pluginGate.body;
  }
  // Per-API-key device/connection tracking (port of upstream 9router#931,
  // thanks @mugnimaestra). In-memory only, never blocks the request path.
  if (apiKeyInfo?.id) {
    trackDevice(
      apiKeyInfo.id,
      extractIpFromHeaders(clientRawRequest?.headers ?? null),
      userAgent ?? null
    );
  }
  const agentGoalPolicy = resolveAgentGoalPolicy(body, clientRawRequest?.headers ?? null);
  if (agentGoalPolicy.detected) {
    log?.debug?.(
      "AGENT_GOAL",
      `long-running goal mode enabled: readinessMax=${agentGoalPolicy.readinessMaxTimeoutMs}ms streamRecovery=${agentGoalPolicy.streamRecoveryEnabled}`
    );
  }

  let effectiveServiceTier: EffectiveServiceTier = "standard";
  // Codex service-tier resolvers extracted to chatCore/serviceTier.ts (#3501); bind the per-request
  // provider/credentials once and delegate so the existing call sites stay byte-identical.
  const resolveEffectiveServiceTier = (requestBody?: unknown): EffectiveServiceTier =>
    resolveEffectiveServiceTierFor(provider, credentials?.providerSpecificData, requestBody);
  const resolveReportedServiceTier = (
    payload?: unknown,
    maxDepth = 3
  ): EffectiveServiceTier | null => resolveReportedServiceTierFor(provider, payload, maxDepth);
  // Failure usage record building extracted to chatCore/failureUsage.ts (#3501); the handler keeps
  // the fire-and-forget save + computes latencyMs, so the call sites stay byte-identical.
  const persistFailureUsage = (statusCode: number, errorCode?: string | null) => {
    saveRequestUsage(
      buildFailureUsageRecord({
        provider,
        model,
        connectionId: getCurrentConnectionId(),
        apiKeyInfo,
        effectiveServiceTier,
        isCombo,
        comboStrategy,
        statusCode,
        errorCode,
        latencyMs: Date.now() - startTime,
        endpoint: endpointPath,
      })
    ).catch(() => {});
  };

  // Key-health updater extracted to chatCore/keyHealth.ts (#3501); bind the per-request log once
  // and delegate so the existing call sites stay byte-identical.
  const recordKeyHealthStatus = (
    status: number,
    creds: Record<string, unknown> | null | undefined
  ): void => recordKeyHealthStatusFor(status, creds, log);

  const persistCodexQuotaState = async (headers: Record<string, string> | null, status = 0) => {
    const currentConnectionId = getCurrentConnectionId();
    if (provider !== "codex" || !currentConnectionId || !headers) return;

    try {
=======
  disableEmergencyFallback = false,
}) {
  let { provider, model, extendedContext } = modelInfo;
  const requestedModel =
    typeof body?.model === "string" && body.model.trim().length > 0 ? body.model : model;
  const startTime = Date.now();
  // Per-request trace id + checkpoint helper. Lets us see exactly which await
  // a hung request was sitting on in `[STAGE_TRACE]` log lines.
  const traceId = Math.random().toString(36).slice(2, 8);
  const trace = (label: string, extra?: Record<string, unknown>) => {
    const elapsed = Date.now() - startTime;
    const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
    log?.info?.("STAGE_TRACE", `${traceId} ${label} t=${elapsed}ms${suffix}`);
  };
  const persistFailureUsage = (statusCode: number, errorCode?: string | null) => {
    saveRequestUsage({
      provider: provider || "unknown",
      model: model || "unknown",
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, reasoning: 0 },
      status: String(statusCode),
      success: false,
      latencyMs: Date.now() - startTime,
      timeToFirstTokenMs: 0,
      errorCode: errorCode || String(statusCode),
      timestamp: new Date().toISOString(),
      connectionId: connectionId || undefined,
      apiKeyId: apiKeyInfo?.id || undefined,
      apiKeyName: apiKeyInfo?.name || undefined,
    }).catch(() => {});
  };

  const persistCodexQuotaState = async (
    headers: Headers | Record<string, string> | null,
    status = 0
  ) => {
    if (provider !== "codex" || !connectionId || !headers) return;

    try {
      const quota = parseCodexQuotaHeaders(headers as Headers);
      if (!quota) return;

>>>>>>> Stashed changes
      const existingProviderData =
        credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
          ? (credentials.providerSpecificData as Record<string, unknown>)
          : {};
      // Pure payload build extracted to chatCore/codexQuota.ts (#3501). Returns null when the
      // response carries no quota headers (nothing to persist).
      const built = buildCodexQuotaPersistence({
        headers,
        existingProviderData,
        modelForScope: model || requestedModel || "",
        status,
      });
      if (!built) return;

      if (built.exhaustionLog) {
        log?.debug?.("CODEX", built.exhaustionLog);
      }

      // Invalidate the preflight cache for this connection so the next
      // isModelAvailable check fetches fresh quota data.
      if (status === 429) {
        invalidateCodexQuotaCache(currentConnectionId);
      }

      await updateProviderConnection(currentConnectionId, {
        providerSpecificData: built.nextProviderData,
      });

      credentials.providerSpecificData = built.nextProviderData;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      log?.debug?.("CODEX", `Failed to persist codex quota state: ${errMessage}`);
    }
  };

  // ── Phase 9.2: Idempotency check ──
  const idempotencyKey = getIdempotencyKey(clientRawRequest?.headers);
  const cachedIdemp = checkIdempotency(idempotencyKey);
  if (cachedIdemp) {
    log?.debug?.("IDEMPOTENCY", `Hit for key=${idempotencyKey?.slice(0, 12)}...`);
    const idempotentUsage =
      cachedIdemp.response && typeof cachedIdemp.response === "object"
        ? ((cachedIdemp.response as Record<string, unknown>).usage as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const idempotentCost = idempotentUsage
      ? await calculateCost(provider, model, idempotentUsage)
      : 0;
    return {
      success: true,
      response: new Response(JSON.stringify(cachedIdemp.response), {
        status: cachedIdemp.status,
        headers: {
          "Content-Type": "application/json",
          "X-OmniRoute-Idempotent": "true",
          ...buildOmniRouteResponseMetaHeaders({
            provider,
            model,
            cacheHit: false,
            latencyMs: Date.now() - startTime,
            usage: idempotentUsage,
            costUsd: idempotentCost,
          }),
        },
      }),
    };
  }

  // Initialize rate limit settings from persisted DB (once, lazy)
  await initializeRateLimits();

  // T07: Inject connectionId into credentials so executors can rotate API keys
  // using providerSpecificData.extraApiKeys (API Key Round-Robin feature)
  if (connectionId && credentials && !credentials.connectionId) {
    credentials.connectionId = connectionId;
  }

  // Endpoint/format resolution extracted to chatCore/requestFormat.ts (#3501); pure derivation
  // from the inbound request, destructured so every downstream use stays byte-identical.
  const {
    endpointPath,
<<<<<<< Updated upstream
    sourceFormat,
    isResponsesEndpoint,
    nativeCodexPassthrough,
    isDroidCLI,
    copilotCompatibleReasoning,
    clientResponseFormat,
  } = resolveChatCoreRequestFormat({ clientRawRequest, body, provider, userAgent });
=======
  });
  const isDroidCLI =
    userAgent?.toLowerCase().includes("droid") || userAgent?.toLowerCase().includes("codex-cli");
  const clientResponseFormat =
    sourceFormat === FORMATS.OPENAI_RESPONSES && !isResponsesEndpoint && !isDroidCLI
      ? FORMATS.OPENAI
      : sourceFormat;
>>>>>>> Stashed changes

  // Check for bypass patterns (warmup, skip) - return fake response
  const bypassResponse = handleBypassRequest(body, model, userAgent);
  if (bypassResponse) {
    return bypassResponse;
  }

  // Detect source format and get target format
  // Model-specific targetFormat takes priority over provider default

  // ── Background Task Redirection (T41) — decision extracted to chatCore/backgroundRedirect.ts (#3501)
  // backgroundReason is the detection signal (threaded into memory/skills injection below); redirect
  // is the actual model downgrade to apply, if any.
  const { backgroundReason, redirect: bgRedirect } = resolveBackgroundTaskRedirect({
    body,
    headers: clientRawRequest?.headers,
    model,
  });
  if (bgRedirect) {
    const originalModel = model;
    log?.info?.(
      "BACKGROUND",
      `Background task redirect (${bgRedirect.reason}): ${originalModel} → ${bgRedirect.degradedModel}`
    );
    model = bgRedirect.degradedModel;
    if (body && typeof body === "object") {
      body.model = model;
    }

    logAuditEvent({
      action: "routing.background_task_redirect",
      actor: apiKeyInfo?.name || "system",
      target: connectionId || provider || "chat",
      details: {
        original_model: originalModel,
        redirected_to: bgRedirect.degradedModel,
        reason: bgRedirect.reason,
      },
    });
  }

  // Apply custom model aliases (Settings → Model Aliases → Pattern→Target) before routing (#315, #472)
  // Custom aliases take priority over built-in and must be resolved here so the
  // downstream getModelTargetFormat() lookup AND the actual provider request use
  // the correct, aliased model ID. Without this, aliases only affect format detection.
  const resolvedModel = resolveModelAlias(model);
  // Use resolvedModel for all downstream operations (routing, provider requests, logging)
  const effectiveModel = resolvedModel !== model ? resolvedModel : model;
  if (resolvedModel !== model) {
    log?.info?.("ALIAS", `Model alias applied: ${model} → ${resolvedModel}`);
  }

<<<<<<< Updated upstream
  // Effort-variant model ids: the Claude / Claude-Code model picker (e.g. VS Code's
  // "Effort" slider) advertises claude-...-{low,medium,high,xhigh,max}. Anthropic has
  // no such model, so the suffixed id 404s upstream. Strip it back to the real base id
  // (forwarded as the upstream model via finalModelToUpstream below) and surface the
  // level as reasoning_effort so the OpenAI→Claude translator / Claude-Code bridge turn
  // it into Claude thinking/effort config. An explicit client-supplied effort always
  // wins; native Claude passthrough is left untouched (it carries its own `thinking`),
  // and non-thinking base models are cleaned up later by normalizeThinkingForModel().
  // Extracted to chatCore/claudeEffortVariant.ts (#3501); mutates body in place and returns the
  // stripped model + an optional log line, keeping behaviour byte-identical.
  {
    const effortVariant = applyClaudeEffortVariant({
      provider,
      effectiveModel,
      body,
      sourceFormat,
    });
    effectiveModel = effortVariant.effectiveModel;
    if (effortVariant.log) {
      log?.info?.("PARAMS", effortVariant.log);
    }
  }

  // Wire target-format resolution extracted to chatCore/targetFormat.ts (#3501); `alias` is reused
  // downstream when stripping the alias/ prefix off the upstream model id.
  const { alias, targetFormat } = resolveChatCoreTargetFormat({
    provider,
    resolvedModel,
    apiFormat,
    customModelTargetFormat,
    providerSpecificData: credentials?.providerSpecificData,
  });

  const initialProviderRequest =
    body && typeof body === "object" && !Array.isArray(body)
      ? {
          ...(body as Record<string, unknown>),
          model:
            typeof (body as Record<string, unknown>).model === "string"
              ? (body as Record<string, unknown>).model
              : effectiveModel,
        }
      : body;

  // Track pending requests before slower optional enrichment (settings, logging,
  // compression) so internal usage/runtime counters stay accurate even when
  // upstream never returns response headers.
  // Use credentials.connectionId as a fallback so that requests without an
  // explicit session-level connectionId still register in the pendingRequests map.
  const pendingConnId = connectionId || credentials?.connectionId || null;
  const pendingRequestId =
    trackPendingRequest(model, provider, pendingConnId, true, {
      clientEndpoint: clientRawRequest?.endpoint || "/v1/chat/completions",
      clientRequest: clientRawRequest?.body ?? body,
      providerRequest: initialProviderRequest,
      stage: "registered",
      correlationId,
    }) || generateRequestId();

  // Initialize rate limit settings from persisted DB (once, lazy)
  await initializeRateLimits();

=======
  const alias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  const modelTargetFormat = getModelTargetFormat(alias, resolvedModel);
  const targetFormat =
    modelTargetFormat || getTargetFormat(provider, credentials?.providerSpecificData);
>>>>>>> Stashed changes
  const { body: bodyWithWebSearchFallback, fallback: webSearchFallbackPlan } =
    prepareWebSearchFallbackBody(body as Record<string, unknown>, {
      provider,
      sourceFormat,
      targetFormat,
      nativeCodexPassthrough,
    });
  if (webSearchFallbackPlan.enabled) {
    body = bodyWithWebSearchFallback as typeof body;
    log?.info?.(
      "TOOLS",
      `Converted ${webSearchFallbackPlan.convertedToolCount} web_search tool(s) to OmniRoute fallback for ${provider}`
    );
  }
  const noLogEnabled = apiKeyInfo?.noLog === true;
<<<<<<< Updated upstream
  // Consolidate settings reads — fetch once, reuse throughout the request
  const settings = cachedSettings ?? (await getCachedSettings());
  // Opt-in tool-source diagnostics (#1825): summarize the request's tool definitions
  // (count + MCP/hosted/client source breakdown + first names) as a single debug line.
  if (settings.logToolSources === true) {
    const toolSummary = summarizeToolSources((body as { tools?: unknown }).tools);
    if (toolSummary) log?.debug?.("TOOLS", toolSummary);
  }
  // #1311 (opt-in): echo the client-requested alias/combo name in the response `model`
  // field instead of the upstream model, so strict clients (Claude Desktop) that validate
  // response.model === request.model stop rejecting alias/combo requests with a 401.
  const echoModel =
    settings.echoRequestedModelName === true && typeof requestedModel === "string" && requestedModel
      ? requestedModel
      : null;
  const detailedLoggingEnabled =
    !noLogEnabled &&
    (settings.call_log_pipeline_enabled === true ||
      settings.call_log_pipeline_enabled === "1" ||
      settings.call_log_pipeline_enabled === "true");
  const capturePipelineStreamChunks =
    detailedLoggingEnabled && getCallLogPipelineCaptureStreamChunks();
  const skillRequestId = generateRequestId();
  let compressionAnalyticsWritePromise: Promise<void> | null = null;
  // Compression usage-receipt attachment extracted to chatCore/compressionUsageReceipt.ts (#3501);
  // pass the in-flight analytics write + request id so behaviour stays byte-identical.
  const attachCompressionUsageReceiptAfterAnalytics = (
    usage: Record<string, unknown>,
    source: "provider" | "estimated" | "stream"
  ) =>
    attachCompressionUsageReceiptAfterAnalyticsFor(usage, source, {
      pendingWrite: compressionAnalyticsWritePromise,
      skillRequestId,
    });
=======
  const detailedLoggingEnabled = !noLogEnabled && (await isDetailedLoggingEnabled());
  const capturePipelineStreamChunks =
    detailedLoggingEnabled && getCallLogPipelineCaptureStreamChunks();
  const skillRequestId = generateRequestId();
>>>>>>> Stashed changes
  const pipelineSessionId =
    (clientRawRequest?.headers && typeof clientRawRequest.headers.get === "function"
      ? clientRawRequest.headers.get("x-omniroute-session-id")
      : getHeaderValueCaseInsensitive(
          clientRawRequest?.headers ?? null,
          "x-omniroute-session-id"
        )) || skillRequestId;
<<<<<<< Updated upstream
  // persistAttemptLogs extracted to chatCore/attemptLogging.ts (#3501); bind the per-request context
  // once so the 16 call sites keep passing only the per-attempt args (byte-identical).
  const persistAttemptLogs = (args: PersistAttemptLogsArgs) =>
    persistAttemptLogsFor(args, {
      provider,
      connectionId,
      model,
      skillRequestId,
      detailedLoggingEnabled,
      reqLogger,
      pendingRequestId,
      clientRawRequest,
      requestedModel,
      credentials,
      startTime,
      body,
=======
  const persistAttemptLogs = ({
    status,
    tokens,
    responseBody,
    error,
    providerRequest,
    providerResponse,
    clientResponse,
    claudeCacheMeta,
    claudeCacheUsageMeta,
    cacheSource,
  }: {
    status: number;
    tokens?: unknown;
    responseBody?: unknown;
    error?: string | null;
    providerRequest?: unknown;
    providerResponse?: unknown;
    clientResponse?: unknown;
    claudeCacheMeta?: Record<string, unknown>;
    claudeCacheUsageMeta?: Record<string, unknown>;
    cacheSource?: "upstream" | "semantic";
  }) => {
    const providerWarnings = extractProviderWarnings(
      providerResponse,
      clientResponse,
      responseBody
    );
    if (providerWarnings.length > 0) {
      logAuditEvent({
        action: "provider.warning",
        actor: "system",
        target: [provider, connectionId].filter(Boolean).join(":") || provider || model,
        resourceType: "provider_warning",
        status: "warning",
        requestId: skillRequestId,
        details: {
          provider,
          model,
          connectionId,
          httpStatus: status,
          warnings: providerWarnings,
        },
      });
    }

    const callLogId = generateRequestId();
    const pipelinePayloads = detailedLoggingEnabled ? reqLogger?.getPipelinePayloads?.() : null;

    if (pipelinePayloads) {
      if (providerResponse !== undefined && !pipelinePayloads.providerResponse) {
        pipelinePayloads.providerResponse = providerResponse as Record<string, unknown>;
      }
      if (clientResponse !== undefined) {
        pipelinePayloads.clientResponse = clientResponse as Record<string, unknown>;
      }
      if (error) {
        pipelinePayloads.error = {
          ...(typeof pipelinePayloads.error === "object" && pipelinePayloads.error
            ? (pipelinePayloads.error as Record<string, unknown>)
            : {}),
          message: error,
        };
      }
    }

    saveCallLog({
      id: callLogId,
      method: "POST",
      path: clientRawRequest?.endpoint || "/v1/chat/completions",
      status,
      model,
      requestedModel,
      provider,
      connectionId,
      duration: Date.now() - startTime,
      tokens: tokens || {},
      requestBody: cloneBoundedChatLogPayload(
        attachLogMeta((body as Record<string, unknown>) ?? undefined, {
          claudePromptCache: claudeCacheMeta,
        })
      ),
      responseBody: cloneBoundedChatLogPayload(
        attachLogMeta((responseBody as Record<string, unknown>) ?? undefined, {
          claudePromptCache: claudeCacheMeta
            ? {
                applied: claudeCacheMeta.applied,
                totalBreakpoints: claudeCacheMeta.totalBreakpoints,
                anthropicBeta: claudeCacheMeta.anthropicBeta,
              }
            : null,
          claudePromptCacheUsage: claudeCacheUsageMeta,
        })
      ),
      error: error || null,
>>>>>>> Stashed changes
      sourceFormat,
      targetFormat,
      comboName,
      comboStepId,
      comboExecutionKey,
<<<<<<< Updated upstream
      tokensCompressed,
      apiKeyInfo,
      noLogEnabled,
      correlationId,
    });
=======
      cacheSource: cacheSource === "semantic" ? "semantic" : "upstream",
      apiKeyId: apiKeyInfo?.id || null,
      apiKeyName: apiKeyInfo?.name || null,
      noLog: noLogEnabled,
      pipelinePayloads,
    }).catch(() => {});
  };
>>>>>>> Stashed changes

  // Primary path: merge client model id + alias target so config on either key applies; resolved
  // id wins on same header name. T5 family fallback uses only (nextModel, resolveModelAlias(next))
  // so A-model headers are not sent to B — see buildUpstreamHeadersForExecute.
  const connectionCustomUserAgent =
    credentials?.providerSpecificData &&
    typeof credentials.providerSpecificData === "object" &&
    typeof credentials.providerSpecificData.customUserAgent === "string"
      ? credentials.providerSpecificData.customUserAgent.trim()
      : "";

<<<<<<< Updated upstream
  // Upstream extra-header building extracted to chatCore/upstreamExecuteHeaders.ts (#3501); bind the
  // per-request inputs once and delegate so the existing call sites stay byte-identical.
  const buildUpstreamHeadersForExecute = (modelToCall: string): Record<string, string> =>
    buildUpstreamHeadersForExecuteFor({
      modelToCall,
      effectiveModel,
      provider,
      model,
      resolvedModel,
      sourceFormat,
      connectionCustomUserAgent,
      settings,
    });
=======
  const buildUpstreamHeadersForExecute = (modelToCall: string): Record<string, string> => {
    const upstreamHeaders =
      modelToCall === effectiveModel
        ? {
            ...getModelUpstreamExtraHeaders(provider || "", model || "", sourceFormat),
            ...getModelUpstreamExtraHeaders(provider || "", resolvedModel || "", sourceFormat),
          }
        : (() => {
            const r = resolveModelAlias(modelToCall);
            return {
              ...getModelUpstreamExtraHeaders(provider || "", modelToCall || "", sourceFormat),
              ...getModelUpstreamExtraHeaders(provider || "", r || "", sourceFormat),
            };
          })();

    if (connectionCustomUserAgent) {
      upstreamHeaders["User-Agent"] = connectionCustomUserAgent;
      if ("user-agent" in upstreamHeaders) {
        upstreamHeaders["user-agent"] = connectionCustomUserAgent;
      }
    }

    return upstreamHeaders;
  };
>>>>>>> Stashed changes

  // Default to false unless client explicitly sets stream: true (OpenAI spec compliant)
  const acceptHeader =
    clientRawRequest?.headers && typeof clientRawRequest.headers.get === "function"
      ? clientRawRequest.headers.get("accept") || clientRawRequest.headers.get("Accept")
      : (clientRawRequest?.headers || {})["accept"] || (clientRawRequest?.headers || {})["Accept"];

  // Explicit per-request opt-in/out for the `</think>` close marker
  // (#5312 / #5245): `x-omniroute-thinking-marker: off` suppresses it for
  // reasoning_content-native clients (e.g. Cursor's OpenAI path) that the UA
  // allowlist does not cover; absent the header, the UA policy applies.
  const thinkingMarkerHeader = getHeaderValueCaseInsensitive(
    clientRawRequest?.headers ?? null,
    THINKING_MARKER_HEADER
  );

  const explicitStreamAlias = resolveExplicitStreamAlias(body);

  // Remove non-standard non-stream aliases before provider translation/execution.
  // They are accepted for compatibility at the OmniRoute API boundary only.
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (explicitStreamAlias !== undefined) {
      b.stream = explicitStreamAlias;
    }

    delete b.non_stream;
    delete b.disable_stream;
    delete b.disable_streaming;
    delete b.streaming;
  }

  // Codex /responses/compact is JSON-only: Codex CLI does not send stream=false,
  // so route shape must override the usual Accept/header fallback.
<<<<<<< Updated upstream
  // sourceFormat="claude" applies the Anthropic Messages spec default (stream=false
  // when body omits stream), preventing STREAM_EARLY_EOF on /v1/messages when
  // clients send Accept: */* without an explicit stream flag.
  // providerRequiresStreaming: providers with forceStream:true reject stream:false
  // upstream (HTTP 400); keep streaming so OmniRoute can convert the stream to JSON
  // for the client via handleForcedSSEToJson. (#2081)
  const providerRequiresStreaming = REGISTRY[provider]?.forceStream === true;
  const stream =
    nativeCodexPassthrough && isCompactResponsesEndpoint(endpointPath)
      ? false
      : resolveStreamFlag(body?.stream, acceptHeader, sourceFormat, {
          userAgent: streamUserAgent,
          streamDefaultMode: apiKeyInfo?.streamDefaultMode,
          providerRequiresStreaming,
        });

  // `settings` is already consolidated once near the top of handleChatCore
  // (the "fetch once, reuse" const). A second `const settings` here was a
  // duplicate same-scope declaration that broke the esbuild/tsx transform
  // ("settings has already been declared") and the production build. Reuse it.
  credentials = applyCodexGlobalFastServiceTier(provider, credentials, settings, {
    model: requestedModel,
    body: body && typeof body === "object" ? (body as Record<string, unknown>) : null,
  });
  effectiveServiceTier = resolveEffectiveServiceTier(body);
=======
  const stream =
    nativeCodexPassthrough && isCompactResponsesEndpoint(endpointPath)
      ? false
      : resolveStreamFlag(body?.stream, acceptHeader);
  const settings = await getCachedSettings();
>>>>>>> Stashed changes
  setGeminiThoughtSignatureMode(settings.antigravitySignatureCacheMode);
  const semanticCacheEnabled = settings.semanticCacheEnabled !== false;

  const reqLogger = await createRequestLogger(sourceFormat, targetFormat, model, {
    enabled: detailedLoggingEnabled,
    captureStreamChunks: capturePipelineStreamChunks,
<<<<<<< Updated upstream
    maxStreamChunkBytes: getCallLogPipelineMaxSizeBytes(),
    requestId: pendingRequestId,
    model,
    provider: provider || undefined,
    connectionId: connectionId || credentials?.connectionId || undefined,
=======
>>>>>>> Stashed changes
  });
  const pendingScope = { id: pendingRequestId, model, provider, connectionId: pendingConnId };
  const providerRequestCapture = createPreparedRequestLogger(reqLogger, pendingScope);
  // 0. Log client raw request (before format conversion)
  if (clientRawRequest) {
    reqLogger.logClientRawRequest(
      clientRawRequest.endpoint,
      clientRawRequest.body,
      clientRawRequest.headers
    );
  }

  log?.debug?.("FORMAT", `${sourceFormat} → ${targetFormat} | stream=${stream}`);

  // ── Phase 9.1: Semantic cache check (temp=0, any streaming mode) ──
  // Streaming responses are cached after assembly; cache hits return JSON regardless of stream flag.
  if (semanticCacheEnabled && isCacheableForRead(body, clientRawRequest?.headers)) {
    const signature = generateSignature(
      model,
      body.messages ?? body.input,
      body.temperature,
      body.top_p
    );
    const cached = getCachedResponse(signature);
    if (cached) {
      log?.debug?.("CACHE", `Semantic cache HIT for ${model} (stream=${stream})`);
      reqLogger.logConvertedResponse(cached as Record<string, unknown>);
      const cachedUsage =
        extractUsageFromResponse(cached as Record<string, unknown>, provider) ||
        ((cached as Record<string, unknown>)?.usage as Record<string, unknown> | undefined);
      const cachedCost = cachedUsage ? await calculateCost(provider, model, cachedUsage) : 0;
      persistAttemptLogs({
        status: 200,
        tokens: (cached as Record<string, unknown>)?.usage,
        responseBody: cached,
        providerRequest: null,
        providerResponse: null,
        clientResponse: cached,
        cacheSource: "semantic",
      });
      return {
        success: true,
        response: new Response(JSON.stringify(cached), {
          headers: {
            "Content-Type": "application/json",
            [OMNIROUTE_RESPONSE_HEADERS.cache]: "HIT",
            ...buildOmniRouteResponseMetaHeaders({
              provider,
              model,
              cacheHit: true,
              latencyMs: Date.now() - startTime,
              usage: cachedUsage,
              costUsd: cachedCost,
            }),
          },
        }),
      };
    }
  }

  // ── Common input sanitization (runs for ALL paths including passthrough) ──
  // #994: Normalize between max_output_tokens and max_tokens for universal compatibility.
  // For Responses API targets, max_output_tokens is the canonical field. For others,
  // max_tokens is preferred. We handle normalization here to support passthrough
  // paths where the translator is skipped.
  const prefersResponsesTokenField =
    sourceFormat === FORMATS.OPENAI_RESPONSES || targetFormat === FORMATS.OPENAI_RESPONSES;

  if (prefersResponsesTokenField) {
    if (body.max_output_tokens === undefined) {
      if (body.max_completion_tokens !== undefined) {
        body.max_output_tokens = body.max_completion_tokens;
        delete body.max_completion_tokens;
      } else if (body.max_tokens !== undefined) {
        body.max_output_tokens = body.max_tokens;
        delete body.max_tokens;
      }
    }
  } else if (body.max_output_tokens !== undefined) {
    if (body.max_tokens === undefined) {
      body.max_tokens = body.max_output_tokens;
    }
    delete body.max_output_tokens;
  }

  // #291: Strip empty name fields from messages/input items
  // Upstream providers (OpenAI, Codex) reject name:"" with 400 errors.
  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((msg: Record<string, unknown>) => {
      if (msg.name === "") {
        const { name: _n, ...rest } = msg;
        return rest;
      }
      return msg;
    });
  }
  if (Array.isArray(body.input)) {
    body.input = body.input.map((item: Record<string, unknown>) => {
      if (item.name === "") {
        const { name: _n, ...rest } = item;
        return rest;
      }
      return item;
    });
  }
  // #346/#637: Strip tools with empty name
  // Clients sometimes forward tool definitions with empty names, causing
  // upstream providers to reject with 400 "Invalid 'tools[0].name': empty string."
  if (Array.isArray(body.tools)) {
    body.tools = body.tools.filter((tool: Record<string, unknown>) => {
      // Built-in Responses API tool types (web_search, file_search, computer, etc.)
      // are identified solely by their `type` field and carry no name — preserve them.
      const toolType = typeof tool.type === "string" ? tool.type : "";
      if (toolType && toolType !== "function" && !tool.function && tool.name === undefined) {
        return true;
      }
      const fn = tool.function as Record<string, unknown> | undefined;
      const name = fn?.name ?? tool.name;
      return name && String(name).trim().length > 0;
    });

    // Sanitize OpenAI-format function tool schemas before they reach strict
    // upstream JSON Schema validators (e.g. Moonshot AI behind
    // opencode-go/kimi-k2.6). See toolSchemaSanitizer.ts for the specific bug.
    // sanitizeOpenAITool is safe to call on any input — it no-ops non-function
    // tools (e.g. Responses API built-ins) and non-object values.
    body.tools = body.tools.map((tool) => sanitizeOpenAITool(tool) as (typeof body.tools)[number]);
  }

<<<<<<< Updated upstream
  body = sanitizeChatRequestBody(body, sourceFormat, targetFormat);
  // Per-request opt-out: clients that manage their own context send
  // `x-omniroute-no-memory: true` to skip memory+skills injection (a null owner
  // disables both branches in injectMemoryAndSkills). See PRD-2026-06-19-no-memory-header.
  const memoryOwnerId = isNoMemoryRequested(clientRawRequest?.headers ?? null)
    ? null
    : resolveMemoryOwnerId(apiKeyInfo as Record<string, unknown> | null);
  const injectionResult = await injectMemoryAndSkills({
    body,
    memoryOwnerId,
    provider,
    effectiveModel,
    sourceFormat,
    targetFormat,
    backgroundReason,
    log,
  });
  body = injectionResult.body;
  const memorySettings = injectionResult.memorySettings;
=======
  const memoryOwnerId = resolveMemoryOwnerId(apiKeyInfo as Record<string, unknown> | null);
  const memorySettings = memoryOwnerId
    ? await getMemorySettings().catch(() => DEFAULT_MEMORY_SETTINGS)
    : null;

  if (
    memoryOwnerId &&
    memorySettings &&
    shouldInjectMemory(body as Parameters<typeof shouldInjectMemory>[0], {
      enabled: memorySettings.enabled && memorySettings.maxTokens > 0,
    })
  ) {
    try {
      const memories = await retrieveMemories(
        memoryOwnerId,
        toMemoryRetrievalConfig(memorySettings)
      );
      if (memories.length > 0) {
        const injected = injectMemory(
          body as Parameters<typeof injectMemory>[0],
          memories,
          provider
        );
        body = injected as typeof body;
        log?.debug?.("MEMORY", `Injected ${memories.length} memories for key=${memoryOwnerId}`);
      }
    } catch (memErr) {
      log?.debug?.(
        "MEMORY",
        `Memory injection skipped: ${memErr instanceof Error ? memErr.message : String(memErr)}`
      );
    }
  }

  if (memoryOwnerId && memorySettings?.skillsEnabled) {
    const existingTools = Array.isArray(body.tools) ? body.tools : [];
    const mergedTools = injectSkills({
      provider: getSkillsProviderForFormat(sourceFormat),
      existingTools,
      apiKeyId: memoryOwnerId,
      model: typeof effectiveModel === "string" ? effectiveModel : undefined,
      sourceFormat,
      targetFormat,
      backgroundReason,
      messages: Array.isArray(body.messages)
        ? body.messages
        : Array.isArray(body.input)
          ? body.input
          : undefined,
    });

    if (mergedTools.length > existingTools.length) {
      body = {
        ...body,
        tools: mergedTools,
      };
      log?.debug?.("SKILLS", `Injected ${mergedTools.length - existingTools.length} skills`);
    }
  }

  trace("post_injection", { provider, model });
>>>>>>> Stashed changes

  // Translate request (pass reqLogger for intermediate logging)
  // ── Proactive Context Compression (Phase 4) ──
  // Check if context exceeds 70% of limit and compress proactively before sending to provider.
  // This prevents "prompt too long" errors for large-but-not-full contexts.
<<<<<<< Updated upstream
  const compressionBody = body
    ? adaptBodyForCompression(body as Record<string, unknown>).body
    : null;
  const allMessages = compressionBody?.messages || body?.contents || body?.request?.contents || [];
  let cavemanOutputModeApplied = false;
  let cavemanOutputModeIntensity: string | null = null;
  let preCompressionBody: typeof body | null = null;
  let compressionResponseMeta: string | null = null;
  // Delegated Context Editing (Claude only): captured at the canonical compression
  // settings read below, then threaded to executor.execute() further down. Lives at
  // function scope because the read happens inside the per-message compression block.
  let contextEditingEnabled = false;
  if (body && Array.isArray(allMessages) && allMessages.length > 0) {
    let estimatedTokens = estimateTokens(allMessages);
    const compressionSettingsResult = await resolveCompressionSettings(log);
    const compressionSettings: CompressionConfig | null = compressionSettingsResult.settings;
    const promptCompressionEnabled = compressionSettingsResult.enabled;
    contextEditingEnabled = compressionSettingsResult.contextEditingEnabled;
=======
  const allMessages =
    body?.messages || body?.input || body?.contents || body?.request?.contents || [];
  if (body && Array.isArray(allMessages) && allMessages.length > 0) {
    let estimatedTokens = estimateTokens(JSON.stringify(allMessages));
>>>>>>> Stashed changes

    // --- Modular Compression Pipeline (Phase 1 Lite + Phase 2 Standard/Caveman + Phase 3 Aggressive) ---
    // Runs BEFORE the existing reactive compressContext() to proactively reduce tokens.
    try {
<<<<<<< Updated upstream
      const {
        selectCompressionStrategy,
        selectCompressionPlan,
        enginesMapDerivesStackedPipeline,
        activeComboResolves,
        applyCompressionAsync,
        resolveCacheAwareConfig,
        formatCompressionMeta,
        buildNamedComboLookup,
        formatCompressionAnnotation,
      } = await import("../services/compression/strategySelector.ts");
=======
      const { getCompressionSettings } = await import("../../src/lib/db/compression.ts");
      const { selectCompressionStrategy, applyCompression } =
        await import("../services/compression/strategySelector.ts");
>>>>>>> Stashed changes
      const { trackCompressionStats } = await import("../services/compression/stats.ts");
      let config = await getCompressionSettings();
      let compressionComboKey = comboName ?? null;
<<<<<<< Updated upstream
      let compressionComboApplied = false;
      const applyCompressionComboConfig = (
        compressionCombo: RuntimeCompressionCombo | null,
        routingOverrideIds: string[] = []
      ): boolean => {
        if (!compressionCombo || compressionCombo.pipeline.length === 0) return false;
        const comboLanguagePacks = [
          ...new Set(
            compressionCombo.languagePacks
              .map((pack) => pack.trim())
              .filter((pack) => pack.length > 0)
          ),
        ];
        const comboOutputIntensity = (
          ["lite", "full", "ultra"].includes(compressionCombo.outputModeIntensity)
            ? compressionCombo.outputModeIntensity
            : (config.cavemanOutputMode?.intensity ?? "full")
        ) as "lite" | "full" | "ultra";
        const comboDefaultLanguage =
          comboLanguagePacks.find((pack) => pack === config.languageConfig?.defaultLanguage) ??
          comboLanguagePacks[0] ??
          config.languageConfig?.defaultLanguage ??
          "en";
        const comboOverrides = { ...(config.comboOverrides ?? {}) };
        for (const id of routingOverrideIds) {
          if (id) comboOverrides[id] = "stacked";
        }
        config = {
          ...config,
          compressionComboId: compressionCombo.id,
          stackedPipeline: compressionCombo.pipeline,
          languageConfig: {
            ...(config.languageConfig ?? {
              enabled: false,
              defaultLanguage: "en",
              autoDetect: true,
              enabledPacks: ["en"],
            }),
            enabled: true,
            defaultLanguage: comboDefaultLanguage,
            enabledPacks:
              comboLanguagePacks.length > 0
                ? comboLanguagePacks
                : (config.languageConfig?.enabledPacks ?? ["en"]),
          },
          cavemanOutputMode: {
            ...(config.cavemanOutputMode ?? {
              enabled: false,
              intensity: "full",
              autoClarity: true,
            }),
            enabled: compressionCombo.outputMode,
            intensity: comboOutputIntensity,
          },
          comboOverrides,
        };
        compressionComboApplied = true;
        return true;
      };
=======
>>>>>>> Stashed changes
      if (isCombo && comboName) {
        try {
          const { getComboByName } = await import("../../src/lib/localDb");
          let comboConfig = await getComboByName(comboName);
          if (!comboConfig && comboName.startsWith("combo/")) {
            comboConfig = await getComboByName(comboName.substring(6));
          }
          const comboRuntimeConfig =
            comboConfig?.config && typeof comboConfig.config === "object"
              ? (comboConfig.config as Record<string, unknown>)
              : {};
          const comboMode =
            typeof comboRuntimeConfig.compressionMode === "string"
              ? comboRuntimeConfig.compressionMode
              : typeof comboConfig?.compressionOverride === "string"
                ? comboConfig.compressionOverride
                : null;
          if (
            comboMode === "off" ||
            comboMode === "lite" ||
            comboMode === "standard" ||
            comboMode === "aggressive" ||
            comboMode === "ultra"
          ) {
            config = {
              ...config,
              comboOverrides: {
                ...(config.comboOverrides ?? {}),
                ...(comboName ? { [comboName]: comboMode } : {}),
                ...(comboConfig?.id ? { [comboConfig.id]: comboMode } : {}),
              },
            };
            compressionComboKey = comboName;
          }
        } catch (err) {
          log?.debug?.(
            "COMPRESSION",
            "Combo compression override lookup skipped: " +
              (err instanceof Error ? err.message : String(err))
          );
        }
      }
<<<<<<< Updated upstream
      let namedCombos: Record<string, CompressionPipelineStep[]> = {};
      try {
        const { listCompressionCombos } = await import("../../src/lib/db/compressionCombos.ts");
        namedCombos = buildNamedComboLookup(listCompressionCombos());
      } catch (err) {
        log?.debug?.(
          "COMPRESSION",
          "Named combos load skipped: " + (err instanceof Error ? err.message : String(err))
        );
      }
      // Phase 3: per-request override. Unknown values fall through in the resolver (never error).
      const compressionHeader = resolveCompressionHeader(clientRawRequest?.headers ?? null);
      if (compressionHeader) {
        log?.debug?.("COMPRESSION", `x-omniroute-compression header: ${compressionHeader}`);
      }
      const modeBeforeOutputTransform = selectCompressionStrategy(
        config,
        compressionComboKey,
        estimatedTokens,
        body as Record<string, unknown>,
        { provider, targetFormat, model: effectiveModel },
        namedCombos,
        compressionHeader
      );
      if (
        modeBeforeOutputTransform === "stacked" &&
        !compressionComboApplied &&
        !config.compressionComboId &&
        isBuiltinStackedPipeline(config.stackedPipeline) &&
        // Don't let the legacy default combo override a panel-configured engines map: when the
        // operator's explicit engines derive their own stacked pipeline, that pipeline (applied
        // below from compressionPlan.stackedPipeline) is authoritative. Legacy/backfilled
        // installs (enginesExplicit false) still fall through to the seeded default combo.
        !enginesMapDerivesStackedPipeline(config) &&
        // Never let the legacy seeded default combo shadow the operator's active profile.
        !activeComboResolves(config, namedCombos)
      ) {
        try {
          const { getDefaultCompressionCombo } =
            await import("../../src/lib/db/compressionCombos.ts");
          const defaultCompressionCombo = getDefaultCompressionCombo();
          if (
            isStackedCompressionCombo(defaultCompressionCombo as RuntimeCompressionCombo | null) &&
            applyCompressionComboConfig(defaultCompressionCombo as RuntimeCompressionCombo | null)
          ) {
            log?.debug?.(
              "COMPRESSION",
              `Default compression combo applied: ${defaultCompressionCombo?.id}`
            );
          }
        } catch (err) {
          log?.debug?.(
            "COMPRESSION",
            "Default compression combo lookup skipped: " +
              (err instanceof Error ? err.message : String(err))
          );
        }
      }
      // Phase 4A: unified output styles (supersedes cavemanOutputMode via the back-compat shim).
      let outputStyleResult:
        import("../services/compression/outputStyles/apply.ts").OutputStylesResult | null = null;
      if (config.enabled) {
        try {
          const { resolveOutputStyleSelection } =
            await import("../services/compression/outputStyles/backCompat.ts");
          const selection = resolveOutputStyleSelection(config);
          if (selection.length > 0) {
            const { applyOutputStyles } =
              await import("../services/compression/outputStyles/apply.ts");
            const outputStyleLanguage =
              config.languageConfig?.enabled === true
                ? config.languageConfig.defaultLanguage
                : "en";
            outputStyleResult = applyOutputStyles(
              body as Parameters<typeof applyOutputStyles>[0],
              selection,
              outputStyleLanguage
            );
            if (outputStyleResult.applied) {
              body = outputStyleResult.body as typeof body;
              cavemanOutputModeApplied = true;
              cavemanOutputModeIntensity =
                outputStyleResult.appliedStyles?.map((s) => `${s.id}:${s.level}`).join(",") ?? null;
              estimatedTokens = estimateTokens(body?.messages ?? body?.input ?? []);
              log?.debug?.("COMPRESSION", "Output styles applied");
            } else if (
              outputStyleResult.skippedReason &&
              outputStyleResult.skippedReason !== "no_styles"
            ) {
              log?.debug?.(
                "COMPRESSION",
                `Output styles skipped: ${outputStyleResult.skippedReason}`
              );
            }
          }
        } catch (err) {
          log?.debug?.(
            "COMPRESSION",
            "Output styles skipped: " + (err instanceof Error ? err.message : String(err))
          );
        }
      }
=======
>>>>>>> Stashed changes
      const compressionInputBody = body as Record<string, unknown>;
      // Adaptive context-budget (Sub-project C): model context window + request max_tokens drive
      // the budget target. getTokenLimit is already imported; provider/effectiveModel resolved above.
      const adaptiveModelContextLimit =
        provider && effectiveModel ? getTokenLimit(provider, effectiveModel) : null;
      const requestMaxTokens =
        typeof (compressionInputBody as Record<string, unknown>)?.max_tokens === "number"
          ? ((compressionInputBody as Record<string, unknown>).max_tokens as number)
          : null;
      let adaptiveTelemetry:
        import("../services/compression/adaptiveCompression/types.ts").AdaptiveTelemetry | null =
        null;
      const compressionPlan = selectCompressionPlan(
        config,
        compressionComboKey,
        estimatedTokens,
        compressionInputBody,
        { provider, targetFormat, model: effectiveModel },
        namedCombos,
        compressionHeader,
        {
          modelContextLimit: adaptiveModelContextLimit,
          requestMaxTokens: requestMaxTokens,
          onAdaptive: (t) => {
            adaptiveTelemetry = t;
          },
        }
      );
<<<<<<< Updated upstream
      const mode = compressionPlan.mode as CompressionConfig["defaultMode"];
      if (adaptiveTelemetry && adaptiveTelemetry.fit === false) {
        log?.warn?.(
          "COMPRESSION",
          `adaptive budget-exceeded: target=${adaptiveTelemetry.target} headroomAfter=${adaptiveTelemetry.headroomAfter} stages=${adaptiveTelemetry.stagesApplied.join(",")} (best-effort plan sent, content preserved)`
        );
      }
      compressionResponseMeta = formatCompressionMeta(compressionPlan);
      // When the per-engine toggle map derives a stacked pipeline (and no named/routing
      // combo already set config.stackedPipeline), feed that derived pipeline through so
      // applyCompressionAsync (which reads config.stackedPipeline for stacked mode) runs the
      // engines the operator actually toggled on instead of the built-in rtk+caveman default.
      if (
        mode === "stacked" &&
        compressionPlan.stackedPipeline.length > 0 &&
        !compressionComboApplied &&
        !config.compressionComboId
      ) {
        config = {
          ...config,
          stackedPipeline: compressionPlan.stackedPipeline as CompressionConfig["stackedPipeline"],
        };
      }
      let compressionAnalyticsRecorded = false;
      if (mode !== "off") {
        // #3890: in a caching context, never compress the system prompt (cacheable prefix)
        // even if the operator disabled preserveSystemPrompt — honors the cache-aware flag
        // that selectCompressionStrategy can only partially apply via the mode string.
        const cacheCtx = { provider, targetFormat, model: effectiveModel };
        const compressionConfig = resolveCacheAwareConfig(config, compressionInputBody, cacheCtx);
        const result = await applyCompressionAsync(compressionInputBody, mode, {
          model: effectiveModel,
          config: compressionConfig,
          cachingContext: cacheCtx,
          principalId: apiKeyInfo?.id ? String(apiKeyInfo.id) : undefined,
          // F3.3: stream per-engine progress live (best-effort) before compression.completed.
          onEngineStep: (s) => {
            try {
              const stepPayload = {
                requestId: traceId,
                comboId: null,
                mode,
                stepIndex: s.stepIndex,
                totalSteps: s.totalSteps,
                engine: s.engine,
                state: s.state,
                originalTokens: s.originalTokens,
                compressedTokens: s.compressedTokens,
                savingsPercent: s.savingsPercent,
                ...(s.durationMs !== undefined ? { durationMs: s.durationMs } : {}),
                timestamp: Date.now(),
              };
              emit("compression.step", stepPayload);
              void forwardDashboardEventToLiveWs("compression.step", stepPayload);
            } catch (_stepErr) {
              // best-effort live event — never fail the request
            }
          },
        });
        if (result.stats) {
          const annotation = formatCompressionAnnotation(result.stats);
          if (annotation) {
            compressionResponseMeta = `${compressionResponseMeta}; ${annotation}`;
          }
          if (result.compressed) {
            body = result.body as typeof body;
            estimatedTokens = result.stats.compressedTokens;
            tokensCompressed = Math.max(
              0,
              result.stats.originalTokens - result.stats.compressedTokens
            );
          }

          // Fire-and-forget: emit live compression event for dashboard (U5).
          // Guard: only emit when compression actually ran and produced stats.
          if (result.compressed && result.stats) {
            try {
              const compressionCompletedPayload = {
                requestId: traceId,
                comboId: result.stats.compressionComboId ?? null,
                mode,
                originalTokens: result.stats.originalTokens,
                compressedTokens: result.stats.compressedTokens,
                savingsPercent: result.stats.savingsPercent,
                // Single-engine modes leave engineBreakdown empty; synthesize a 1-entry
                // breakdown so the studio shows a real engine node instead of an empty pipeline.
                engineBreakdown: ensureEngineBreakdown(result.stats),
                validationWarnings: result.stats.validationWarnings,
                fallbackApplied: result.stats.fallbackApplied,
                ...(adaptiveTelemetry ? { adaptive: adaptiveTelemetry } : {}),
                timestamp: Date.now(),
              };
              emit("compression.completed", compressionCompletedPayload);
              void forwardDashboardEventToLiveWs(
                "compression.completed",
                compressionCompletedPayload
              );
            } catch (_emitErr) {
              // never propagate into the hot path — but log like the sibling
              // fire-and-forget blocks so a throwing event bus isn't fully silent.
=======
      if (mode !== "off") {
        const result = applyCompression(compressionInputBody, mode, {
          model: effectiveModel,
          config,
        });
        if (result.compressed && result.stats) {
          body = result.body as typeof body;
          estimatedTokens = result.stats.compressedTokens;
          trackCompressionStats(result.stats);
          void (async () => {
            try {
              const { insertCompressionAnalyticsRow } =
                await import("../../src/lib/db/compressionAnalytics.ts");
              insertCompressionAnalyticsRow({
                timestamp: new Date().toISOString(),
                combo_id: comboName ?? null,
                provider: provider ?? null,
                mode,
                original_tokens: result.stats.originalTokens,
                compressed_tokens: result.stats.compressedTokens,
                tokens_saved: Math.max(
                  0,
                  result.stats.originalTokens - result.stats.compressedTokens
                ),
                duration_ms: result.stats.durationMs ?? null,
                request_id: skillRequestId,
              });
            } catch (err) {
>>>>>>> Stashed changes
              log?.debug?.(
                "COMPRESSION",
                "Compression analytics write skipped: " +
                  (err instanceof Error ? err.message : String(err))
              );
            }
<<<<<<< Updated upstream
          }

          if (result.compressed || result.stats.fallbackApplied || cavemanOutputModeApplied) {
            trackCompressionStats(result.stats);
            compressionAnalyticsRecorded = true;
            compressionAnalyticsWritePromise = writeCompressionAnalytics({
              stats: result.stats,
              provider,
              effectiveModel,
              effectiveServiceTier,
              comboName,
              mode,
              compressionComboId: config.compressionComboId,
              skillRequestId,
              cavemanOutputModeApplied,
              cavemanOutputModeIntensity,
              log,
            });
          } else {
            // Compression was attempted (mode active, engines ran) but produced no
            // recordable saving — e.g. a Stacked RTK→Caveman pipeline on already-compact
            // context. Record a skip row so analytics can distinguish "ran but saved
            // nothing" from "never ran" instead of dropping it silently (#4268).
            compressionAnalyticsRecorded = true;
            compressionAnalyticsWritePromise = writeCompressionSkip(
              {
                stats: result.stats,
                provider,
                effectiveModel,
                effectiveServiceTier,
                comboName,
                mode,
                compressionComboId: config.compressionComboId,
                skillRequestId,
                cavemanOutputModeApplied,
                cavemanOutputModeIntensity,
                log,
              },
              "no_savings"
            );
          }

          if (result.compressed) {
            recordCompressionCacheStats({
              compressionInputBody,
              provider,
              targetFormat,
              effectiveModel,
              mode,
              stats: result.stats,
              log,
            });
            log?.info?.(
              "COMPRESSION",
              `Prompt compressed (${mode}): ${result.stats.originalTokens} -> ${result.stats.compressedTokens} tokens (${result.stats.savingsPercent}% saved, techniques: ${result.stats.techniquesUsed.join(",")})`
            );
          }
        }
      }
      if (cavemanOutputModeApplied && !compressionAnalyticsRecorded) {
        compressionAnalyticsWritePromise = writeCavemanOutputAnalytics({
          comboName,
          provider,
          compressionComboId: config.compressionComboId,
          estimatedTokens,
          skillRequestId,
          cavemanOutputModeIntensity,
          log,
        });
      }
      emitOutputStyleTelemetry({
        outputStyleResult,
        skillRequestId,
        traceId,
        effectiveModel,
        provider,
        compressionComboId: config.compressionComboId,
        estimatedTokens,
        log,
      });
=======
          })();
          void (async () => {
            try {
              const { detectCachingContext } =
                await import("../services/compression/cachingAware.ts");
              const { recordCacheStats } =
                await import("../../src/lib/db/compressionCacheStats.ts");
              const cacheContext = detectCachingContext(compressionInputBody, {
                provider,
                targetFormat,
                model: effectiveModel,
              });
              const tokensSavedCompression = Math.max(
                0,
                result.stats.originalTokens - result.stats.compressedTokens
              );
              recordCacheStats({
                provider: cacheContext.provider ?? provider ?? "unknown",
                model: effectiveModel ?? "",
                compressionMode: mode,
                cacheControlPresent: cacheContext.hasCacheControl,
                estimatedCacheHit: cacheContext.hasCacheControl && cacheContext.isCachingProvider,
                tokensSavedCompression,
                tokensSavedCaching: 0,
                netSavings: tokensSavedCompression,
              });
            } catch (err) {
              log?.debug?.(
                "COMPRESSION",
                "Compression cache stats write skipped: " +
                  (err instanceof Error ? err.message : String(err))
              );
            }
          })();
          log?.info?.(
            "COMPRESSION",
            `Prompt compressed (${mode}): ${result.stats.originalTokens} -> ${result.stats.compressedTokens} tokens (${result.stats.savingsPercent}% saved, techniques: ${result.stats.techniquesUsed.join(",")})`
          );
        }
      }
>>>>>>> Stashed changes
    } catch (err) {
      log?.warn?.(
        "COMPRESSION",
        "Compression pipeline error (non-fatal): " +
          (err instanceof Error ? err.message : String(err))
      );
    }
    // --- End Modular Compression Pipeline ---

    let contextLimit = getTokenLimit(provider, effectiveModel);

    if (isCombo && comboName) {
      log?.info?.("CONTEXT", `Attempting to resolve combo limits for comboName=${comboName}`);
      try {
        const { getComboByName } = await import("../../src/lib/localDb");
        const { parseModel } = await import("../services/model.ts");
        const { resolveComboTargets } = await import("../services/combo.ts");
        let comboConfig = await getComboByName(comboName);
        if (!comboConfig && comboName.startsWith("combo/")) {
          comboConfig = await getComboByName(comboName.substring(6));
        }
        if (comboConfig) {
          const allCombosData = await getCombosCached();
          const targets = resolveComboTargets(comboConfig, allCombosData);
          const limits = targets.map((t: { modelStr?: string }) => {
            const parsed = parseModel(t.modelStr);
            return getTokenLimit(parsed.provider, parsed.model);
          });
          if (limits.length > 0) {
            contextLimit = Math.min(...limits);
            log?.info?.("CONTEXT", `Combo min limit: ${contextLimit}`);
          }
        }
      } catch (err) {
        log?.warn?.("CONTEXT", "Failed to resolve combo limits for compression: " + err);
      }
    }

    const COMPRESSION_THRESHOLD = 0.7;
    let reservedTokens = 0;
    if (Array.isArray(body.tools)) {
      reservedTokens = estimateTokens(JSON.stringify(body.tools));
    }
    const threshold = Math.max(
      1,
      Math.floor((Math.max(1, contextLimit) - reservedTokens) * COMPRESSION_THRESHOLD)
    );

    log?.debug?.(
      "CONTEXT",
      `Checking compression: ${estimatedTokens} tokens vs ${threshold} threshold (${contextLimit} limit, ${reservedTokens} reserved)`
    );

    if (estimatedTokens > threshold) {
      log?.info?.(
        "CONTEXT",
        `Proactive compression triggered: ${estimatedTokens} tokens > ${threshold} threshold (${contextLimit} limit)`
      );

      const compressionResult = compressContext(body, {
        provider,
        model: effectiveModel,
        maxTokens: threshold,
        reserveTokens: 0,
      });

      if (compressionResult.compressed) {
        body = compressionResult.body;
        const stats = compressionResult.stats;
        const layersInfo =
          stats && "layers" in stats && Array.isArray(stats.layers)
            ? ` (layers: ${stats.layers.map((l: { name: string }) => l.name).join(", ")})`
            : "";

        log?.info?.(
          "CONTEXT",
          `Context compressed: ${stats.original} → ${stats.final} tokens${layersInfo}`
        );

        logAuditEvent({
          action: "context.proactive_compression",
          actor: apiKeyInfo?.name || "system",
          target: connectionId || provider || "chat",
          details: {
            provider,
            model: effectiveModel,
            original_tokens: stats.original,
            final_tokens: stats.final,
            layers: "layers" in stats ? stats.layers : undefined,
          },
        });
      } else {
        log?.debug?.("CONTEXT", `Compression not applied: context already fits within target`);
      }
    }
  } else {
    log?.debug?.(
      "CONTEXT",
      `Skipping compression check: body=${!!body}, hasMessages=${Array.isArray(allMessages)}`
    );
  }

  let translatedBody = body;
  const isClaudePassthrough = sourceFormat === FORMATS.CLAUDE && targetFormat === FORMATS.CLAUDE;
  const isClaudeCodeCompatible = isClaudeCodeCompatibleProvider(provider);
  const upstreamStream = stream || isClaudeCodeCompatible;
  let ccSessionId: string | null = null;
  const stripTypes = getStripTypesForProviderModel(provider || "", model || "");

  if (Array.isArray(translatedBody?.messages) && stripTypes.length > 0) {
    const stripResult = stripIncompatibleMessageContent(translatedBody.messages, stripTypes);
    if (stripResult.removedParts > 0) {
      translatedBody = {
        ...translatedBody,
        messages: stripResult.messages,
      };
      log?.warn?.(
        "CONTENT",
        `Stripped ${stripResult.removedParts} incompatible content part(s) for ${provider}/${model}`
      );
    }
  }

  // Determine if we should preserve client-side cache_control headers
  // Fetch settings from DB to get user preference
  const cacheControlMode = await getCacheControlSettings().catch(() => "auto" as const);
  const preserveCacheControl = shouldPreserveCacheControl({
    userAgent,
    isCombo,
    comboStrategy,
    targetProvider: provider,
    targetFormat,
    settings: { alwaysPreserveClientCache: cacheControlMode },
  });

  if (preserveCacheControl) {
    log?.debug?.(
      "CACHE",
      `Preserving client cache_control (client=${userAgent?.substring(0, 20)}, combo=${isCombo}, strategy=${comboStrategy}, provider=${provider})`
    );
  }

<<<<<<< Updated upstream
  // extractSystemMessagesToBody + normalizeClaudeUpstreamMessages extracted to
  // chatCore/claudeUpstreamMessages.ts (#3501); bind `log` once so the call sites stay byte-identical.
  const normalizeClaudeUpstreamMessages = (
    payload: Record<string, unknown>,
    options?: { preserveToolResultBlocks?: boolean }
  ) => normalizeClaudeUpstreamMessagesFor(payload, options, log);
=======
  type ClaudeContentBlock = Record<string, unknown>;
  type ClaudeMessage = {
    role?: unknown;
    content?: unknown;
  };

  const normalizeClaudeUpstreamMessages = (
    payload: Record<string, unknown>,
    options?: { preserveToolResultBlocks?: boolean }
  ) => {
    const preserveToolResultBlocks = options?.preserveToolResultBlocks === true;
    if (!Array.isArray(payload.messages)) return;
    let messages = payload.messages as ClaudeMessage[];

    // Extract system role messages (Issue #1797)
    const systemMessages = messages.filter((m) => m.role === "system");
    if (systemMessages.length > 0) {
      const extraBlocks: ClaudeContentBlock[] = [];
      for (const sm of systemMessages) {
        if (typeof sm.content === "string" && sm.content.length > 0) {
          extraBlocks.push({ type: "text", text: sm.content });
        } else if (Array.isArray(sm.content)) {
          for (const block of sm.content as ClaudeContentBlock[]) {
            if (block?.type === "text" && typeof block.text === "string" && block.text.length > 0) {
              extraBlocks.push(block);
            }
          }
        }
      }
      if (extraBlocks.length > 0) {
        const existingSystem = payload.system;
        if (typeof existingSystem === "string" && existingSystem.length > 0) {
          payload.system = [{ type: "text", text: existingSystem }, ...extraBlocks];
        } else if (Array.isArray(existingSystem)) {
          payload.system = [...(existingSystem as ClaudeContentBlock[]), ...extraBlocks];
        } else {
          payload.system = extraBlocks;
        }
      }
      messages = messages.filter((m) => m.role !== "system");
      payload.messages = messages;
    }

    // Anthropic rejects empty text blocks in native Messages payloads.
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.filter(
          (block: ClaudeContentBlock) =>
            block.type !== "text" || (typeof block.text === "string" && block.text.length > 0)
        );
      }
    }

    // Normalize unsupported content types without reintroducing the Claude -> OpenAI round-trip.
    for (const msg of messages) {
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      msg.content = (msg.content as ClaudeContentBlock[]).flatMap((block: ClaudeContentBlock) => {
        if (
          block.type === "text" ||
          block.type === "image_url" ||
          block.type === "image" ||
          block.type === "file_url" ||
          block.type === "file" ||
          block.type === "document"
        ) {
          const fileData = (block.file_url ?? block.file ?? block.document) as
            | Record<string, unknown>
            | undefined;
          if (
            (block.type === "file" || block.type === "document") &&
            !fileData?.url &&
            !fileData?.data
          ) {
            const fileContent =
              (block.file as ClaudeContentBlock)?.content ??
              (block.file as ClaudeContentBlock)?.text ??
              block.content ??
              block.text;
            const fileName =
              (block.file as Record<string, unknown>)?.name ?? block.name ?? "attachment";
            if (typeof fileContent === "string" && fileContent.length > 0) {
              return [{ type: "text", text: `[${fileName}]\n${fileContent}` }];
            }
          }
          return [block];
        }

        if (block.type === "tool_result") {
          if (preserveToolResultBlocks) {
            return [block];
          }
          const toolId = block.tool_use_id ?? block.id ?? "unknown";
          const resultContent = block.content ?? block.text ?? block.output ?? "";
          const resultText =
            typeof resultContent === "string"
              ? resultContent
              : Array.isArray(resultContent)
                ? resultContent
                    .filter((c: Record<string, unknown>) => c.type === "text")
                    .map((c: Record<string, unknown>) => c.text)
                    .join("\n")
                : JSON.stringify(resultContent);
          if (resultText.length > 0) {
            return [{ type: "text", text: `[Tool Result: ${toolId}]\n${resultText}` }];
          }
          return [];
        }

        log?.debug?.("CONTENT", `Dropped unsupported content part type="${block.type}"`);
        return [];
      });
    }
  };
>>>>>>> Stashed changes

  try {
    if (nativeCodexPassthrough) {
      translatedBody = { ...body, _nativeCodexPassthrough: true };
      log?.debug?.("FORMAT", "native codex passthrough enabled");
    } else if (isClaudeCodeCompatible) {
      let normalizedForCc = { ...body };

      // Claude Code-compatible providers expect Anthropic Messages-shaped payloads,
      // but we extract only role/text/max_tokens/effort from an OpenAI-like view first.
      if (sourceFormat !== FORMATS.OPENAI) {
        const normalizeToolCallId = getModelNormalizeToolCallId(
          provider || "",
          model || "",
          sourceFormat
        );
        const preserveDeveloperRole = getModelPreserveOpenAIDeveloperRole(
          provider || "",
          model || "",
          sourceFormat
        );
        normalizedForCc = translateRequest(
          sourceFormat,
          FORMATS.OPENAI,
          model,
          { ...body },
          stream,
          credentials,
          provider,
          reqLogger,
          { normalizeToolCallId, preserveDeveloperRole, preserveCacheControl }
        );
      }

      ccSessionId = resolveClaudeCodeCompatibleSessionId(clientRawRequest?.headers);
      const ccRequestDefaults = getClaudeCodeCompatibleRequestDefaults(
        credentials?.providerSpecificData
      );
      translatedBody = buildClaudeCodeCompatibleRequest({
        sourceBody: body,
        normalizedBody: normalizedForCc,
        claudeBody: sourceFormat === FORMATS.CLAUDE ? body : null,
        model,
        stream: upstreamStream,
        sessionId: ccSessionId,
        cwd: process.cwd(),
        now: new Date(),
        preserveCacheControl,
<<<<<<< Updated upstream
        preserveClaudeMessages: sourceFormat === FORMATS.CLAUDE && isClaudeCodeSemanticPassthrough,
        summarizeThinking: ccRequestDefaults.summarizeThinking === true,
=======
>>>>>>> Stashed changes
      });
      log?.debug?.("FORMAT", "claude-code-compatible bridge enabled");
    } else if (isClaudePassthrough) {
      // Pure passthrough: forward the body as-is without OpenAI round-trip.
      // The Claude→OpenAI→Claude double translation was lossy and corrupted
      // payloads at high context (150+ msgs, 100+ tools). Fix: #1359.
      // Claude Code sends well-formed Messages API payloads — trust them
      // regardless of combo strategy or cache_control settings.
      translatedBody = { ...body };
      translatedBody._disableToolPrefix = true;
      normalizeClaudeUpstreamMessages(translatedBody, { preserveToolResultBlocks: true });

      log?.debug?.("FORMAT", `claude passthrough (preserveCache=${preserveCacheControl})`);

      // Fix #1719: Strip output_config.format for non-Anthropic Claude-compatible providers.
      // Third-party Claude endpoints (MiniMax, DeepSeek via aggregators) reject this field
      // with 400 errors since they don't support Anthropic's structured output / json_schema.
      if (
        provider !== "claude" &&
        translatedBody.output_config &&
        typeof translatedBody.output_config === "object"
      ) {
        const oc = translatedBody.output_config as Record<string, unknown>;
        delete oc.format;
        if (Object.keys(oc).length === 0) {
          delete translatedBody.output_config;
        }
      }
    } else {
      translatedBody = { ...body };

      // Issue #199 + #618: Always disable tool name prefix in Claude passthrough.
      // The proxy_ prefix was designed for OpenAI→Claude translation to avoid
      // conflicts with Claude OAuth tools, but in the passthrough path the tools
      // are already in Claude format. Applying the prefix turns "Bash" into
      // "proxy_Bash", which Claude rejects ("No such tool available: proxy_Bash").
      if (targetFormat === FORMATS.CLAUDE) {
        translatedBody._disableToolPrefix = true;
        normalizeClaudeUpstreamMessages(translatedBody);
      }

      // OpenAI-compatible providers only support function tools.
      // Non-function tool types (computer, mcp, web_search, custom, etc.) are handled:
      //   - tools with a name → converted to function format in-place before translation
      //   - tools without a name AND without .function → dropped (unconvertible)
      // This must happen before translateRequest, which validates and throws on unknown types.
      if (provider?.startsWith("openai-compatible-") && Array.isArray(translatedBody.tools)) {
        const before = (translatedBody.tools as unknown[]).length;
        translatedBody.tools = (translatedBody.tools as Record<string, unknown>[])
          .filter((t) => !t.type || t.type === "function" || !!t.function || !!t.name)
          .map((t) => {
            if (!t.type || t.type === "function" || t.function) return t;
            // Named non-function tool: normalise to function format so the translator
            // does not throw on the unknown type.
            return {
              type: "function",
              function: {
                name: t.name,
                ...(t.description !== undefined ? { description: t.description } : {}),
                ...(t.parameters !== undefined || t.input_schema !== undefined
                  ? { parameters: t.parameters ?? t.input_schema ?? {} }
                  : {}),
                ...(t.strict !== undefined ? { strict: t.strict } : {}),
              },
            };
          });
        const dropped = before - (translatedBody.tools as unknown[]).length;
        if (dropped > 0) {
          log?.debug?.(
            "TOOLS",
            `Dropped ${dropped} unconvertible tool(s) for openai-compatible provider`
          );
        }
      }

      const normalizeToolCallId = getModelNormalizeToolCallId(
        provider || "",
        model || "",
        sourceFormat
      );
      const preserveDeveloperRole = getModelPreserveOpenAIDeveloperRole(
        provider || "",
        model || "",
        sourceFormat
      );
      translatedBody = translateRequest(
        sourceFormat,
        targetFormat,
        model,
        translatedBody,
        stream,
        credentials,
        provider,
        reqLogger,
        { normalizeToolCallId, preserveDeveloperRole, preserveCacheControl }
      );
    }
  } catch (error) {
    const parsedStatus = Number(error?.statusCode);
    const statusCode =
      Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus <= 599
        ? parsedStatus
        : HTTP_STATUS.SERVER_ERROR;
    const message = error?.message || "Invalid request";
    const errorType = typeof error?.errorType === "string" ? error.errorType : null;

    log?.warn?.("TRANSLATE", `Request translation failed: ${message}`);

    if (errorType) {
      return {
        success: false,
        status: statusCode,
        error: message,
        response: new Response(
          JSON.stringify({
            error: {
              message,
              type: errorType,
              code: errorType,
            },
          }),
          {
            status: statusCode,
            headers: {
              "Content-Type": "application/json",
            },
          }
        ),
      };
    }

    return createErrorResult(statusCode, message);
  }

  trace("post_translation");

  // Kiro: sanitize tool schemas before dispatch. Kiro returns 400 "Improperly
  // formed request" for unsupported JSON-Schema keywords (anyOf/$ref/if-then,
  // etc.) and tool names >64 chars. Strip those keys and hash-truncate long
  // names; merge the truncated→original nameMap into the existing
  // `_toolNameMap` so kiro-to-openai maps streamed tool-call names back (#1375).
  if (targetFormat === FORMATS.KIRO) {
    const kiroTools =
      translatedBody?.conversationState?.currentMessage?.userInputMessage?.userInputMessageContext
        ?.tools;
    if (kiroTools) {
      const { tools: sanitizedKiroTools, nameMap: kiroNameMap } = sanitizeKiroTools(kiroTools);
      translatedBody.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools =
        sanitizedKiroTools;
      if (kiroNameMap.size > 0) {
        const existing =
          translatedBody._toolNameMap instanceof Map
            ? translatedBody._toolNameMap
            : new Map<string, string>();
        kiroNameMap.forEach((original, truncated) => existing.set(truncated, original));
        translatedBody._toolNameMap = existing;
      }
    }
  }

  // Claude: strict Anthropic-compatible gateways (e.g. MiniMax) reject tool
  // definitions that omit the required `type` discriminator with HTTP 400. Default
  // a missing `type` to "custom" before dispatch, mirroring Anthropic's own
  // inference, so legacy Claude-format tool payloads survive strict gateways (#2195).
  if (targetFormat === FORMATS.CLAUDE && Array.isArray(translatedBody.tools)) {
    translatedBody.tools = defaultClaudeToolType(
      translatedBody.tools
    ) as typeof translatedBody.tools;
  }

  // Extract toolNameMap for response translation (Claude OAuth)
  const translatedToolNameMap = translatedBody._toolNameMap;
  const nativeClaudeToolNameMap = isClaudePassthrough
    ? buildClaudePassthroughToolNameMap(body)
    : null;
  const toolNameMap =
    translatedToolNameMap instanceof Map && translatedToolNameMap.size > 0
      ? translatedToolNameMap
      : nativeClaudeToolNameMap;
  delete translatedBody._toolNameMap;
  delete translatedBody._disableToolPrefix;

  // Update model in body — use resolved alias so the provider gets the correct model ID (#472)
  // Strip provider/alias prefix if it exactly matches the routing prefix so upstream receives the raw model name (#1261)
  let finalModelToUpstream = effectiveModel;
  if (finalModelToUpstream.startsWith(`${provider}/`)) {
    finalModelToUpstream = finalModelToUpstream.slice(provider.length + 1);
  } else if (alias && finalModelToUpstream.startsWith(`${alias}/`)) {
    finalModelToUpstream = finalModelToUpstream.slice(alias.length + 1);
  }
  translatedBody.model = finalModelToUpstream;

<<<<<<< Updated upstream
  // #3554: a combo/route may substitute the upstream model AFTER the client chose its
  // `thinking` value. Claude Code sends `thinking:{type:"disabled"}` for internal calls,
  // which claude-fable-5 (adaptive-only) rejects with a 400. Drop the now-invalid value
  // when the resolved target model rejects it; models that accept `disabled` are untouched.
  if (typeof finalModelToUpstream === "string") {
    translatedBody = normalizeThinkingForModel(translatedBody, finalModelToUpstream);
    // Claude Opus 4.7+/Fable 5 removed manual extended thinking: `thinking.type:"enabled"`
    // or any `thinking.budget_tokens` is a hard 400. Collapse any manual thinking that
    // reached this point (passthrough legacy shape, reasoning_effort buckets, per-model
    // defaults) to `{type:"adaptive"}` — effort stays on `output_config.effort`. Keyed on
    // the resolved upstream model, so it covers every routing mode. See claudeAdaptiveThinking.ts.
    translatedBody = normalizeClaudeAdaptiveThinking(translatedBody, finalModelToUpstream);
    // Claude Haiku rejects `thinking.type:"adaptive"` and `output_config.effort`
    // (both Sonnet 4.6 / Opus 4.5+ only). Several paths can still emit those
    // shapes on a Haiku target — native passthrough, reasoning_effort buckets,
    // per-model defaults — so collapse them to a Haiku-valid shape here, after
    // model substitution. Mirrors upstream 9router 401d93bd5. See
    // services/claudeHaikuConstraints.ts.
    translatedBody = normalizeClaudeHaikuConstraints(translatedBody, finalModelToUpstream);
  }

  // Xiaomi MiMo controls reasoning ONLY via `thinking:{type:"enabled"|"disabled"}` and
  // rejects unknown/extra params with a strict "400 Param Incorrect". Map OmniRoute's
  // OpenAI reasoning signals onto that native shape: reduce any thinking object to
  // `{type}` and drop `reasoning_effort`/`reasoning`. See services/mimoThinking.ts.
  if (provider === "xiaomi-mimo") {
    translatedBody = normalizeMimoThinking(translatedBody);
  }

  const previousResponseIdPolicy = applyResponsesPreviousResponseIdPolicy(translatedBody, {
    mode: settings.responsesPreviousResponseIdMode,
    sourceFormat,
    targetFormat,
    credentials,
  });
  translatedBody = previousResponseIdPolicy.body as typeof translatedBody;

=======
>>>>>>> Stashed changes
  // #1789: Prevent output_config.effort from overriding effort encoded in model name (Codex)
  if (provider === "codex" || provider?.startsWith("codex")) {
    const hasEffortSuffix = finalModelToUpstream.match(/-(low|medium|high|xhigh)$/i);
    if (
      hasEffortSuffix &&
      translatedBody.output_config &&
      typeof translatedBody.output_config === "object"
    ) {
      const oc = translatedBody.output_config as Record<string, unknown>;
      if (oc.effort) {
        log?.warn?.(
          "PARAMS",
          `Stripped output_config.effort="${oc.effort}" because model "${finalModelToUpstream}" already encodes effort`
        );
        delete oc.effort;
        if (Object.keys(oc).length === 0) {
          delete translatedBody.output_config;
        }
      }
    }
  }

  // Strip unsupported parameters for reasoning models (o1, o3, etc.)
  const unsupported = getUnsupportedParams(provider, model);
  if (unsupported.length > 0) {
    const stripped: string[] = [];
    for (const param of unsupported) {
      if (Object.hasOwn(translatedBody, param)) {
        stripped.push(param);
        delete translatedBody[param];
      }
    }
    if (stripped.length > 0) {
      log?.warn?.("PARAMS", `Stripped unsupported params for ${model}: ${stripped.join(", ")}`);
    }
  }

<<<<<<< Updated upstream
  // GPT-5 reasoning models (openai Chat Completions) reject temperature/top_p with a 400
  // whenever a reasoning effort is active, yet accept them under reasoning_effort=none (the
  // GPT-5.1+ default). A static unsupportedParams list can't express that, so strip sampling
  // conditionally here. The codex Responses path is already covered by the executor allowlist.
  translatedBody = stripGpt5SamplingWhenReasoning(
    translatedBody,
    provider,
    finalModelToUpstream,
    log
  );

  // Rename max_tokens to max_completion_tokens if not supported (#1961)
  if (!supportsMaxTokens({ provider, model })) {
    if (translatedBody.max_tokens !== undefined) {
      if (translatedBody.max_completion_tokens === undefined) {
        translatedBody.max_completion_tokens = translatedBody.max_tokens;
      }
      delete translatedBody.max_tokens;
      log?.debug?.("PARAMS", `Renamed max_tokens to max_completion_tokens for ${model}`);
    }
  }

  // OpenAI's `store` parameter is not supported by most compatible providers and breaks them
  if (provider !== "openai" && "store" in translatedBody) {
    delete translatedBody.store;
  }

  // Chat clients may send stream_options.include_usage, but OpenAI Responses
  // upstreams (including Azure AI Foundry /responses) reject stream_options.
  if (targetFormat === FORMATS.OPENAI_RESPONSES && "stream_options" in translatedBody) {
    delete translatedBody.stream_options;
  }

=======
>>>>>>> Stashed changes
  // Provider-specific max_tokens caps (#711)
  // Some providers reject requests when max_tokens exceeds their API limit.
  // Cap before sending to avoid upstream HTTP 400 errors.
  const providerCap = PROVIDER_MAX_TOKENS[provider];
  if (providerCap) {
    for (const field of ["max_tokens", "max_completion_tokens"] as const) {
      if (typeof translatedBody[field] === "number" && translatedBody[field] > providerCap) {
        log?.debug?.(
          "PARAMS",
          `Capping ${field} from ${translatedBody[field]} to ${providerCap} for ${provider}`
        );
        translatedBody[field] = providerCap;
      }
    }
  }

  // Resolve executor with optional upstream proxy (CLIProxyAPI) routing.
  // mode="native" (default): returns the native executor unchanged.
  // mode="cliproxyapi": returns the CLIProxyAPI executor instead.
  // mode="fallback": returns a wrapper that tries native first, falls back to CLIProxyAPI on 5xx/network errors.

<<<<<<< Updated upstream
  const resolveExecutorWithProxy = (prov: string) =>
    resolveExecutorWithProxyFor(prov, log, { providerSpecificData: credentials?.providerSpecificData });

  // === Quota Share enforcement PRE-hook (B/F7) ===
  // Runs after provider/model/credentials/apiKeyInfo are fully resolved,
  // before dispatcher. Fail-open per B16: errors → allow.
  let quotaSoftDeprioritize = false;
  if (apiKeyInfo?.id && credentials?.connectionId) {
    try {
      const { enforceQuotaShare } = await import("@/lib/quota/enforce");
      const decision = await enforceQuotaShare({
        apiKeyId: apiKeyInfo.id,
        connectionId: credentials.connectionId,
        provider: provider ?? "unknown",
        // Resolved model id (post background-redirect / alias) — the same scope the
        // router/log use. Operators configure per-(key,model) caps against THIS id.
        model: model || undefined,
        estimatedCost: {},
      }).catch((err: unknown) => {
        log?.warn?.(
          "QUOTA_SHARE",
          `enforceQuotaShare failed; fail-open: ${err instanceof Error ? err.message : String(err)}`
        );
        return { kind: "allow" as const };
      });

      if (decision.kind === "block") {
        const { buildErrorBody } = await import("../utils/error.ts");
        log?.warn?.(
          "QUOTA_SHARE",
          `[quotaShare] blocked apiKeyId=${apiKeyInfo.id} provider=${provider ?? "unknown"}: ${decision.reason}`
        );
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (decision.retryAfterSeconds) {
          headers["Retry-After"] = String(decision.retryAfterSeconds);
        }
        return new Response(JSON.stringify(buildErrorBody(429, decision.reason)), {
          status: 429,
          headers,
        });
      }

      if (decision.kind === "allow" && decision.deprioritize) {
        quotaSoftDeprioritize = true;
        log?.info?.(
          "QUOTA_SHARE",
          `[quotaShare] soft deprioritize active for apiKeyId=${apiKeyInfo.id} provider=${provider ?? "unknown"}`
        );
      }
    } catch (err) {
      // Outer fail-open guard — should not be reached (inner .catch covers it)
      log?.warn?.(
        "QUOTA_SHARE",
        `[quotaShare] enforceQuotaShare unexpected error; fail-open: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  // G2: Propagate soft penalty to the current candidate so combo scoring can deprioritize.
  if (quotaSoftDeprioritize && isCombo && comboStepId) {
    try {
      const { setCandidateQuotaSoftPenalty } = await import("../services/combo");
      setCandidateQuotaSoftPenalty(comboExecutionKey, comboStepId, true);
    } catch (err) {
      log?.warn?.(
        "QUOTA_SHARE",
        `[quotaShare] could not set soft penalty on candidate: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  // === /Quota Share enforcement PRE-hook ===

=======
  const resolveExecutorWithProxy = async (prov: string) => {
    const cfg = await getUpstreamProxyConfigCached(prov);
    if (!cfg.enabled || cfg.mode === "native") return getExecutor(prov);

    if (cfg.mode === "cliproxyapi") {
      log?.info?.("UPSTREAM_PROXY", `${prov} routed through CLIProxyAPI (passthrough)`);
      return getExecutor("cliproxyapi");
    }

    // mode === "fallback": try native first, retry via CLIProxyAPI on specific failures
    const nativeExec = getExecutor(prov);
    const proxyExec = getExecutor("cliproxyapi");
    const isRetryableStatus = (s: number) => s >= 500 || s === 429 || s === 0;

    const wrapper = Object.create(nativeExec);
    wrapper.execute = async (input: {
      model: string;
      body: unknown;
      stream: boolean;
      credentials: unknown;
      signal?: AbortSignal | null;
      log?: unknown;
      upstreamExtraHeaders?: Record<string, string> | null;
    }) => {
      let result;
      try {
        result = await nativeExec.execute(input);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log?.info?.("UPSTREAM_PROXY", `${prov} native error (${errMsg}), retrying via CLIProxyAPI`);
        try {
          return await proxyExec.execute(input);
        } catch (proxyErr) {
          const proxyMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
          log?.error?.("UPSTREAM_PROXY", `${prov} CLIProxyAPI fallback also failed: ${proxyMsg}`);
          throw proxyErr;
        }
      }

      if (!isRetryableStatus(result.response.status)) {
        return result;
      }
      log?.info?.(
        "UPSTREAM_PROXY",
        `${prov} native failed (${result.response.status}), retrying via CLIProxyAPI`
      );
      try {
        return await proxyExec.execute(input);
      } catch (proxyErr) {
        const proxyMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
        log?.error?.("UPSTREAM_PROXY", `${prov} CLIProxyAPI fallback also failed: ${proxyMsg}`);
        throw proxyErr;
      }
    };
    return wrapper;
  };

>>>>>>> Stashed changes
  // Get executor for this provider (with optional upstream proxy routing)
  const executor = await resolveExecutorWithProxy(provider);
  const getExecutionCredentials = () =>
    resolveExecutionCredentialsFor({
      credentials,
      nativeCodexPassthrough,
      endpointPath,
      targetFormat,
      provider,
      ccSessionId,
    });

<<<<<<< Updated upstream
  let onPipelineStreamError: streamFailure.PipelineStreamErrorHandler | null = null;
  let onClientDisconnectFinalize:
    ((event: { reason: string; duration: number }) => boolean) | null = null;

  // Create stream controller for disconnect detection
  const streamController = createStreamController({
    onDisconnect: (event) => {
      let finalized = false;
      try {
        finalized = onClientDisconnectFinalize?.(event) === true;
      } catch {}
      if (!finalized) {
        try {
          finalizePendingScope(pendingScope, {
            status: 499,
            error: `Client disconnected: ${event.reason}`,
            errorCode: "client_disconnected",
          });
          finalized = true;
        } catch {}
      }
      try {
        onDisconnect?.(event);
      } catch {}
      return finalized;
    },
    onError: (event) => onPipelineStreamError?.(event),
    provider,
    model,
    connectionId,
    clientResponseFormat,
    clientAbortSignal: clientRawRequest?.signal,
=======
    if (!ccSessionId) return nextCredentials;

    return {
      ...nextCredentials,
      providerSpecificData: {
        ...(nextCredentials?.providerSpecificData || {}),
        ccSessionId,
      },
    };
  };

  // Create stream controller for disconnect detection
  const streamController = createStreamController({
    onDisconnect,
    log,
    provider,
    model,
    connectionId,
>>>>>>> Stashed changes
  });

  const dedupRequestBody = { ...translatedBody, model: `${provider}/${model}`, stream };
  const dedupEnabled = shouldDeduplicate(dedupRequestBody);
  const dedupHash = dedupEnabled ? computeRequestHash(dedupRequestBody) : null;

  const executeProviderRequest = async (modelToCall = effectiveModel, allowDedup = false) => {
    const execute = async () => {
<<<<<<< Updated upstream
      // Upstream body preparation extracted to chatCore/upstreamBody.ts (#3501 — first internal
      // sub-slice of executeProviderRequest); produces the body sent upstream (payload rules +
      // tool-limit truncation + qwen oauth user backfill + prompt_cache_key injection).
      let bodyToSend = await prepareUpstreamBody({
        translatedBody,
        modelToCall,
=======
      const executionCredentials = getExecutionCredentials();
      const accountSemaphoreMaxConcurrency =
        resolveAccountSemaphoreMaxConcurrency(executionCredentials);
      const accountSemaphoreKey = resolveAccountSemaphoreKey({
        provider,
        model: modelToCall,
        connectionId,
        credentials: executionCredentials,
      });
      let bodyToSend =
        translatedBody.model === modelToCall
          ? translatedBody
          : { ...translatedBody, model: modelToCall };
      const payloadRuleModel =
        typeof bodyToSend.model === "string" && bodyToSend.model.length > 0
          ? bodyToSend.model
          : modelToCall;
      const payloadRuleProtocols = resolvePayloadRuleProtocols({
>>>>>>> Stashed changes
        provider,
        targetFormat,
        credentials,
        log,
      });

<<<<<<< Updated upstream
      updatePendingScope(pendingScope, {
        providerRequest: bodyToSend,
        stage: "payload_prepared",
      });

      let releaseRawResultAccountSemaphore = () => {};
      try {
        const rawResult = await (async () => {
          let attempts = 0;
          const isModelScopeForRequest = isModelScope();
          const maxAttempts = isModelScopeForRequest
            ? 3
            : provider === "qwen"
              ? 3
              : provider === "codex"
                ? 3
                : 1;

          // ── Codex 429 account-rotation state ─────────────────────────────────
          // Track excluded connection IDs for codex failover across attempts.
          const codexExcludedIds: string[] = [];
          // Derive session affinity key once for codex failover (used to clear affinity on 429).
          const codexSessionAffinityKey =
            provider === "codex"
              ? (extractSessionAffinityKey(body, clientRawRequest?.headers) ?? null)
              : null;

          while (attempts < maxAttempts) {
            trace("pre_executor", { attempt: attempts });
            updatePendingScope(pendingScope, {
              stage: "sending_to_provider",
            });
            const execCreds = getExecutionCredentials();
            const attemptConnectionId = execCreds?.connectionId || connectionId;
            const accountSemaphoreMaxConcurrency = resolveAccountSemaphoreMaxConcurrency(execCreds);
            const accountSemaphoreKey = resolveAccountSemaphoreKey({
              provider,
              model: modelToCall,
              connectionId: attemptConnectionId,
              credentials: execCreds,
            });

            trace("pre_semaphore", {
              semaphoreKey: accountSemaphoreKey,
              max: accountSemaphoreMaxConcurrency,
            });
            if (accountSemaphoreKey && accountSemaphoreMaxConcurrency != null) {
              updatePendingScope(pendingScope, {
                stage: "waiting_account_slot",
              });
            }
            const releaseAccountSemaphore =
              accountSemaphoreKey && accountSemaphoreMaxConcurrency != null
                ? await acquireAccountSemaphore(accountSemaphoreKey, {
                    maxConcurrency: accountSemaphoreMaxConcurrency,
                    signal: streamController.signal,
                  })
                : () => {};
            trace("post_semaphore");
            updatePendingScope(pendingScope, {
              stage: "waiting_rate_limit",
            });

            try {
              trace("pre_rate_limit", { connectionId: attemptConnectionId });
              const rawExecutorResult = await withRateLimit(
                provider,
                attemptConnectionId,
                modelToCall,
                async () => {
                  trace("inside_rate_limit", { connectionId: attemptConnectionId });
                  updatePendingScope(pendingScope, {
                    stage: "rate_limit_slot_acquired",
                  });
                  return executeWithUpstreamStartTimeout({
                    executor,
                    provider,
                    model: modelToCall,
                    signal: streamController.signal,
                    log,
                    execute: (signal) =>
                      runWithCapture(providerRequestCapture, () =>
                        executor.execute({
                          model: modelToCall,
                          body: bodyToSend,
                          stream: upstreamStream,
                          credentials: execCreds,
                          signal,
                          log,
                          extendedContext,
                          upstreamExtraHeaders: buildUpstreamHeadersForExecute(modelToCall),
                          clientHeaders: buildExecutorClientHeaders(
                            clientRawRequest?.headers,
                            userAgent
                          ),
                          onCredentialsRefreshed,
                          skipUpstreamRetry,
                          contextEditing: { enabled: contextEditingEnabled },
                        })
                      ),
                  });
                },
                streamController.signal
              );
              const res = normalizeExecutorResult(rawExecutorResult);
              trace("post_executor", { status: res?.response?.status });

              // Track Gemini RPM + RPD request counts for 429 classification
              if (provider === "gemini") {
                incrementRequestCount(modelToCall);
              }

              updatePendingScope(pendingScope, {
                stage: "provider_response_started",
              });

              if (res.response.status === 401 && execCreds?.connectionId) {
                recordKeyHealthStatus(401, execCreds);
              }

=======
      if (payloadRuleResult.applied.length > 0) {
        const appliedSummary = payloadRuleResult.applied
          .map((rule) => {
            if (rule.type === "filter") return `${rule.type}:${rule.path}`;
            const serializedValue = JSON.stringify(rule.value);
            const safeValue =
              typeof serializedValue === "string" && serializedValue.length > 80
                ? `${serializedValue.slice(0, 77)}...`
                : serializedValue;
            return `${rule.type}:${rule.path}=${safeValue}`;
          })
          .join(", ");
        log?.debug?.(
          "PAYLOAD_RULES",
          `Applied ${payloadRuleResult.applied.length} rule(s) for ${payloadRuleModel} (${payloadRuleProtocols.join(", ")}): ${appliedSummary}`
        );
      }

      // Qwen OAuth rejects requests without a non-empty `user` field.
      // Some minimal OpenAI-compatible clients omit it, so we backfill a
      // stable default only for OAuth mode (API key mode is unaffected).
      const hasValidQwenUser =
        typeof bodyToSend.user === "string" && bodyToSend.user.trim().length > 0;
      const isQwenOAuthRequest =
        provider === "qwen" &&
        !credentials?.apiKey &&
        typeof credentials?.accessToken === "string" &&
        credentials.accessToken.trim().length > 0;
      if (isQwenOAuthRequest && !hasValidQwenUser) {
        bodyToSend = { ...bodyToSend, user: "omniroute-qwen-oauth" };
        log?.debug?.("QWEN", "Injected fallback user for OAuth request");
      }

      // Inject prompt_cache_key only for providers that support it
      if (
        targetFormat === FORMATS.OPENAI &&
        providerSupportsCaching(provider) &&
        !bodyToSend.prompt_cache_key &&
        Array.isArray(bodyToSend.messages) &&
        !["nvidia", "codex", "xai"].includes(provider)
      ) {
        const { generatePromptCacheKey } = await import("@/lib/promptCache");
        const cacheKey = generatePromptCacheKey(bodyToSend.messages);
        if (cacheKey) {
          bodyToSend = { ...bodyToSend, prompt_cache_key: cacheKey };
        }
      }

      trace("pre_semaphore", {
        semaphoreKey: accountSemaphoreKey,
        max: accountSemaphoreMaxConcurrency,
      });
      const acquireAccountSemaphoreRelease =
        accountSemaphoreKey && accountSemaphoreMaxConcurrency != null
          ? await acquireAccountSemaphore(accountSemaphoreKey, {
              maxConcurrency: accountSemaphoreMaxConcurrency,
              signal: streamController.signal,
            })
          : () => {};
      trace("post_semaphore");

      try {
        trace("pre_rate_limit");
        const rawResult = await withRateLimit(
          provider,
          connectionId,
          modelToCall,
          async () => {
            trace("inside_rate_limit");
            let attempts = 0;
            const maxAttempts = provider === "qwen" ? 3 : 1;

            while (attempts < maxAttempts) {
              trace("pre_executor", { attempt: attempts });
              const res = await executor.execute({
                model: modelToCall,
                body: bodyToSend,
                stream: upstreamStream,
                credentials: executionCredentials,
                signal: streamController.signal,
                log,
                extendedContext,
                upstreamExtraHeaders: buildUpstreamHeadersForExecute(modelToCall),
                clientHeaders: buildExecutorClientHeaders(clientRawRequest?.headers, userAgent),
                onCredentialsRefreshed,
              });
              trace("post_executor", { status: res?.response?.status });

>>>>>>> Stashed changes
              // Qwen 429 strict quota backoff (wait 1.5s, 3s and retry)
              if (
                provider === "qwen" &&
                res.response.status === 429 &&
                attempts < maxAttempts - 1
              ) {
                const bodyPeek = await res.response
                  .clone()
                  .text()
                  .catch(() => "");
                if (bodyPeek.toLowerCase().includes("exceeded your current quota")) {
                  const delay = 1500 * (attempts + 1);
                  log?.warn?.("QWEN_RETRY", `Quota 429 hit. Retrying in ${delay}ms...`);
                  releaseAccountSemaphore();
                  await new Promise((r) => setTimeout(r, delay));
                  attempts++;
                  continue;
                }
              }

<<<<<<< Updated upstream
              if (isModelScope() && res.response.status === 429 && attempts < maxAttempts - 1) {
                const bodyPeek = await res.response
                  .clone()
                  .text()
                  .catch(() => "");
                const normalizedHeaders = normalizeHeaders(res.response.headers);
                const decision = classifyModelScope429(bodyPeek, normalizedHeaders);
                if (decision.retryable) {
                  const delay = getModelScopeRetryDelayMs(normalizedHeaders, attempts);
                  log?.warn?.(
                    "MODELSCOPE_RETRY",
                    `429 ${decision.kind}; retrying in ${delay}ms (model remaining: ${decision.snapshot.modelRemaining ?? "unknown"})`
                  );
                  releaseAccountSemaphore();
                  await new Promise((r) => setTimeout(r, delay));
                  attempts++;
                  continue;
                }
              }

              // Codex 429 account-rotation failover (disabled for context-relay so combo.ts can inject handoff)
              if (
                provider === "codex" &&
                comboStrategy !== "context-relay" &&
                res.response.status === 429 &&
                attempts < maxAttempts - 1
              ) {
                const failedConnectionId =
                  execCreds?.connectionId || credentials?.connectionId || connectionId;
                const normalizedHeaders = normalizeHeaders(res.response.headers);
                const retryAfterHeader = normalizedHeaders["retry-after"] ?? null;
                const retryAfterMs = retryAfterHeader
                  ? Number.parseFloat(retryAfterHeader) * 1000
                  : null;

                log?.warn?.(
                  "CODEX_FAILOVER",
                  `429 on connection ${String(failedConnectionId).slice(0, 8)} (attempt ${attempts + 1}/${maxAttempts}), rotating account`
                );

                // Mark only the current Codex model scope as rate-limited.
                if (failedConnectionId) {
                  await markCodexScopeRateLimited({
                    failedConnectionId: String(failedConnectionId),
                    model: modelToCall || model || requestedModel || null,
                    rateLimitedUntil: new Date(Date.now() + (retryAfterMs || 60_000)).toISOString(),
                    credentials,
                  });
                  if (!codexExcludedIds.includes(String(failedConnectionId))) {
                    codexExcludedIds.push(String(failedConnectionId));
                  }
                }

                // Clear session affinity so next request won't be pinned to the failing account
                if (codexSessionAffinityKey) {
                  try {
                    deleteSessionAccountAffinity(codexSessionAffinityKey, "codex");
                  } catch {
                    // best-effort
                  }
                }

                // Fetch next available codex connection (excluding all previously failed ones)
                const nextCreds = await getProviderCredentials(
                  "codex",
                  null,
                  null,
                  modelToCall || model || requestedModel || null,
                  {
                    excludeConnectionIds: [...codexExcludedIds],
                  }
                ).catch(() => null);

                if (!nextCreds || nextCreds.allRateLimited) {
                  log?.warn?.("CODEX_FAILOVER", "No more codex accounts available — returning 429");
                  if (stream) {
                    releaseAccountSemaphore();
                    return {
                      ...res,
                      _executionCredentials: execCreds,
                    };
                  }
                  return {
                    ...res,
                    _accountSemaphoreRelease: releaseAccountSemaphore,
                    _executionCredentials: execCreds,
                  };
                }

                const newConnectionId = nextCreds.connectionId;
                log?.info?.(
                  "CODEX_FAILOVER",
                  `Rotating codex account: ${String(failedConnectionId).slice(0, 8)} → ${newConnectionId.slice(0, 8)} (attempt ${attempts + 2}/${maxAttempts})`
                );

                logAuditEvent({
                  action: "codex.account_rotation",
                  actor: apiKeyInfo?.name || "system",
                  target: newConnectionId,
                  details: {
                    failed_connection_id: failedConnectionId,
                    new_connection_id: newConnectionId,
                    attempt: attempts + 1,
                    retry_after_ms: retryAfterMs,
                  },
                });

                // Update credentials in-place so getExecutionCredentials() picks up the new account
                Object.assign(credentials, nextCreds);

                releaseAccountSemaphore();
                attempts++;
                continue;
              }

=======
>>>>>>> Stashed changes
              // For streaming: release the semaphore when the client drains or cancels the stream.
              if (stream) {
                const originalBody = res.response.body;
                if (!originalBody) {
                  releaseAccountSemaphore();
                  return res;
                }

                // Opt-in transparent stream recovery (free-claude-code port, default OFF).
                // Only engages for a successful (2xx) stream — an error body must never be
                // held or replayed. Setting is read once here from the cached resolved
                // resilience settings; the default path is byte-for-byte unchanged.
                const okStatus = res.response.status >= 200 && res.response.status < 300;
                let streamRecoveryEnabled = false;
                let continueMidStreamEnabled = false;
                if (okStatus) {
                  try {
                    // Reuse the request-consolidated settings read (see line ~2076) — no
                    // second DB/cache hit. Default OFF when the setting is absent.
                    const sr = resolveResilienceSettings(settings).streamRecovery;
                    // Fail-closed: the agent-goal-policy heuristic may only ADD recovery
                    // when the operator has no explicit configuration. If the operator
                    // explicitly configured stream recovery (env var or DB/settings
                    // override), that value always wins — the goal policy must never
                    // re-enable recovery the operator explicitly turned off.
                    const operatorExplicit = isStreamRecoveryExplicitlyConfigured(settings);
                    const goalOverride = !operatorExplicit && agentGoalPolicy.streamRecoveryEnabled;
                    streamRecoveryEnabled = sr.enabled || goalOverride;
                    continueMidStreamEnabled = sr.continueMidStream === true;
                    if (goalOverride && !sr.enabled) {
                      log?.info?.(
                        "AGENT_GOAL",
                        `agentGoalPolicy override: stream recovery enabled for goal request requestId=${traceId} model=${modelToCall || model || requestedModel || "unknown"}`
                      );
                    }
                  } catch {
                    streamRecoveryEnabled = false;
                    continueMidStreamEnabled = false;
                  }
                }

                let clientBody: ReadableStream<Uint8Array>;
                if (streamRecoveryEnabled) {
                  // Run the SAME upstream (same account/creds) with a given body and return
                  // its 2xx stream, or null. Used both by the early-retry re-open (same body)
                  // and the mid-stream continuation (assistant-prefilled body).
                  const runUpstreamStream = async (
                    body: unknown
                  ): Promise<ReadableStream<Uint8Array> | null> => {
                    try {
                      const retryRaw = await executeWithUpstreamStartTimeout({
                        executor,
                        provider,
                        model: modelToCall,
                        signal: streamController.signal,
                        log,
                        execute: (signal) =>
                          runWithCapture(providerRequestCapture, () =>
                            executor.execute({
                              model: modelToCall,
                              body,
                              stream: upstreamStream,
                              credentials: execCreds,
                              signal,
                              log,
                              extendedContext,
                              upstreamExtraHeaders: buildUpstreamHeadersForExecute(modelToCall),
                              clientHeaders: buildExecutorClientHeaders(
                                clientRawRequest?.headers,
                                userAgent
                              ),
                              onCredentialsRefreshed,
                              skipUpstreamRetry,
                              contextEditing: { enabled: contextEditingEnabled },
                            })
                          ),
                      });
                      const retryRes = normalizeExecutorResult(retryRaw);
                      const retryOk =
                        retryRes.response.status >= 200 && retryRes.response.status < 300;
                      if (retryOk && retryRes.response.body) {
                        return retryRes.response.body as ReadableStream<Uint8Array>;
                      }
                      await retryRes.response.body?.cancel().catch(() => {});
                      return null;
                    } catch {
                      return null;
                    }
                  };

                  // Mid-stream continuation (Fase 4.4): re-request with the partial text as an
                  // assistant prefill. Gated by its own setting and only for OpenAI-compatible
                  // bodies (makeContinuationBody returns null otherwise).
                  const continueStream = continueMidStreamEnabled
                    ? (assistantSoFar: string) => {
                        const continuationBody = makeContinuationBody(
                          bodyToSend as Record<string, unknown>,
                          assistantSoFar
                        );
                        return continuationBody
                          ? runUpstreamStream(continuationBody)
                          : Promise.resolve(null);
                      }
                    : undefined;

                  clientBody = createRecoverableStream(
                    originalBody as ReadableStream<Uint8Array>,
                    () => runUpstreamStream(bodyToSend),
                    {
                      finalize: releaseAccountSemaphore,
                      onRetry: (attempt, err) =>
                        log?.warn?.(
                          "STREAM_RECOVERY",
                          `transparent early-retry ${attempt}/${STREAM_RECOVERY.EARLY_RETRY_MAX} after ${
                            (err as { name?: string })?.name || "truncation"
                          }`
                        ),
                      continueStream,
                      onContinue: (attempt) =>
                        log?.warn?.(
                          "STREAM_RECOVERY",
                          `mid-stream continuation attempt ${attempt}/${STREAM_RECOVERY.EARLY_RETRY_MAX}`
                        ),
                    }
                  );
                } else {
                  clientBody = wrapReadableStreamWithFinalize(
                    originalBody,
                    releaseAccountSemaphore
                  );
                }

                return {
                  ...res,
<<<<<<< Updated upstream
                  _executionCredentials: execCreds,
                  response: new Response(clientBody, {
                    status: res.response.status,
                    statusText: res.response.statusText,
                    headers: new Headers(normalizeHeaders(res.response.headers)),
                  }),
                };
              }

              return {
                ...res,
                _executionCredentials: execCreds,
                _accountSemaphoreRelease: releaseAccountSemaphore,
              };
            } catch (error) {
              releaseAccountSemaphore();
              throw error;
=======
                  response: new Response(
                    wrapReadableStreamWithFinalize(originalBody, acquireAccountSemaphoreRelease),
                    {
                      status: res.response.status,
                      statusText: res.response.statusText,
                      headers: res.response.headers,
                    }
                  ),
                };
              }

              return res;
>>>>>>> Stashed changes
            }
          }
        })();

        if (stream) {
          return rawResult;
        }

        // Non-stream: release semaphore immediately after reading full response body.
        const status = rawResult.response.status;
<<<<<<< Updated upstream

        // Use execution credentials captured during request processing
        if (
          rawResult._executionCredentials?.connectionId &&
          rawResult._executionCredentials?.apiKey
        ) {
          recordKeyHealthStatus(status, rawResult._executionCredentials);
        }
        releaseRawResultAccountSemaphore =
          typeof rawResult._accountSemaphoreRelease === "function"
            ? rawResult._accountSemaphoreRelease
            : () => {};

        const statusText = rawResult.response.statusText;
        const headersObj = normalizeHeaders(rawResult.response.headers);
        const responseHeaders = new Headers(headersObj);
        stripStaleForwardingHeaders(responseHeaders);
        stripNextMiddlewareControlHeaders(responseHeaders);
        const contentType = (responseHeaders.get("content-type") || "").toLowerCase();
        const payload = await readNonStreamingResponseBody(
          rawResult.response,
          contentType,
          upstreamStream
        );
        releaseRawResultAccountSemaphore();
        releaseRawResultAccountSemaphore = () => {};

        return {
          ...rawResult,
          response: new Response(payload, { status, statusText, headers: responseHeaders }),
          _dedupSnapshot: {
            status,
            statusText,
            headers: (() => {
              const arr: [string, string][] = [];
              responseHeaders.forEach((v, k) => arr.push([k, v]));
              return arr;
            })(),
=======
        const statusText = rawResult.response.statusText;
        const headers = Array.from(rawResult.response.headers.entries()) as [string, string][];
        const payload = await withBodyTimeout<string>(rawResult.response.text());
        acquireAccountSemaphoreRelease();

        return {
          ...rawResult,
          response: new Response(payload, { status, statusText, headers }),
          _dedupSnapshot: {
            status,
            statusText,
            headers,
>>>>>>> Stashed changes
            payload,
          },
        };
      } catch (error) {
        releaseRawResultAccountSemaphore();
        throw error;
      }
    };

    if (allowDedup && dedupEnabled && dedupHash) {
      const dedupResult = await deduplicate(dedupHash, execute);
      if (dedupResult.wasDeduplicated) {
        log?.debug?.("DEDUP", `Joined in-flight request hash=${dedupHash}`);
      }
      return materializeDeduplicatedExecutionResult(dedupResult.result);
    }

    return execute();
  };

<<<<<<< Updated upstream
  const registeredProviderRequest =
    translatedBody && typeof translatedBody === "object" && !Array.isArray(translatedBody)
      ? {
          ...(translatedBody as Record<string, unknown>),
          model:
            typeof (translatedBody as Record<string, unknown>).model === "string"
              ? (translatedBody as Record<string, unknown>).model
              : effectiveModel,
          ...(!Array.isArray((translatedBody as Record<string, unknown>).messages) &&
          Array.isArray((body as Record<string, unknown>).messages)
            ? { messages: (body as Record<string, unknown>).messages }
            : {}),
        }
      : translatedBody;

  updatePendingScope(pendingScope, {
    providerRequest: registeredProviderRequest,
=======
  // Track pending request
  trackPendingRequest(model, provider, connectionId, true, {
    clientEndpoint: clientRawRequest?.endpoint || "/v1/chat/completions",
    clientRequest: clientRawRequest?.body ?? body,
>>>>>>> Stashed changes
  });
  // T5: track which models we've tried for intra-family fallback
  const triedModels = new Set<string>([effectiveModel]);
  let currentModel = effectiveModel;

  // Log start
  appendRequestLog({ model, provider, connectionId, status: "PENDING" }).catch(() => {});

  const msgCount =
    translatedBody.messages?.length ||
    translatedBody.contents?.length ||
    translatedBody.request?.contents?.length ||
    0;
  log?.debug?.("REQUEST", `${provider.toUpperCase()} | ${model} | ${msgCount} msgs`);

  // Execute request using executor (handles URL building, headers, fallback, transform)
  let providerResponse;
  let providerUrl;
  let providerHeaders;
  let finalBody;
  let claudePromptCacheLogMeta = null;

  try {
    const result = await executeProviderRequest(effectiveModel, true);

    providerResponse = result.response;
    providerUrl = result.url;
    providerHeaders = result.headers;
<<<<<<< Updated upstream
    finalBody = providerRequestCapture.body(result.transformedBody);
    const responseConnectionId = getCurrentConnectionId();
    effectiveServiceTier = resolveEffectiveServiceTier(finalBody);
=======
    finalBody = result.transformedBody;
>>>>>>> Stashed changes
    claudePromptCacheLogMeta = buildClaudePromptCacheLogMeta(
      targetFormat,
      finalBody,
      providerHeaders
    );

    // Log target request (final request to provider)
    reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
    updatePendingScope(pendingScope, {
      providerRequest: finalBody,
      providerUrl,
    });
    // Update rate limiter from response headers (learn limits dynamically)
    updateFromHeaders(
      provider,
      responseConnectionId,
      providerResponse.headers,
      providerResponse.status,
      model
    );
<<<<<<< Updated upstream

    // Store rate-limit headers for quota saturation signals
    try {
      const { storeRateLimitHeaders } = await import("@/lib/quota/saturationSignals");
      storeRateLimitHeaders(
        responseConnectionId,
        provider,
        providerResponse.headers as Record<string, string>
      );
    } catch {
      // fail-open: saturation signal is best-effort
    }
=======
>>>>>>> Stashed changes
  } catch (error) {
    trackPendingRequest(model, provider, connectionId, false);
    if (isSemaphoreTimeoutError(error)) {
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${error.code}`,
      }).catch(() => {});
      if (isCombo) {
        throw error;
      }
      const failureMessage = error.message || "Semaphore timeout";
      persistAttemptLogs({
        status: HTTP_STATUS.RATE_LIMITED,
        error: failureMessage,
        providerRequest: finalBody || translatedBody,
        clientResponse: buildErrorBody(HTTP_STATUS.RATE_LIMITED, failureMessage),
        claudeCacheMeta: claudePromptCacheLogMeta,
        cacheSource: "upstream",
      });
      persistFailureUsage(HTTP_STATUS.RATE_LIMITED, error.code);
      return createErrorResult(HTTP_STATUS.RATE_LIMITED, failureMessage);
    }
    const failureStatus =
      error.name === "AbortError"
        ? 499
        : error.name === "TimeoutError" || error.name === "BodyTimeoutError"
          ? HTTP_STATUS.GATEWAY_TIMEOUT
          : error.status && typeof error.status === "number"
            ? error.status
            : HTTP_STATUS.BAD_GATEWAY;
    const failureMessage =
      error.name === "AbortError"
        ? "Request aborted"
        : formatProviderError(error, provider, model, failureStatus);
<<<<<<< Updated upstream
    const upstreamErrorCode = getUpstreamErrorIdentifier(error);
    // Tag our own deadline timeouts (fetch-start TimeoutError / body BodyTimeoutError,
    // both surfaced as a 504) as "upstream_timeout" so the cooldown layer can tell a
    // slow-but-not-failed request apart from a real provider 5xx. (Antigravity already
    // tags its pre-response timeout via the code below.)
    const isOwnDeadlineTimeout =
      failureStatus === HTTP_STATUS.GATEWAY_TIMEOUT &&
      (error.name === "TimeoutError" || error.name === "BodyTimeoutError");
    const upstreamErrorType =
      upstreamErrorCode === ANTIGRAVITY_PRE_RESPONSE_TIMEOUT_CODE || isOwnDeadlineTimeout
        ? "upstream_timeout"
        : failureStatus === 401
          ? "authentication_error"
          : undefined;
=======
>>>>>>> Stashed changes
    appendRequestLog({
      model,
      provider,
      connectionId,
      status: `FAILED ${failureStatus}`,
    }).catch(() => {});
    persistAttemptLogs({
      status: failureStatus,
      error: failureMessage,
      providerRequest: finalBody || translatedBody,
      clientResponse: buildErrorBody(failureStatus, failureMessage),
      claudeCacheMeta: claudePromptCacheLogMeta,
      cacheSource: "upstream",
    });
    if (error.name === "AbortError") {
      streamController.handleError(error);
      return createErrorResult(499, "Request aborted");
    }
    persistFailureUsage(
      failureStatus,
      error instanceof Error && error.name ? error.name : "upstream_error"
    );
    console.log(`${COLORS.red}[ERROR] ${failureMessage}${COLORS.reset}`);
    return createErrorResult(failureStatus, failureMessage);
  }
  // We need to peek at the error text if it's 400 for Qwen
  let upstreamErrorParsed = false;
  let parsedStatusCode = providerResponse.status;
  let parsedMessage = "";
  let parsedRetryAfterMs: number | null = null;
  let upstreamErrorBody: unknown = null;

  if (provider === "qwen" && providerResponse.status === HTTP_STATUS.BAD_REQUEST) {
    const errorDetails = await parseUpstreamError(providerResponse, provider);
    parsedStatusCode = errorDetails.statusCode;
    parsedMessage = errorDetails.message;
    parsedRetryAfterMs = errorDetails.retryAfterMs;
    upstreamErrorBody = errorDetails.responseBody;
    upstreamErrorParsed = true;
  }

  const isQwenExpiredError =
    provider === "qwen" &&
    parsedStatusCode === HTTP_STATUS.BAD_REQUEST &&
    parsedMessage &&
    parsedMessage.toLowerCase().includes("session has expired");

  const streamOptionsOnlyFailed = false; // TODO: properly track stream options failure? (placeholder from existing logic)

  // Handle 401/403 (and Qwen explicit expiration) - try token refresh using executor
  if (
    (providerResponse.status === HTTP_STATUS.UNAUTHORIZED ||
      providerResponse.status === HTTP_STATUS.FORBIDDEN ||
      isQwenExpiredError) &&
    !streamOptionsOnlyFailed // Keep constraint if stream options failed originally
  ) {
<<<<<<< Updated upstream
    // Fix A: wrap refreshCredentials in runWithOnPersist so the persist callback
    // executes INSIDE the per-connection mutex held by getAccessToken. This makes
    // [network refresh + DB write + outer-state mutation] one atomic step and
    // prevents concurrent requests from reading a stale refreshToken before the
    // DB has been updated (refresh_token_reused on Codex/OpenAI).
    //
    // Not every executor routes refresh through getAccessToken (e.g. github.ts
    // calls refreshCopilotToken directly). When the persistFn doesn't fire from
    // inside getAccessToken, we still need to do the credentials mutation + user
    // callback after refreshCredentials returns. The `persistFnRan` flag tracks
    // which path executed so we don't double-fire (race-prone) or skip (regression).
    // Front 3: remember the refresh_token we are about to present so that, if the
    // refresh fails as unrecoverable, we can tell a genuine death apart from a
    // stale-token reuse that a concurrent/sibling refresh already rotated past.
    const attemptedRefreshToken =
      typeof credentials?.refreshToken === "string" ? credentials.refreshToken : null;
    let persistFnRan = false;
    const persistFn = onCredentialsRefreshed
      ? async (refreshResult: Record<string, unknown>) => {
          persistFnRan = true;
          // Mutate the shared credentials object so subsequent executor calls
          // in this request see the new tokens. Runs INSIDE the mutex.
          Object.assign(credentials, refreshResult);
          await onCredentialsRefreshed(refreshResult);
        }
      : undefined;

    // #4038: build a compare-and-swap reread so getAccessToken can skip the persist if a
    // concurrent writer (sibling request / HealthCheck / replica) already rotated this
    // connection's refresh_token past the one we presented — overwriting would revert it
    // and revoke the token family. No connectionId ⇒ no guard (behavior unchanged).
    const casConnectionId =
      typeof credentials?.connectionId === "string" ? credentials.connectionId.trim() : "";
    const casReread = casConnectionId
      ? async () => {
          const latest = await getProviderConnectionById(casConnectionId);
          return typeof latest?.refreshToken === "string" ? latest.refreshToken : null;
        }
      : null;

    const newCredentials = (await refreshWithRetry(
      () =>
        runWithCasGuard(
          casReread ? { expectedRefreshToken: attemptedRefreshToken, reread: casReread } : null,
          () => runWithOnPersist(persistFn, () => executor.refreshCredentials(credentials, log))
        ),
=======
    const newCredentials = (await refreshWithRetry(
      () => executor.refreshCredentials(credentials, log),
>>>>>>> Stashed changes
      3,
      log,
      provider // Explicitly pass the provider to avoid universally tripping the "unknown" circuit breaker
    )) as null | {
      accessToken?: string;
      copilotToken?: string;
    };

    if (newCredentials?.accessToken || newCredentials?.copilotToken) {
      log?.info?.("TOKEN", `${provider.toUpperCase()} | refreshed`);

      // Update credentials
      Object.assign(credentials, newCredentials);

      // Notify caller about refreshed credentials
      if (onCredentialsRefreshed && newCredentials) {
        await onCredentialsRefreshed(newCredentials);
      }

      // Retry with new credentials — model + extra headers follow translatedBody.model so they
      // stay aligned if this block ever runs after a path that mutates body.model (e.g. fallback).
      try {
        const retryModelId = String(translatedBody.model || effectiveModel);
<<<<<<< Updated upstream
        const retryResult = await runWithCapture(providerRequestCapture, () =>
          executor.execute({
            model: retryModelId,
            body: translatedBody,
            stream: upstreamStream,
            credentials: getExecutionCredentials(),
            signal: streamController.signal,
            log,
            extendedContext,
            upstreamExtraHeaders: buildUpstreamHeadersForExecute(retryModelId),
            clientHeaders: buildExecutorClientHeaders(clientRawRequest?.headers, userAgent),
            onCredentialsRefreshed,
            skipUpstreamRetry: isCombo,
            contextEditing: { enabled: contextEditingEnabled },
          })
        );
=======
        const retryResult = await executor.execute({
          model: retryModelId,
          body: translatedBody,
          stream: upstreamStream,
          credentials: getExecutionCredentials(),
          signal: streamController.signal,
          log,
          extendedContext,
          upstreamExtraHeaders: buildUpstreamHeadersForExecute(retryModelId),
          clientHeaders: buildExecutorClientHeaders(clientRawRequest?.headers, userAgent),
          onCredentialsRefreshed,
        });
>>>>>>> Stashed changes

        if (retryResult.response.ok) {
          providerResponse = retryResult.response;
          providerUrl = retryResult.url;
<<<<<<< Updated upstream
          providerHeaders = new Headers(retryResult.headers || {});
          finalBody = providerRequestCapture.body(retryResult.transformedBody);
=======
          providerHeaders = retryResult.headers;
          finalBody = retryResult.transformedBody;
>>>>>>> Stashed changes
          reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
          updatePendingScope(pendingScope, {
            providerRequest: finalBody,
            providerUrl,
          });
          upstreamErrorParsed = false; // Reset since new response is OK
        } else {
          providerResponse = retryResult.response;
          upstreamErrorParsed = false; // Let it be parsed downstream
        }
      } catch {
        log?.warn?.("TOKEN", `${provider.toUpperCase()} | retry after refresh failed`);
      }
    } else {
      log?.warn?.("TOKEN", `${provider.toUpperCase()} | refresh failed`);
    }
  }

  await persistCodexQuotaState(providerResponse.headers, providerResponse.status);

  // Check provider response - return error info for fallback handling
  if (!providerResponse.ok) {
    trackPendingRequest(model, provider, connectionId, false);

    let statusCode = providerResponse.status;
    let message = "";
    let retryAfterMs: number | null = null;

    if (upstreamErrorParsed) {
      statusCode = parsedStatusCode;
      message = parsedMessage;
      retryAfterMs = parsedRetryAfterMs;
    } else {
      const details = await parseUpstreamError(providerResponse, provider);
      statusCode = details.statusCode;
      message = details.message;
      retryAfterMs = details.retryAfterMs;
      upstreamErrorBody = details.responseBody;
    }

    // T06/T10/T36: classify provider errors and persist terminal account states.
<<<<<<< Updated upstream
    let errorType = classifyProviderError(statusCode, message, provider);
    if (statusCode === 429 && isModelScope()) {
      const decision = classifyModelScope429(message, normalizeHeaders(providerResponse.headers));
      errorType =
        decision.kind === "quota_exhausted"
          ? PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED
          : PROVIDER_ERROR_TYPES.RATE_LIMITED;
      log?.warn?.(
        "MODELSCOPE_429",
        `${decision.kind} (model remaining: ${decision.snapshot.modelRemaining ?? "unknown"}, total remaining: ${decision.snapshot.totalRemaining ?? "unknown"})`
      );
    }
    const errorConnectionId = getCurrentConnectionId();
    if (errorConnectionId && errorType) {
=======
    const errorType = classifyProviderError(statusCode, message, provider);
    if (connectionId && errorType) {
>>>>>>> Stashed changes
      try {
        if (errorType === PROVIDER_ERROR_TYPES.FORBIDDEN) {
          await updateProviderConnection(errorConnectionId, {
            isActive: false,
            testStatus: "banned",
            lastErrorType: errorType,
            lastError: message,
            errorCode: statusCode,
          });
          console.warn(
            `[provider] Node ${errorConnectionId} banned (${statusCode}) — disabling permanently`
          );
        } else if (errorType === PROVIDER_ERROR_TYPES.ACCOUNT_DEACTIVATED) {
<<<<<<< Updated upstream
          // Plan A: if connection has extra API keys, don't disable — only the failing key is affected.
          // Single-key connections still get disabled as before.
          if (
            connectionHasExtraKeys(
              errorConnectionId,
              (credentials?.providerSpecificData as Record<string, unknown> | undefined)
                ?.extraApiKeys as string[] | undefined
            )
          ) {
            await updateProviderConnection(errorConnectionId, {
              lastErrorType: errorType,
              lastError: message,
              errorCode: statusCode,
            });
            console.warn(
              `[provider] Node ${errorConnectionId} account deactivated (${statusCode}) — has extra keys, keeping connection active`
            );
          } else {
            await updateProviderConnection(errorConnectionId, {
              isActive: false,
              testStatus: "deactivated",
              lastErrorType: errorType,
              lastError: message,
              errorCode: statusCode,
            });
            console.warn(
              `[provider] Node ${errorConnectionId} account deactivated (${statusCode}) — disabling permanently`
            );
          }
=======
          await updateProviderConnection(connectionId, {
            isActive: false,
            testStatus: "deactivated",
            lastErrorType: errorType,
            lastError: message,
            errorCode: statusCode,
          });
          console.warn(
            `[provider] Node ${connectionId} account deactivated (${statusCode}) — disabling permanently`
          );
>>>>>>> Stashed changes
        } else if (errorType === PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED) {
          // Providers with per-model quotas — lock the model only, not the connection
          const quotaCooldownMs = retryAfterMs || COOLDOWN_MS.rateLimit;
          const accountSemaphoreKey = resolveAccountSemaphoreKey({
            provider,
            model: currentModel,
            connectionId: errorConnectionId,
            credentials,
          });
          if (accountSemaphoreKey) {
            markAccountSemaphoreBlocked(accountSemaphoreKey, quotaCooldownMs);
          }
<<<<<<< Updated upstream
          if (isModelScope() && errorConnectionId) {
            lockModel(provider, errorConnectionId, model, "quota_exhausted", quotaCooldownMs);
            console.warn(
              `[provider] Node ${errorConnectionId} ModelScope model quota exhausted (${statusCode}) for ${model} - ${Math.ceil(quotaCooldownMs / 1000)}s (connection stays active)`
            );
          } else if (
=======
          if (
>>>>>>> Stashed changes
            lockModelIfPerModelQuota(
              provider,
              errorConnectionId,
              model,
              "quota_exhausted",
              quotaCooldownMs
            )
          ) {
            const quotaScope = getQuotaScopeLabelForProvider(provider, model);
            console.warn(
              `[provider] Node ${errorConnectionId} ${quotaScope}-only quota exhausted (${statusCode}) for ${model} - ${Math.ceil(quotaCooldownMs / 1000)}s (cooldown_scope=${quotaScope}, ttl_source=${retryAfterMs ? "upstream" : "inferred"}, connection stays active)`
            );
          } else {
            await updateProviderConnection(errorConnectionId, {
              testStatus: "credits_exhausted",
              lastErrorType: errorType,
              lastError: message,
              errorCode: statusCode,
            });
            console.warn(`[provider] Node ${errorConnectionId} exhausted quota (${statusCode})`);
          }
        } else if (errorType === PROVIDER_ERROR_TYPES.UNAUTHORIZED) {
          // Normal 401 (token/session auth issue): keep account active for refresh/re-auth.
          await updateProviderConnection(errorConnectionId, {
            lastErrorType: errorType,
            lastError: message,
            errorCode: statusCode,
          });
        } else if (errorType === PROVIDER_ERROR_TYPES.OAUTH_INVALID_TOKEN) {
          // OAuth 401 with invalid credentials - token refresh can recover
          await updateProviderConnection(errorConnectionId, {
            lastErrorType: errorType,
            lastError: message,
            errorCode: statusCode,
          });
          console.warn(
            `[provider] Node ${errorConnectionId} OAuth token invalid (${statusCode}) — token refresh available`
          );
        } else if (errorType === PROVIDER_ERROR_TYPES.PROJECT_ROUTE_ERROR) {
          // Cloud Code 403 with stale project: not a ban, keep account active.
          await updateProviderConnection(errorConnectionId, {
            lastErrorType: errorType,
            lastError: message,
            errorCode: statusCode,
          });
          console.warn(
            `[provider] Node ${errorConnectionId} project routing error (${statusCode}) — not banning`
          );
        }
      } catch {
        // Best-effort state update; request flow should continue with fallback handling.
      }
    }

    appendRequestLog({
      model,
      provider,
      connectionId: errorConnectionId,
      status: `FAILED ${statusCode}`,
    }).catch(() => {});

    const errMsg = formatProviderError(new Error(message), provider, model, statusCode);
    console.log(`${COLORS.red}[ERROR] ${errMsg}${COLORS.reset}`);

    // Log Antigravity retry time if available
    if (retryAfterMs && provider === "antigravity") {
      const retrySeconds = Math.ceil(retryAfterMs / 1000);
      log?.debug?.("RETRY", `Antigravity quota reset in ${retrySeconds}s (${retryAfterMs}ms)`);
    }

    // Log error with full request body for debugging
    reqLogger.logError(new Error(message), finalBody || translatedBody);
    reqLogger.logProviderResponse(
      providerResponse.status,
      providerResponse.statusText,
      providerResponse.headers,
      upstreamErrorBody
    );

    // Update rate limiter from error response headers
    updateFromHeaders(provider, errorConnectionId, providerResponse.headers, statusCode, model);
    if (errorConnectionId && upstreamErrorBody !== null && upstreamErrorBody !== undefined) {
      updateFromResponseBody(provider, errorConnectionId, upstreamErrorBody, statusCode, model);
    }

    // ── T5: Intra-family model fallback ──────────────────────────────────────
    // Before returning a model-unavailable error upstream, try sibling models
    // from the same family. This keeps the request alive on the same account
    // instead of failing the entire combo.
    if (isModelUnavailableError(statusCode, message)) {
      const nextModel = getNextFamilyFallback(currentModel, triedModels);
      if (nextModel) {
        triedModels.add(nextModel);
        currentModel = nextModel;
        translatedBody.model = nextModel;
        log?.info?.("MODEL_FALLBACK", `${model} unavailable (${statusCode}) → trying ${nextModel}`);
        // Re-execute with the fallback model
        try {
          const fallbackResult = await executeProviderRequest(nextModel, false);
          if (fallbackResult.response.ok) {
            providerResponse = fallbackResult.response;
            providerUrl = fallbackResult.url;
            providerHeaders = fallbackResult.headers;
            finalBody = providerRequestCapture.body(fallbackResult.transformedBody);
            reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
<<<<<<< Updated upstream
            updatePendingScope(pendingScope, {
              providerRequest: finalBody,
              providerUrl,
              stage: "provider_response_started",
            });
=======
>>>>>>> Stashed changes
            // Continue processing with the fallback response — skip error return
            log?.info?.("MODEL_FALLBACK", `Serving ${nextModel} as fallback for ${model}`);
            // Jump to streaming/non-streaming handling below
            // We fall through by NOT returning here
          } else {
            // Fallback also failed — return original error
            persistAttemptLogs({
              status: statusCode,
              error: errMsg,
              providerRequest: finalBody || translatedBody,
              providerResponse: upstreamErrorBody,
              clientResponse: buildErrorBody(statusCode, errMsg),
              cacheSource: "upstream",
            });
            persistFailureUsage(statusCode, "model_unavailable");
            return createErrorResult(statusCode, errMsg, retryAfterMs);
          }
        } catch {
          persistAttemptLogs({
            status: statusCode,
            error: errMsg,
            providerRequest: finalBody || translatedBody,
            providerResponse: upstreamErrorBody,
            clientResponse: buildErrorBody(statusCode, errMsg),
            cacheSource: "upstream",
          });
          persistFailureUsage(statusCode, "model_unavailable");
          return createErrorResult(statusCode, errMsg, retryAfterMs);
        }
      } else {
        persistAttemptLogs({
          status: statusCode,
          error: errMsg,
          providerRequest: finalBody || translatedBody,
          providerResponse: upstreamErrorBody,
          clientResponse: buildErrorBody(statusCode, errMsg),
          cacheSource: "upstream",
        });
        persistFailureUsage(statusCode, "model_unavailable");
        return createErrorResult(statusCode, errMsg, retryAfterMs);
      }
    } else if (isContextOverflowError(statusCode, message)) {
      const familyCandidates = getModelFamily(currentModel).filter(
        (m) => m !== currentModel && !triedModels.has(m)
      );
      const nextModel =
        findLargerContextModel(currentModel, familyCandidates) ??
        getNextFamilyFallback(currentModel, triedModels);
      if (nextModel) {
        triedModels.add(nextModel);
        currentModel = nextModel;
        translatedBody.model = nextModel;
        log?.info?.("CONTEXT_OVERFLOW_FALLBACK", `${model} context overflow → trying ${nextModel}`);
        try {
          const fallbackResult = await executeProviderRequest(nextModel, false);
          if (fallbackResult.response.ok) {
            providerResponse = fallbackResult.response;
            providerUrl = fallbackResult.url;
            providerHeaders = fallbackResult.headers;
            finalBody = providerRequestCapture.body(fallbackResult.transformedBody);
            reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
<<<<<<< Updated upstream
            updatePendingScope(pendingScope, {
              providerRequest: finalBody,
              providerUrl,
              stage: "provider_response_started",
            });
=======
>>>>>>> Stashed changes
            log?.info?.(
              "CONTEXT_OVERFLOW_FALLBACK",
              `Serving ${nextModel} as fallback for ${model}`
            );
          } else {
            persistAttemptLogs({
              status: statusCode,
              error: errMsg,
              providerRequest: finalBody || translatedBody,
              providerResponse: upstreamErrorBody,
              clientResponse: buildErrorBody(statusCode, errMsg),
              cacheSource: "upstream",
            });
            persistFailureUsage(statusCode, "context_overflow");
            return createErrorResult(statusCode, errMsg, retryAfterMs);
          }
        } catch {
          persistAttemptLogs({
            status: statusCode,
            error: errMsg,
            providerRequest: finalBody || translatedBody,
            providerResponse: upstreamErrorBody,
            clientResponse: buildErrorBody(statusCode, errMsg),
            cacheSource: "upstream",
          });
          persistFailureUsage(statusCode, "context_overflow");
          return createErrorResult(statusCode, errMsg, retryAfterMs);
        }
      } else {
        persistAttemptLogs({
          status: statusCode,
          error: errMsg,
          providerRequest: finalBody || translatedBody,
          providerResponse: upstreamErrorBody,
          clientResponse: buildErrorBody(statusCode, errMsg),
          cacheSource: "upstream",
        });
        persistFailureUsage(statusCode, "context_overflow");
        return createErrorResult(statusCode, errMsg, retryAfterMs);
      }
    } else {
      persistAttemptLogs({
        status: statusCode,
        error: errMsg,
        providerRequest: finalBody || translatedBody,
        providerResponse: upstreamErrorBody,
        clientResponse: buildErrorBody(statusCode, errMsg),
        cacheSource: "upstream",
      });
      persistFailureUsage(statusCode, `upstream_${statusCode}`);

      const requestHasTools =
        Array.isArray(translatedBody.tools) && translatedBody.tools.length > 0;
      let emergencyFallbackServed = false;

      if (!disableEmergencyFallback && !stream) {
        const fbDecision = shouldUseFallback(
          statusCode,
          message,
          requestHasTools,
          EMERGENCY_FALLBACK_CONFIG
        );
        if (isFallbackDecision(fbDecision)) {
          log?.info?.("EMERGENCY_FALLBACK", fbDecision.reason);
          try {
            const originalProvider = provider;
            const fbExecutor = getExecutor(fbDecision.provider);
            const fbResult = await fbExecutor.execute({
              model: fbDecision.model,
              body: {
                ...translatedBody,
                model: fbDecision.model,
                max_tokens: Math.min(
                  typeof translatedBody.max_tokens === "number"
                    ? translatedBody.max_tokens
                    : fbDecision.maxOutputTokens,
                  fbDecision.maxOutputTokens
                ),
                max_completion_tokens: Math.min(
                  typeof translatedBody.max_completion_tokens === "number"
                    ? translatedBody.max_completion_tokens
                    : typeof translatedBody.max_tokens === "number"
                      ? translatedBody.max_tokens
                      : fbDecision.maxOutputTokens,
                  fbDecision.maxOutputTokens
                ),
              },
              stream: false,
              credentials: credentials,
              signal: streamController.signal,
              log,
              extendedContext,
            });
            if (fbResult.response.ok) {
              provider = fbDecision.provider;
              model = fbDecision.model;
              translatedBody.model = fbDecision.model;
              providerResponse = fbResult.response;
              providerUrl = fbResult.url;
              providerHeaders = fbResult.headers;
              finalBody = fbResult.transformedBody;
              reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
              log?.info?.(
                "EMERGENCY_FALLBACK",
                `Serving ${fbDecision.provider}/${fbDecision.model} as budget fallback for ${originalProvider}/${requestedModel}`
              );
              emergencyFallbackServed = true;
            } else {
              log?.warn?.(
                "EMERGENCY_FALLBACK",
                `Emergency fallback also failed (${fbResult.response.status})`
              );
            }
          } catch (fbErr) {
            const errMessage = fbErr instanceof Error ? fbErr.message : String(fbErr);
            log?.warn?.("EMERGENCY_FALLBACK", `Emergency fallback error: ${errMessage}`);
          }
        }
      }

      if (!emergencyFallbackServed) {
        return createErrorResult(statusCode, errMsg, retryAfterMs);
      }
    }
    // ── End T5 ───────────────────────────────────────────────────────────────
  }

  // Non-streaming response
  if (!stream) {
<<<<<<< Updated upstream
    const parsed = await parseNonStreamingResponseBody({
      providerResponse,
      upstreamStream,
      providerHeaders,
      finalBody,
      targetFormat,
      model,
      log,
    });
    const normalizedProviderPayload = parsed.normalizedProviderPayload;
    const looksLikeSSE = parsed.looksLikeSSE;

    if (parsed.kind === "invalid_sse") {
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
      }).catch(() => {});
      const invalidSseMessage = parsed.message;
      persistAttemptLogs({
        status: HTTP_STATUS.BAD_GATEWAY,
        error: invalidSseMessage,
        providerRequest: finalBody || translatedBody,
        providerResponse: normalizedProviderPayload,
        clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, invalidSseMessage),
        cacheSource: "upstream",
      });
      persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "invalid_sse_payload");
      trackPendingRequest(model, provider, pendingConnId, false);
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, invalidSseMessage);
=======
    trackPendingRequest(model, provider, connectionId, false);
    const contentType = (providerResponse.headers.get("content-type") || "").toLowerCase();
    let responseBody;
    let responsePayloadFormat = targetFormat;
    const rawBody = await withBodyTimeout<string>(providerResponse.text());
    const normalizedProviderPayload = normalizePayloadForLog(rawBody);
    const looksLikeSSE =
      contentType.includes("text/event-stream") ||
      contentType.includes("application/x-ndjson") ||
      /(^|\n)\s*(event|data):/m.test(rawBody);

    if (looksLikeSSE) {
      const streamPayload = normalizeNonStreamingEventPayload(rawBody, contentType);
      const streamKind = contentType.includes("application/x-ndjson") ? "NDJSON" : "SSE";
      log?.warn?.(
        "STREAM",
        `Unexpected ${streamKind} response for non-streaming request — buffering`
      );
      // Upstream returned SSE even though stream=false; convert best-effort to JSON.
      const parsedFromSSE = parseNonStreamingSSEPayload(streamPayload, targetFormat, model);

      if (!parsedFromSSE) {
        appendRequestLog({
          model,
          provider,
          connectionId,
          status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
        }).catch(() => {});
        const invalidSseMessage = "Invalid SSE response for non-streaming request";
        persistAttemptLogs({
          status: HTTP_STATUS.BAD_GATEWAY,
          error: invalidSseMessage,
          providerRequest: finalBody || translatedBody,
          providerResponse: normalizedProviderPayload,
          clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, invalidSseMessage),
          cacheSource: "upstream",
        });
        persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "invalid_sse_payload");
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, invalidSseMessage);
      }

      responseBody = parsedFromSSE.body;
      responsePayloadFormat = parsedFromSSE.format;
    } else {
      try {
        responseBody = rawBody ? JSON.parse(rawBody) : {};
      } catch (err) {
        appendRequestLog({
          model,
          provider,
          connectionId,
          status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
        }).catch(() => {});
        const detailedError = `Invalid JSON response from provider (error: ${err instanceof Error ? err.message : String(err)}): ${rawBody.substring(0, 1000)}`;
        const invalidJsonMessage = "Invalid JSON response from provider";
        persistAttemptLogs({
          status: HTTP_STATUS.BAD_GATEWAY,
          error: detailedError,
          providerRequest: finalBody || translatedBody,
          providerResponse: normalizedProviderPayload,
          clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, invalidJsonMessage),
          cacheSource: "upstream",
        });
        persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "invalid_json_payload");
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, invalidJsonMessage);
      }
>>>>>>> Stashed changes
    }

    if (parsed.kind === "invalid_json") {
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
      }).catch(() => {});
      const detailedError = parsed.detailedError;
      const invalidJsonMessage = parsed.message;
      persistAttemptLogs({
        status: HTTP_STATUS.BAD_GATEWAY,
        error: detailedError,
        providerRequest: finalBody || translatedBody,
        providerResponse: normalizedProviderPayload,
        clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, invalidJsonMessage),
        cacheSource: "upstream",
      });
      persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "invalid_json_payload");
      trackPendingRequest(model, provider, connectionId, false);
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, invalidJsonMessage);
    }

    let responseBody = parsed.responseBody;
    let responsePayloadFormat = parsed.responsePayloadFormat;

    // ── ClinePass {success,data} envelope unwrap (before translation) ──────────
    // ClinePass wraps non-streaming JSON in a {success, data} envelope; errors
    // use {success:false, error}. Transient {success:false, error:"empty..."}
    // responses get one 2s retry before surfacing. CLINEPASS-GATED — untouched
    // for every other provider. Envelope errors route through createErrorResult
    // (→ buildErrorBody/sanitizeErrorMessage, Rule #12).
    if (provider === "clinepass") {
      let { body: unwrapped, error: envError } = unwrapClinepassEnvelope(responseBody, provider);
      if (envError && /empty/i.test(envError.message || "")) {
        log?.warn?.("RETRY", "clinepass returned empty content, retrying once after 2s");
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const retryResult = await executeProviderRequest(effectiveModel, false);
          if (retryResult?.response?.ok) {
            const retryParsed = await parseNonStreamingResponseBody({
              providerResponse: retryResult.response,
              upstreamStream: undefined,
              providerHeaders: retryResult.headers,
              finalBody: retryResult.transformedBody,
              targetFormat,
              model,
              log,
            });
            if (retryParsed.kind !== "invalid_sse" && retryParsed.kind !== "invalid_json") {
              providerResponse = retryResult.response;
              providerUrl = retryResult.url;
              providerHeaders = retryResult.headers;
              finalBody = providerRequestCapture.body(retryResult.transformedBody);
              ({ body: unwrapped, error: envError } = unwrapClinepassEnvelope(
                retryParsed.responseBody,
                provider
              ));
            }
          }
        } catch (retryErr) {
          log?.warn?.(
            "RETRY",
            `clinepass retry failed: ${
              retryErr instanceof Error ? retryErr.message : String(retryErr)
            }`
          );
        }
      }
      if (envError) {
        appendRequestLog({
          model,
          provider,
          connectionId,
          status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
        }).catch(() => {});
        persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "clinepass_envelope_error");
        trackPendingRequest(model, provider, connectionId, false);
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, envError.message);
      }
      responseBody = unwrapped;
    }
    responseBody = unwrapClineNonStreamingEnvelope(provider, responseBody);

    // Check for empty content response (fake success) - trigger fallback
    if (isEmptyContentResponse(responseBody)) {
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
      }).catch(() => {});
      const emptyContentMessage = "Provider returned empty content";
      persistAttemptLogs({
        status: HTTP_STATUS.BAD_GATEWAY,
        error: emptyContentMessage,
        providerRequest: finalBody || translatedBody,
        providerResponse: normalizedProviderPayload,
        clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, emptyContentMessage),
        cacheSource: "upstream",
      });
      persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "empty_content");

      // Trigger non-recursive fallback for empty content
      const nextModel = getNextFamilyFallback(currentModel, triedModels);
      if (nextModel) {
        triedModels.add(nextModel);
        currentModel = nextModel;
        translatedBody.model = nextModel;
        log?.info?.(
          "EMPTY_CONTENT_FALLBACK",
          `${model} returned empty content → trying ${nextModel}`
        );
        try {
          const fallbackResult = await executeProviderRequest(nextModel, false);
          if (fallbackResult.response.ok) {
            const fallbackRaw = await withBodyTimeout<string>(fallbackResult.response.text());
            try {
              responseBody = fallbackRaw ? JSON.parse(fallbackRaw) : {};
              providerUrl = fallbackResult.url;
              providerHeaders = fallbackResult.headers;
              finalBody = providerRequestCapture.body(fallbackResult.transformedBody);
              reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
              log?.info?.(
                "EMPTY_CONTENT_FALLBACK",
                `Serving ${nextModel} as fallback for ${model}`
              );
              // Fall through — continue processing with the new responseBody
            } catch {
              return createErrorResult(HTTP_STATUS.BAD_GATEWAY, emptyContentMessage);
            }
          } else {
            return createErrorResult(HTTP_STATUS.BAD_GATEWAY, emptyContentMessage);
          }
        } catch {
          return createErrorResult(HTTP_STATUS.BAD_GATEWAY, emptyContentMessage);
        }
      } else {
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, emptyContentMessage);
      }
    }

    const responseToolNameMap = mergeResponseToolNameMap(
      toolNameMap,
      (finalBody as Record<string, unknown> | null | undefined) ?? null
    );

    if (sourceFormat === FORMATS.CLAUDE && targetFormat === FORMATS.CLAUDE) {
      responseBody = restoreClaudePassthroughToolNames(responseBody, responseToolNameMap);
    }
    reqLogger.logProviderResponse(
      providerResponse.status,
      providerResponse.statusText,
      providerResponse.headers,
      looksLikeSSE
        ? {
            _streamed: true,
            _format: "sse-json",
            summary: responseBody,
          }
        : responseBody
    );

    // Notify success - caller can clear error status if needed
    if (onRequestSuccess) {
      await onRequestSuccess();
    }
    const successConnectionId = getCurrentConnectionId();
    await maybeSyncClaudeExtraUsageState({
      provider,
      connectionId: successConnectionId,
      providerSpecificData: credentials?.providerSpecificData,
      log,
    });

    // Log usage for non-streaming responses
    const usage = extractUsageFromResponse(responseBody, provider);
<<<<<<< Updated upstream
    if (usage && typeof usage === "object") {
      attachCompressionUsageReceiptAfterAnalytics(usage as Record<string, unknown>, "provider");
    }

    // Context Editing telemetry: when the delegated server-side clear actually ran,
    // record the provider's cleared-token receipt under engine "context-editing" so
    // it surfaces in compression analytics. Best-effort, Claude-only, non-streaming.
    recordContextEditingTelemetryHook({
      contextEditingEnabled,
      provider,
      responseBody,
      skillRequestId,
      log,
    });
    appendRequestLog({
      model,
      provider,
      connectionId: successConnectionId,
      tokens: usage,
      status: "200 OK",
    }).catch(() => {});

    // Save structured call log with full payloads
    const cacheUsageLogMeta = buildCacheUsageLogMeta(usage);
    recordNonStreamingUsageStats(usage, {
      traceEnabled,
      provider,
      connectionId: successConnectionId,
      model,
      startTime,
      apiKeyInfo,
      effectiveServiceTier,
      isCombo,
      comboStrategy,
      endpoint: endpointPath,
    });
=======
    appendRequestLog({ model, provider, connectionId, tokens: usage, status: "200 OK" }).catch(
      () => {}
    );

    // Save structured call log with full payloads
    const cacheUsageLogMeta = buildCacheUsageLogMeta(usage);
    if (usage && typeof usage === "object") {
      const msg = `[${new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}] 📊 [USAGE] ${provider.toUpperCase()} | ${formatUsageLog(usage)}${connectionId ? ` | account=${connectionId.slice(0, 8)}...` : ""}`;
      console.log(`${COLORS.green}${msg}${COLORS.reset}`);

      // Track cache token metrics
      const inputTokens = usage.prompt_tokens || 0;
      const cachedTokens = toPositiveNumber(
        usage.cache_read_input_tokens ??
          usage.cached_tokens ??
          (
            (usage as Record<string, unknown>).prompt_tokens_details as
              | Record<string, unknown>
              | undefined
          )?.cached_tokens
      );
      const cacheCreationTokens = toPositiveNumber(
        usage.cache_creation_input_tokens ??
          (
            (usage as Record<string, unknown>).prompt_tokens_details as
              | Record<string, unknown>
              | undefined
          )?.cache_creation_tokens
      );

      saveRequestUsage({
        provider: provider || "unknown",
        model: model || "unknown",
        tokens: usage,
        status: "200",
        success: true,
        latencyMs: Date.now() - startTime,
        timeToFirstTokenMs: Date.now() - startTime,
        errorCode: null,
        timestamp: new Date().toISOString(),
        connectionId: connectionId || undefined,
        apiKeyId: apiKeyInfo?.id || undefined,
        apiKeyName: apiKeyInfo?.name || undefined,
      }).catch((err) => {
        console.error("Failed to save usage stats:", err.message);
      });
    }
>>>>>>> Stashed changes

    // Translate response to client's expected format (usually OpenAI)
    // Pass toolNameMap so Claude OAuth proxy_ prefix is stripped in tool_use blocks (#605)
    let translatedResponse = needsTranslation(responsePayloadFormat, clientResponseFormat)
      ? translateNonStreamingResponse(
          responseBody,
          responsePayloadFormat,
          clientResponseFormat,
          responseToolNameMap as Map<string, string> | null
        )
      : responseBody;
    const memoryExtractionResponse = translatedResponse;

    // T26: Strip markdown code blocks if provider format is Claude
    if (sourceFormat === "claude" && !stream) {
      if (typeof translatedResponse?.choices?.[0]?.message?.content === "string") {
        translatedResponse.choices[0].message.content = stripMarkdownCodeFence(
          translatedResponse.choices[0].message.content
        ) as string;
      }
    }

    // T18: Normalize finish_reason to 'tool_calls' if tool calls are present
    if (translatedResponse?.choices) {
      for (const choice of translatedResponse.choices) {
        if (
          choice.message?.tool_calls &&
          choice.message.tool_calls.length > 0 &&
          choice.finish_reason !== "tool_calls"
        ) {
          choice.finish_reason = "tool_calls";
        }
      }
    }

    // Reasoning Replay Cache (#1628): Capture reasoning_content from non-streaming responses
    // with tool_calls so it can be replayed on subsequent turns (DeepSeek V4, Kimi K2, etc.)
    try {
      const firstChoice = translatedResponse?.choices?.[0];
      const msg = firstChoice?.message;
      cacheReasoningFromAssistantMessage(msg, provider, model);
    } catch {
      // Cache capture is non-critical — never block the response
    }
    // Sanitize response for OpenAI SDK compatibility
    // Strips non-standard fields (x_groq, usage_breakdown, service_tier, etc.)
    // Extracts <think> and <thinking> tags into reasoning_content
    // Source format determines output shape. If we are outputting OpenAI shape or pseudo-OpenAI shape, sanitize.
    if (clientResponseFormat === FORMATS.OPENAI_RESPONSES) {
      translatedResponse = sanitizeResponsesApiResponse(translatedResponse);
    } else if (clientResponseFormat === FORMATS.OPENAI) {
      // Port of decolua/9router#517: opt-in `x-omniroute-strip-reasoning` header
      // unconditionally drops `reasoning_content` from the final non-streaming
      // JSON for clients (e.g. Firecrawl AI SDK) whose JSON parsers break on
      // that non-standard field. Reasoning replay cache is captured above this
      // sanitize step, so the cache feature is unaffected.
      const stripReasoning = isStripReasoningRequested(clientRawRequest?.headers ?? null);
      translatedResponse = sanitizeOpenAIResponse(translatedResponse, {
        stripReasoning,
        parseTextualReasoningTags: shouldParseTextualReasoningTags(provider, model),
      });
    }

    applyClientUsageBuffer(translatedResponse, body, clientResponseFormat);

    if (memoryOwnerId && memorySettings?.enabled && memorySettings.maxTokens > 0) {
      const requestMemoryText = extractMemoryTextFromRequestBody(body as Record<string, unknown>);
      if (requestMemoryText) {
        extractFacts(requestMemoryText, memoryOwnerId, pipelineSessionId);
      }

      const memoryText = extractMemoryTextFromResponse(memoryExtractionResponse);
      if (memoryText) {
        extractFacts(memoryText, memoryOwnerId, pipelineSessionId);
      }
    }

    const customSkillExecutionEnabled =
      Boolean(memoryOwnerId) && memorySettings?.skillsEnabled === true;
    const builtinToolNames = webSearchFallbackPlan.toolName ? [webSearchFallbackPlan.toolName] : [];
    if (customSkillExecutionEnabled || builtinToolNames.length > 0) {
      const skillSessionId = pipelineSessionId;

      translatedResponse = await handleToolCallExecution(
        translatedResponse,
        getSkillsModelIdForFormat(sourceFormat),
        {
          apiKeyId: memoryOwnerId || "local",
          sessionId: skillSessionId,
          requestId: skillRequestId,
          builtinToolNames,
          customSkillExecutionEnabled,
        }
      );
    }

    const guardrailContext = buildPostCallGuardrailContext({
      apiKeyInfo,
      body,
      clientRawRequest,
      log,
      model,
      provider,
      responsePayloadFormat,
      clientResponseFormat,
    });
    const postCallGuardrails = await guardrailRegistry.runPostCallHooks(
      translatedResponse,
      guardrailContext
    );
    translatedResponse = postCallGuardrails.response;

    const responseUsage =
      (usage && typeof usage === "object" ? usage : null) ||
      (translatedResponse?.usage && typeof translatedResponse.usage === "object"
        ? translatedResponse.usage
        : null);
    const estimatedCost = responseUsage ? await calculateCost(provider, model, responseUsage) : 0;

    if (postCallGuardrails.blocked) {
      const guardrailMessage = postCallGuardrails.message || "Response blocked by guardrail";
      persistAttemptLogs({
        status: HTTP_STATUS.BAD_REQUEST,
        tokens: usage,
        responseBody,
        providerRequest: finalBody || translatedBody,
        providerResponse: looksLikeSSE
          ? {
              _streamed: true,
              _format: "sse-json",
              summary: responseBody,
            }
          : responseBody,
        clientResponse: buildErrorBody(HTTP_STATUS.BAD_REQUEST, guardrailMessage),
        claudeCacheMeta: claudePromptCacheLogMeta,
        claudeCacheUsageMeta: cacheUsageLogMeta,
        cacheSource: "upstream",
      });
      if (apiKeyInfo?.id && estimatedCost > 0) {
        recordCost(apiKeyInfo.id, estimatedCost);
      }
      log?.warn?.(
        "GUARDRAIL",
        `Response blocked by ${postCallGuardrails.guardrail || "guardrail"}: ${guardrailMessage}`
      );
<<<<<<< Updated upstream
      finalizePendingScope(pendingScope, {
        providerResponse: responseBody,
        clientResponse: translatedResponse,
      });
=======
>>>>>>> Stashed changes
      return createErrorResult(HTTP_STATUS.BAD_REQUEST, guardrailMessage);
    }

    // Validate the *translated* response actually carries client-usable output.
    // isEmptyContentResponse (above) runs on the raw responseBody before translation;
    // this check runs after translation + sanitization + tool-call execution to catch
    // cases where a provider returns a structurally valid raw body that translates into
    // choices:[] or output:[] with no usable content (Responses API shape included).
    const malformedTranslatedReason = detectMalformedNonStream(translatedResponse);
    if (malformedTranslatedReason) {
      const totalLatency = Date.now() - startTime;
      const rawBytes = (() => {
        try {
          return JSON.stringify(responseBody || {}).length;
        } catch {
          return -1;
        }
      })();
      reportMalformed200({
        mode: "nonstream",
        provider,
        model,
<<<<<<< Updated upstream
        connectionId,
        reason: malformedTranslatedReason,
        recvBytes: rawBytes,
        recvLines: -1,
        emitted: -1,
        events: {},
        ttftMs: totalLatency,
        elapsedMs: totalLatency,
      });
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}`,
      }).catch(() => {});
      const malformedMessage = `[${provider}/${model}] returned an empty response (no usable choices/output)`;
      persistAttemptLogs({
        status: HTTP_STATUS.BAD_GATEWAY,
        tokens: usage,
        responseBody,
        providerRequest: finalBody || translatedBody,
        providerResponse: looksLikeSSE
          ? { _streamed: true, _format: "sse-json", summary: responseBody }
          : responseBody,
        clientResponse: buildErrorBody(HTTP_STATUS.BAD_GATEWAY, malformedMessage),
        claudeCacheMeta: claudePromptCacheLogMeta,
        claudeCacheUsageMeta: cacheUsageLogMeta,
        cacheSource: "upstream",
      });
      persistFailureUsage(HTTP_STATUS.BAD_GATEWAY, "malformed_translated_response");
      trackPendingRequest(model, provider, pendingConnId, false);
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, malformedMessage);
=======
        body.messages ?? body.input,
        body.temperature,
        body.top_p
      );
      const tokensSaved = usage?.prompt_tokens + usage?.completion_tokens || 0;
      setCachedResponse(signature, model, translatedResponse, tokensSaved);
      log?.debug?.("CACHE", `Stored response for ${model} (${tokensSaved} tokens)`);
>>>>>>> Stashed changes
    }

    // ── Phase 9.1: Cache store (non-streaming, temp=0) ──
    storeSemanticCacheResponse({
      enabled: semanticCacheEnabled,
      body,
      headers: clientRawRequest?.headers,
      translatedResponse,
      model,
      apiKeyId: apiKeyInfo?.id ?? undefined,
      usage,
      log,
    });

    // ── Phase 9.2: Save for idempotency ──
    saveIdempotency(idempotencyKey, translatedResponse, 200);
    reqLogger.logConvertedResponse(translatedResponse);
    persistAttemptLogs({
      status: 200,
      tokens: usage,
      responseBody,
      providerRequest: finalBody || translatedBody,
      providerResponse: looksLikeSSE
        ? {
            _streamed: true,
            _format: "sse-json",
            summary: responseBody,
          }
        : responseBody,
      clientResponse: translatedResponse,
      claudeCacheMeta: claudePromptCacheLogMeta,
      claudeCacheUsageMeta: cacheUsageLogMeta,
      cacheSource: "upstream",
    });
    if (apiKeyInfo?.id && estimatedCost > 0) {
      recordCost(apiKeyInfo.id, estimatedCost);
    }

<<<<<<< Updated upstream
    // === Quota Share POST-hook (B/F7) — fire-and-forget, fail-open ===
    await scheduleQuotaShareConsumption({
      apiKeyId: apiKeyInfo?.id,
      connectionId: credentials?.connectionId,
      provider,
      model,
      usage,
      estimatedCost,
      log,
    });
    // === /Quota Share POST-hook ===

    // ── Gamification event (fire-and-forget) ──
    await emitRequestGamificationEvent({ apiKeyId: apiKeyInfo?.id, model, provider });

    finalizePendingScope(pendingScope, {
      providerResponse: responseBody,
      clientResponse: translatedResponse,
    });
    const responseHeaders = buildNonStreamingResponseHeaders({
      provider,
      model,
      startTime,
      responseUsage,
      estimatedCost,
      requestId: skillRequestId,
      compressionResponseMeta,
    });
    // #1311: echo the requested alias/combo name in the non-streaming response model.
    if (echoModel) echoModelInObject(translatedResponse, echoModel);
=======
>>>>>>> Stashed changes
    return {
      success: true,
      response: buildNonStreamingJsonResponse(translatedResponse, responseHeaders),
    };
  }

  // Streaming response
<<<<<<< Updated upstream
  // #3089 — some "reasoning" openai-compatible upstreams ignore a stream:true
  // request and return a complete application/json chat-completion body instead
  // of an SSE stream. The readiness check below only recognizes SSE `data:`
  // frames, so that body produced a spurious STREAM_EARLY_EOF / HTTP 502 even
  // though it carried valid content/reasoning_content. Detect a JSON (non-SSE)
  // upstream body and synthesize an equivalent OpenAI SSE stream so the
  // streaming pipeline (and the client) get a valid stream.
  providerResponse = await maybeConvertJsonBodyToSse(providerResponse, { log, provider, model });
  const streamReadinessPolicy = resolveStreamReadinessTimeout({
    baseTimeoutMs: STREAM_READINESS_TIMEOUT_MS,
    provider,
    model,
    body: (finalBody || translatedBody) as Record<string, unknown> | null | undefined,
    maxTimeoutMs: agentGoalPolicy.detected
      ? Math.max(STREAM_READINESS_MAX_TIMEOUT_MS, agentGoalPolicy.readinessMaxTimeoutMs)
      : STREAM_READINESS_MAX_TIMEOUT_MS,
  });
  if (streamReadinessPolicy.timeoutMs !== streamReadinessPolicy.baseTimeoutMs) {
    log?.debug?.(
      "STREAM",
      `adaptive readiness timeout=${streamReadinessPolicy.timeoutMs}ms base=${streamReadinessPolicy.baseTimeoutMs}ms reason=${streamReadinessPolicy.reasons.join(",")}`
    );
  }

=======
>>>>>>> Stashed changes
  const streamReadiness = await ensureStreamReadiness(providerResponse, {
    timeoutMs: STREAM_IDLE_TIMEOUT_MS,
    provider,
    model,
    log,
  });
  if (streamReadiness.ok === false) {
    const { response: failureResponse, reason } = streamReadiness;
    const failure = {
      status: failureResponse.status,
      message: reason,
      code: "stream_readiness_timeout",
      type: "stream_timeout",
    };
    trackPendingRequest(model, provider, connectionId, false);
    appendRequestLog({
      model,
      provider,
      connectionId,
      status: `FAILED ${failureResponse.status}`,
    }).catch(() => {});
    persistAttemptLogs({
      status: failureResponse.status,
      error: reason,
      providerRequest: finalBody || translatedBody,
      clientResponse: buildErrorBody(failureResponse.status, reason),
      claudeCacheMeta: claudePromptCacheLogMeta,
      cacheSource: "upstream",
    });
    persistFailureUsage(failureResponse.status, "stream_readiness_timeout");
    // Do NOT call onStreamFailure — a stream stall is an upstream issue,
    // not an account/quota failure. Marking the account unavailable here
    // would lock out legitimate accounts when the upstream hangs.
    return {
      success: false,
      status: failureResponse.status,
      error: reason,
      errorType: "stream_readiness_timeout",
      response: failureResponse,
    };
  }
  providerResponse = streamReadiness.response;

  // Notify success - caller can clear error status if needed
  if (onRequestSuccess) {
    await onRequestSuccess();
  }

<<<<<<< Updated upstream
  const responseHeaders = assembleStreamingResponseHeaders({
    providerHeaders: providerResponse.headers,
    provider,
    model,
    pendingRequestId,
    compressionResponseMeta,
  });
=======
  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    [OMNIROUTE_RESPONSE_HEADERS.cache]: "MISS",
    ...buildOmniRouteResponseMetaHeaders({
      provider,
      model,
      cacheHit: false,
      latencyMs: 0,
      usage: null,
      costUsd: 0,
    }),
  };
>>>>>>> Stashed changes

  // Create transform stream with logger for streaming response
  let transformStream;
  const responseToolNameMap = mergeResponseToolNameMap(
    toolNameMap,
    (finalBody as Record<string, unknown> | null | undefined) ?? null
  );

  let streamCompletionRecorded = false;
  let streamFailureCompletionRecorded = false;

  // Callback to save call log when stream completes (include responseBody when provided by stream)
  const onStreamComplete = ({
    status: streamStatus,
    usage: streamUsage,
    responseBody: streamResponseBody,
    providerPayload,
    clientPayload,
    error: streamError,
    errorCode: streamErrorCode,
    ttft,
  }) => {
    const normalizedStreamStatus = streamStatus || 200;
    if (streamCompletionRecorded) return;
    streamCompletionRecorded = true;
    if (normalizedStreamStatus !== 200) {
      if (streamFailureCompletionRecorded) return;
      streamFailureCompletionRecorded = true;
    }
    const cacheUsageLogMeta = buildCacheUsageLogMeta(streamUsage);
    const streamConnectionId = getCurrentConnectionId();

    if (normalizedStreamStatus === 200) {
      void maybeSyncClaudeExtraUsageState({
        provider,
        connectionId: streamConnectionId,
        providerSpecificData: credentials?.providerSpecificData,
        log,
      });
    }

    // Reasoning Replay Cache (#1628): Capture reasoning_content from streaming responses
    // with tool_calls so it can be replayed on subsequent turns (DeepSeek V4, Kimi K2, etc.)
    if (normalizedStreamStatus === 200 && streamResponseBody) {
      try {
        const body = streamResponseBody as Record<string, unknown>;
        const choices = body.choices as { message?: Record<string, unknown> }[] | undefined;
        const msg = choices?.[0]?.message;
        cacheReasoningFromAssistantMessage(msg, provider, model);
      } catch {
        // Cache capture is non-critical — never block the stream
      }
    }

    // Context Editing telemetry (streaming): the reconstructed stream body now carries
    // context_management.applied_edits from the final message_delta snapshot. Mirror the
    // non-streaming hook so streaming context-clear savings also surface under engine
    // "context-editing" in compression analytics. Best-effort, Claude-only.
    if (normalizedStreamStatus === 200) {
      recordContextEditingTelemetryHook({
        contextEditingEnabled,
        provider,
        responseBody: streamResponseBody,
        skillRequestId,
        log,
      });
    }

    streamFailure.finalizeStreamRequestLog({
      pendingRequestId,
      model,
      provider,
      connectionId: streamConnectionId,
      providerResponse: providerPayload ?? streamResponseBody ?? undefined,
      clientResponse: clientPayload ?? streamResponseBody ?? undefined,
      status: normalizedStreamStatus,
      error: streamError,
      errorCode: streamErrorCode,
    });

    // Track cache token metrics for streaming responses
    if (streamUsage && typeof streamUsage === "object") {
<<<<<<< Updated upstream
      attachCompressionUsageReceiptAfterAnalytics(streamUsage as Record<string, unknown>, "stream");
=======
      const inputTokens = streamUsage.prompt_tokens || 0;
      const cachedTokens = toPositiveNumber(
        streamUsage.cache_read_input_tokens ??
          streamUsage.cached_tokens ??
          (
            (streamUsage as Record<string, unknown>).prompt_tokens_details as
              | Record<string, unknown>
              | undefined
          )?.cached_tokens
      );
      const cacheCreationTokens = toPositiveNumber(
        streamUsage.cache_creation_input_tokens ??
          (
            (streamUsage as Record<string, unknown>).prompt_tokens_details as
              | Record<string, unknown>
              | undefined
          )?.cache_creation_tokens
      );

      saveRequestUsage({
        provider: provider || "unknown",
        model: model || "unknown",
        tokens: streamUsage,
        status: String(streamStatus || 200),
        success: streamStatus === 200,
        latencyMs: Date.now() - startTime,
        timeToFirstTokenMs: ttft,
        errorCode: null,
        timestamp: new Date().toISOString(),
        connectionId: connectionId || undefined,
        apiKeyId: apiKeyInfo?.id || undefined,
        apiKeyName: apiKeyInfo?.name || undefined,
      }).catch((err) => {
        console.error("Failed to save usage stats:", err.message);
      });
>>>>>>> Stashed changes
    }
    recordStreamingUsageStats(streamUsage, {
      provider,
      model,
      streamStatus: normalizedStreamStatus,
      startTime,
      ttft,
      streamErrorCode,
      connectionId: streamConnectionId,
      apiKeyInfo,
      effectiveServiceTier,
      isCombo,
      comboStrategy,
      endpoint: endpointPath,
    });

    persistAttemptLogs({
      status: normalizedStreamStatus,
      error: streamError || undefined,
      tokens: streamUsage || {},
      responseBody: streamResponseBody ?? undefined,
      providerRequest: finalBody || translatedBody,
      providerResponse: providerPayload,
      clientResponse: clientPayload ?? streamResponseBody ?? undefined,
      claudeCacheMeta: claudePromptCacheLogMeta,
      claudeCacheUsageMeta: cacheUsageLogMeta,
      cacheSource: "upstream",
    });

<<<<<<< Updated upstream
    recordStreamingCost({
      apiKeyId: apiKeyInfo?.id,
      provider,
      model,
      streamUsage,
      serviceTier: effectiveServiceTier,
      calculateCost,
      recordCost,
    });

    // === Quota Share POST-hook streaming (B/F7) — fire-and-forget, fail-open ===
    // Resolve the real per-request cost (calculateCost) so USD-unit pools accrue
    // on streaming traffic too; this previously recorded usd:0 hardcoded, which
    // meant DeepSeek-style `usd/monthly` shared pools never blocked on streams.
    scheduleStreamingQuotaShareConsumption({
      apiKeyId: apiKeyInfo?.id,
      connectionId: credentials?.connectionId,
      provider,
      model,
      streamUsage,
      streamStatus: normalizedStreamStatus,
      serviceTier: effectiveServiceTier,
      calculateCost,
      log,
    });
    // === /Quota Share POST-hook streaming ===

=======
    if (apiKeyInfo?.id && streamUsage) {
      calculateCost(provider, model, streamUsage)
        .then((estimatedCost) => {
          if (estimatedCost > 0) recordCost(apiKeyInfo.id, estimatedCost);
        })
        .catch(() => {});
    }

>>>>>>> Stashed changes
    if (
      memoryOwnerId &&
      memorySettings?.enabled &&
      memorySettings.maxTokens > 0 &&
      streamStatus === 200
    ) {
      const requestMemoryText = extractMemoryTextFromRequestBody(body as Record<string, unknown>);
      if (requestMemoryText) {
        extractFacts(requestMemoryText, memoryOwnerId, pipelineSessionId);
      }

      const streamedMemoryText = extractMemoryTextFromResponse(
        (streamResponseBody ?? null) as Record<string, unknown> | null
      );
      if (streamedMemoryText) {
        extractFacts(streamedMemoryText, memoryOwnerId, pipelineSessionId);
      }
    }

    // Semantic cache: store assembled streaming response for future cache hits
<<<<<<< Updated upstream
    storeStreamingSemanticCacheResponse({
      enabled: semanticCacheEnabled,
      streamStatus,
      streamResponseBody,
      body,
      headers: clientRawRequest?.headers,
      model,
      apiKeyId: apiKeyInfo?.id ?? undefined,
      streamUsage,
      log,
    });
=======
    if (
      semanticCacheEnabled &&
      streamStatus === 200 &&
      streamResponseBody &&
      isCacheableForWrite(body, clientRawRequest?.headers)
    ) {
      try {
        const cleanBody = { ...streamResponseBody };
        delete cleanBody._streamed;
        if (!isSmallEnoughForSemanticCache(cleanBody)) return;
        const sig = generateSignature(
          model,
          body.messages ?? body.input,
          body.temperature,
          body.top_p
        );
        const u = streamUsage as Record<string, unknown> | null;
        const tokensSaved =
          (Number(u?.prompt_tokens ?? 0) || 0) + (Number(u?.completion_tokens ?? 0) || 0);
        setCachedResponse(sig, model, cleanBody, tokensSaved);
        log?.debug?.("CACHE", `Stored streaming response for ${model} (${tokensSaved} tokens)`);
      } catch {
        // Cache write failed — non-critical
      }
    }
>>>>>>> Stashed changes
  };

  const streamFailureFinalizers = streamFailure.createStreamFailureFinalizers({
    isFailureCompletionRecorded: () => streamFailureCompletionRecorded,
    isStreamCompletionRecorded: () => streamCompletionRecorded,
    onStreamComplete,
    persistFailureUsage,
    onStreamFailure,
  });
  const handleStreamFailure = streamFailureFinalizers.handleStreamFailure;
  onPipelineStreamError = streamFailureFinalizers.onPipelineStreamError;
  onClientDisconnectFinalize = (event) =>
    handleStreamFailure({
      status: 499,
      message: `Client disconnected: ${event.reason}`,
      code: "client_disconnected",
      type: "client_disconnected",
    });

  // For providers using Responses API format, translate stream back to openai (Chat Completions) format
  // UNLESS client is Droid CLI which expects openai-responses format back
  const needsResponsesTranslation =
    targetFormat === FORMATS.OPENAI_RESPONSES &&
    clientResponseFormat === FORMATS.OPENAI &&
    !isResponsesEndpoint &&
    !isDroidCLI;
  const streamStateBody = finalBody || body;

  if (needsResponsesTranslation) {
    // Provider returns openai-responses, translate to openai (Chat Completions) that clients expect
    log?.debug?.("STREAM", `Responses translation mode: openai-responses → openai`);
    transformStream = createSSETransformStreamWithLogger(
      "openai-responses",
      "openai",
      provider,
      reqLogger,
      responseToolNameMap,
      model,
      connectionId,
      streamStateBody,
      onStreamComplete,
      apiKeyInfo,
      handleStreamFailure
    );
  } else if (needsTranslation(targetFormat, clientResponseFormat)) {
    // Standard translation for other providers
    log?.debug?.("STREAM", `Translation mode: ${targetFormat} → ${clientResponseFormat}`);
    transformStream = createSSETransformStreamWithLogger(
      targetFormat,
      clientResponseFormat,
      provider,
      reqLogger,
      responseToolNameMap,
      model,
      connectionId,
      streamStateBody,
      onStreamComplete,
      apiKeyInfo,
<<<<<<< Updated upstream
      handleStreamFailure,
      copilotCompatibleReasoning,
      // Suppress the `</think>` close marker for clients that render it verbatim
      // (e.g. OpenCode by UA; any client via `x-omniroute-thinking-marker: off`);
      // preserved for Claude Code / Cursor and unknown clients by default (#5245 /
      // #5312). The header wins over the UA allowlist.
      resolveSuppressThinkClose({
        userAgent: streamUserAgent,
        thinkingMarkerHeader,
      })
=======
      handleStreamFailure
>>>>>>> Stashed changes
    );
  } else {
    log?.debug?.("STREAM", `Standard passthrough mode`);
    transformStream = createPassthroughStreamWithLogger(
      provider,
      reqLogger,
      responseToolNameMap,
      model,
      connectionId,
      streamStateBody,
      onStreamComplete,
      apiKeyInfo,
      handleStreamFailure,
      clientResponseFormat
    );
  }

<<<<<<< Updated upstream
  const finalStream = assembleStreamingPipeline({
    providerResponse,
    transformStream,
    streamController,
    createPiiTransform,
    clientRawRequestHeaders: clientRawRequest?.headers,
    clientResponseFormat,
    echoModel,
    responseHeaders,
  });

  // ── Gamification event (fire-and-forget) ──
  await emitRequestGamificationEvent({ apiKeyId: apiKeyInfo?.id, model, provider });

  // ── Plugin onResponse hook (fire-and-forget) ──
  await runPluginOnResponseHook({ requestId: traceId, body, model, provider, apiKeyInfo });
=======
  // ── Phase 9.3: Progress tracking (opt-in) ──
  const progressEnabled = wantsProgress(clientRawRequest?.headers);
  let finalStream;
  if (progressEnabled) {
    const progressTransform = createProgressTransform({ signal: streamController.signal });
    // Chain: provider → transform → progress → client
    const transformedBody = pipeWithDisconnect(providerResponse, transformStream, streamController);
    finalStream = transformedBody.pipeThrough(progressTransform);
    responseHeaders[OMNIROUTE_RESPONSE_HEADERS.progress] = "enabled";
  } else {
    finalStream = pipeWithDisconnect(providerResponse, transformStream, streamController);
  }
>>>>>>> Stashed changes

  return {
    success: true,
    response: new Response(finalStream, {
      headers: responseHeaders,
    }),
  };
}

export function isTokenExpiringSoon(expiresAt, bufferMs = 5 * 60 * 1000) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return expiresAtMs - Date.now() < bufferMs;
}
