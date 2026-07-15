import { randomUUID } from "crypto";
import {
  getProviderCredentialsWithQuotaPreflight,
  markAccountUnavailable,
  extractApiKey,
} from "../services/auth";
import {
  getRuntimeProviderProfile,
  shouldMarkAccountExhaustedFrom429,
  clearModelLock,
  lockModel,
  recordModelLockoutFailure,
  isDailyQuotaExhausted,
} from "@omniroute/open-sse/services/accountFallback.ts";
import { getModelInfo, getComboForModel } from "../services/model";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
<<<<<<< Updated upstream
import { acceptHeaderForcesStream } from "@omniroute/open-sse/utils/aiSdkCompat.ts";
import { isSelfInflictedUpstreamTimeout } from "@omniroute/open-sse/handlers/chatCore/cooldownClassification.ts";
import { applyNoThinkingAlias } from "@omniroute/open-sse/utils/noThinkingAlias.ts";
=======
>>>>>>> Stashed changes
import { handleComboChat } from "@omniroute/open-sse/services/combo.ts";
import { resolveComboConfig } from "@omniroute/open-sse/services/comboConfig.ts";
import { injectHandoffIntoBody } from "@omniroute/open-sse/services/contextHandoff.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { getTargetFormat } from "@omniroute/open-sse/services/provider.ts";
import {
  getModelTargetFormat,
  PROVIDER_ID_TO_ALIAS,
} from "@omniroute/open-sse/config/providerModels.ts";
import * as log from "../utils/logger";
import { checkAndRefreshToken } from "../services/tokenRefresh";
import { deleteHandoff, getHandoff } from "@/lib/db/contextHandoffs";
import { getCachedSettings, getSettings, getCombos } from "@/lib/localDb";
import {
  ensureOpenAIStoreSessionFallback,
  isOpenAIResponsesStoreEnabled,
} from "@/lib/providers/requestDefaults";
import { guardrailRegistry, resolveDisabledGuardrails } from "@/lib/guardrails";
import {
  resolveModelOrError,
  checkPipelineGates,
  executeChatWithBreaker,
  handleNoCredentials,
  safeResolveProxy,
  safeLogEvents,
<<<<<<< Updated upstream
  applyExecutorProxyToInfo,
  shouldRetryStreamEarlyEof,
  withSessionHeader,
  withSelectedConnectionHeader,
  withCorrelationId,
=======
  withSessionHeader,
>>>>>>> Stashed changes
} from "./chatHelpers";

// Pipeline integration — wired modules
import { getCircuitBreaker } from "../../shared/utils/circuitBreaker";
import { markAccountExhaustedFrom429 } from "../../domain/quotaCache";
import { RequestTelemetry, recordTelemetry } from "../../shared/utils/requestTelemetry";
import { generateRequestId } from "../../shared/utils/requestId";
import { logAuditEvent } from "../../lib/compliance/index";
import { enforceApiKeyPolicy } from "../../shared/utils/apiKeyPolicy";
import { hasProviderQuotaBypassScope } from "../../shared/constants/apiKeyPolicyScopes";
import { cloneLogPayload } from "@/lib/logPayloads";
import {
  applyTaskAwareRouting,
  getTaskRoutingConfig,
} from "@omniroute/open-sse/services/taskAwareRouter.ts";
import {
  generateSessionId as generateStableSessionId,
  touchSession,
  extractExternalSessionId,
  checkSessionLimit,
  registerKeySession,
  isSessionRegisteredForKey,
} from "@omniroute/open-sse/services/sessionManager.ts";
import { startQuotaMonitor } from "@omniroute/open-sse/services/quotaMonitor.ts";
import {
  isFallbackDecision,
  shouldUseFallback,
} from "@omniroute/open-sse/services/emergencyFallback.ts";
import {
  registerCodexConnection,
  registerCodexQuotaFetcher,
} from "@omniroute/open-sse/services/codexQuotaFetcher.ts";
import { registerBailianCodingPlanQuotaFetcher } from "@omniroute/open-sse/services/bailianQuotaFetcher.ts";
import { registerCrofUsageFetcher } from "@omniroute/open-sse/services/crofUsageFetcher.ts";
import {
  getCooldownAwareRetryDecision,
  resolveCooldownAwareRetrySettings,
  waitForCooldownAwareRetry,
} from "../services/cooldownAwareRetry";

registerCodexQuotaFetcher();

// Register Bailian Coding Plan quota fetcher at module load (once per server start).
// This hooks into the quotaPreflight + quotaMonitor systems so that combos
// can proactively switch accounts before quota is exhausted.
registerBailianCodingPlanQuotaFetcher();

// Register CrofAI usage fetcher (subscription requests + credits balance).
// Surfaces usable_requests + credits in the monitor and only blocks (preflight
// opt-in) when the active bucket reaches zero.
registerCrofUsageFetcher();

function normalizeAllowedConnectionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
  return ids.length > 0 ? ids : null;
}

function intersectAllowedConnectionIds(primary: unknown, secondary: unknown): string[] | null {
  const first = normalizeAllowedConnectionIds(primary);
  const second = normalizeAllowedConnectionIds(secondary);

  if (first && second) {
    return first.filter((id) => second.includes(id));
  }

  return first || second || null;
}

const PROVIDER_BREAKER_FAILURE_STATUSES = new Set([408, 500, 502, 503, 504]);

/**
 * Handle chat completion request
 * Supports: OpenAI, Claude, Gemini, OpenAI Responses API formats
 * Format detection and translation handled by translator
 */
export async function handleChat(request: any, clientRawRequest: any = null) {
  // Pipeline: Start request telemetry
  const reqId = generateRequestId();
  const telemetry = new RequestTelemetry(reqId);

  let body;
  try {
    telemetry.startPhase("parse");
    body = await request.json();
    telemetry.endPhase();
  } catch {
    log.warn("CHAT", "Invalid JSON body");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  // Early guard: an explicitly empty `messages` array is invalid for every
  // upstream (Anthropic/OpenAI both reject "at least one message is required").
  // Forwarding it produced a confusing raw upstream 400/502; reject it here with
  // a clear OmniRoute-level error before any routing or upstream call (#5110).
  // Responses-API requests use `input` (not `messages`) so they are unaffected,
  // and an absent `messages` field is left to downstream validation.
  if (
    Array.isArray((body as { messages?: unknown }).messages) &&
    (body as { messages: unknown[] }).messages.length === 0
  ) {
    log.warn("CHAT", "Rejecting request with empty messages array");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: at least one message is required");
  }

  // buildClientRawRequest already deep-clones the body, so pass `body` directly — the
  // prior local clone was a redundant second full-body copy on the hot path (#5152).
  if (!clientRawRequest) {
    clientRawRequest = buildClientRawRequest(request, body);
  }

  // T01 — Accept-header streaming opt-in (#302 / #5305). A bare `Accept:
  // text/event-stream` with `stream` omitted opts a curl/httpx-style client into
  // SSE; a client that ALSO lists application/json (OpenAI / Vercel AI SDK
  // non-stream signature) does NOT — it expects a JSON object. An explicit body
  // `stream` value (true or false) always wins. See acceptHeaderForcesStream.
  const acceptHeader = request.headers.get("accept") || "";
  if (acceptHeaderForcesStream(acceptHeader, body.stream)) {
    body = { ...body, stream: true };
    log.debug(
      "STREAM",
      "Accept: text/event-stream header → overriding stream=true (body had no stream field)"
    );
  }

  // Log request endpoint and model
  const url = new URL(request.url);
  const modelStr = body.model;

  // Count messages (support both messages[] and input[] formats)
  const msgCount = body.messages?.length || body.input?.length || 0;
  const toolCount = body.tools?.length || 0;
  const effort = body.reasoning_effort || body.reasoning?.effort || null;
  log.request(
    "POST",
    `${url.pathname} | ${modelStr} | ${msgCount} msgs${toolCount ? ` | ${toolCount} tools` : ""}${effort ? ` | effort=${effort}` : ""}`
  );

  // Log API key (masked)
  const authHeader = request.headers.get("Authorization");
  const apiKey = extractApiKey(request);
  if (authHeader && apiKey) {
    log.debug("AUTH", `API Key: ${log.maskKey(apiKey)}`);
  } else {
    log.debug("AUTH", "No API key provided (local mode)");
  }

  const isComboLiveTest = request.headers?.get?.("x-internal-test") === "combo-health-check";

  if (!modelStr) {
    log.warn("CHAT", "Missing model");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }

  // T04: client-provided external session header has priority over generated fingerprint.
  const externalSessionId = extractExternalSessionId(request.headers);
  const sessionId = externalSessionId || generateStableSessionId(body);
  const requestedConnectionId = request.headers.get("x-omniroute-connection")?.trim() || null;
  if (sessionId) {
    touchSession(sessionId);
  }

  // Pipeline: API key policy enforcement (model restrictions + budget limits)
  telemetry.startPhase("policy");
  const policy = await enforceApiKeyPolicy(request, modelStr);
  if (policy.rejection) {
    log.warn(
      "POLICY",
      `API key policy rejected: ${modelStr} (key=${policy.apiKeyInfo?.id || "unknown"})`
    );
    return policy.rejection;
  }
  const apiKeyInfo = policy.apiKeyInfo;
  const bypassProviderQuotaPolicy = hasProviderQuotaBypassScope(apiKeyInfo?.scopes);
  telemetry.endPhase();

  // Guardrail pre-call pipeline — prompt injection, PII masking, and future custom rules.
  telemetry.startPhase("validate");
  const preCallGuardrails = await guardrailRegistry.runPreCallHooks(body, {
    apiKeyInfo,
    disabledGuardrails: resolveDisabledGuardrails({
      apiKeyInfo: apiKeyInfo as Record<string, unknown> | null,
      body,
      headers: request.headers,
    }),
    endpoint: new URL(request.url).pathname,
    headers: request.headers,
    log,
    method: request.method,
    model: modelStr,
    stream: body?.stream === true,
  });
  if (preCallGuardrails.blocked) {
    log.warn("GUARDRAIL", "Request blocked during pre-call guardrails", {
      guardrail: preCallGuardrails.guardrail,
      message: preCallGuardrails.message,
    });
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      preCallGuardrails.message || "Request rejected: suspicious content detected"
    );
  }
  body = preCallGuardrails.payload;
  telemetry.endPhase();

  // T08: per-key active session limit (0 = unlimited).
  if (apiKeyInfo?.id && sessionId) {
    const maxSessions =
      typeof apiKeyInfo.maxSessions === "number" && apiKeyInfo.maxSessions > 0
        ? apiKeyInfo.maxSessions
        : 0;

    if (maxSessions > 0 && !isSessionRegisteredForKey(apiKeyInfo.id, sessionId)) {
      const sessionViolation = checkSessionLimit(apiKeyInfo.id, maxSessions);
      if (sessionViolation) {
        return withSessionHeader(
          errorResponse(HTTP_STATUS.RATE_LIMITED, sessionViolation.message),
          sessionId
        );
      }
      registerKeySession(apiKeyInfo.id, sessionId);
    }
  }

  // T05 — Task-Aware Smart Routing
  // Detect the semantic task type and optionally route to the optimal model
  let resolvedModelStr = modelStr;
  let taskRouteInfo: { taskType: string; wasRouted: boolean } | null = null;
  if (getTaskRoutingConfig().enabled) {
    telemetry.startPhase("task-route");
    const tr = applyTaskAwareRouting(modelStr, body);
    if (tr.wasRouted) {
      resolvedModelStr = tr.model;
      body = { ...body, model: tr.model };
      log.info(
        "T05",
        `Task-Aware: detected="${tr.taskType}" → model override: ${modelStr} → ${tr.model}`
      );
    } else if (tr.taskType !== "chat") {
      log.debug("T05", `Task-Aware: detected="${tr.taskType}" (no override configured)`);
    }
    taskRouteInfo = { taskType: tr.taskType, wasRouted: tr.wasRouted };
    telemetry.endPhase();
  }

  // Check if model is a combo (has multiple models with fallback)
  telemetry.startPhase("resolve");
  const combo: any = await getComboForModel(resolvedModelStr);
  if (combo) {
    log.info(
      "CHAT",
      `Combo "${modelStr}" [${combo.strategy || "priority"}] with ${combo.models.length} models`
    );

    // Pre-check function used by combo routing. For explicit combo live tests,
    // avoid pre-skipping so each model gets a real execution attempt.
    const checkModelAvailable = async (
      modelString: string,
      target?: { connectionId?: string | null; allowedConnectionIds?: string[] | null }
    ) => {
      if (isComboLiveTest) return true;

      // Use getModelInfo to properly resolve custom prefixes
      const modelInfo = await getModelInfo(modelString);
      const provider = modelInfo.provider;
      if (!provider) return true; // can't determine provider, let it try

      const resolvedModel = modelInfo.model || modelString;
      const hasForcedConnection =
        typeof target?.connectionId === "string" && target.connectionId.trim().length > 0;
      const allowedConnections = intersectAllowedConnectionIds(
        apiKeyInfo?.allowedConnections ?? null,
        target?.allowedConnectionIds ?? null
      );

      if (Array.isArray(allowedConnections) && allowedConnections.length === 0) {
        return false;
      }

      const creds = await getProviderCredentialsWithQuotaPreflight(
        provider,
        null,
        allowedConnections,
        resolvedModel,
        {
          ...(target?.connectionId ? { forcedConnectionId: target.connectionId } : {}),
          ...(bypassProviderQuotaPolicy ? { bypassQuotaPolicy: true } : {}),
        }
      );
      if (!creds || creds.allRateLimited) return false;

      return true;
    };

    // Fetch settings and all combos for config cascade and nested resolution
    const [settings, allCombos] = await Promise.all([
      getSettings().catch(() => ({})),
      getCombos().catch(() => []),
    ]);
    const relayConfig =
      combo.strategy === "context-relay" ? resolveComboConfig(combo, settings) : null;
    const relayOptions =
      combo.strategy === "context-relay" || bypassProviderQuotaPolicy
        ? {
            ...(combo.strategy === "context-relay"
              ? {
                  sessionId,
                  config: relayConfig,
                }
              : {}),
            ...(bypassProviderQuotaPolicy ? { bypassProviderQuotaPolicy: true } : {}),
          }
        : undefined;
    telemetry.endPhase();

    // Context-relay keeps generation in combo.ts, but handoff injection lives here
    // because only this layer knows which connectionId was actually selected.
    const response = await (handleComboChat as any)({
      body,
      combo,
      handleSingleModel: (
        b: any,
        m: string,
        target?: {
          connectionId?: string | null;
          executionKey?: string | null;
          stepId?: string | null;
        }
      ) =>
        handleSingleModelChat(
          b,
          m,
          clientRawRequest,
          request,
          combo.name,
          apiKeyInfo,
          telemetry,
          {
            sessionId,
            forceLiveComboTest: isComboLiveTest,
            forcedConnectionId: target?.connectionId ?? null,
            allowedConnectionIds: target?.allowedConnectionIds ?? null,
            comboStepId: target?.stepId || null,
            comboExecutionKey: target?.executionKey || target?.stepId || null,
<<<<<<< Updated upstream
            skipUpstreamRetry: target?.failoverBeforeRetry ?? false,
            allowRateLimitedConnection: target?.allowRateLimitedConnection === true,
            preselectedCredentials: comboPreselectedCredentials.get(
              getComboCredentialCacheKey(m, target)
            ),
            cachedSettings: settings,
            providerId: target?.providerId ?? null,
            correlationId: reqId,
=======
>>>>>>> Stashed changes
          },
          combo.strategy,
          true
        ),
      isModelAvailable: checkModelAvailable,
      log,
      settings,
      allCombos,
<<<<<<< Updated upstream
      apiKeyAllowedConnections: apiKeyInfo?.allowedConnections ?? null,
      relayOptions,
=======
      relayOptions:
        combo.strategy === "context-relay"
          ? {
              sessionId,
              config: relayConfig,
            }
          : undefined,
>>>>>>> Stashed changes
      signal: request?.signal ?? null,
      correlationId: reqId,
    });

    // ── Global Fallback Provider (#689) ────────────────────────────────────
    // If combo exhausted all models, try the global fallback before giving up.
    if (
      !response.ok &&
      [502, 503].includes(response.status) &&
      typeof (settings as any)?.globalFallbackModel === "string" &&
      (settings as any).globalFallbackModel.trim()
    ) {
      const fallbackModel = (settings as any).globalFallbackModel.trim();
      log.info(
        "GLOBAL_FALLBACK",
        `Combo "${combo.name}" exhausted — attempting global fallback: ${fallbackModel}`
      );
      try {
        const fallbackResponse = await handleSingleModelChat(
          body,
          fallbackModel,
          clientRawRequest,
          request,
          combo.name,
          apiKeyInfo,
          telemetry,
          { sessionId, emergencyFallbackTried: true, forceLiveComboTest: isComboLiveTest },
          combo.strategy,
          true
        );
        if (fallbackResponse.ok) {
          log.info("GLOBAL_FALLBACK", `Global fallback ${fallbackModel} succeeded`);
          recordTelemetry(telemetry);
          return withSessionHeader(fallbackResponse, sessionId);
        }
        log.warn(
          "GLOBAL_FALLBACK",
          `Global fallback ${fallbackModel} also failed (${fallbackResponse.status})`
        );
      } catch (err: any) {
        log.warn("GLOBAL_FALLBACK", `Global fallback error: ${err?.message || "unknown"}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Record telemetry
    recordTelemetry(telemetry);
    // Log combo failures that bypassed handleChatCore (e.g. all targets skipped by circuit breaker)
    if (!response.ok) {
      try {
        const { saveCallLog } = await import("@/lib/usageDb");
        saveCallLog({
          id: undefined,
          method: "POST",
          path: clientRawRequest?.endpoint || "/v1/chat/completions",
          status: response.status,
          model: body?.model || resolvedModelStr,
          requestedModel: body?.model || resolvedModelStr,
          provider: "-",
          connectionId: undefined,
          duration: Date.now() - (telemetry?.startTime || Date.now()),
          tokens: {},
          error: `[${response.status}] Combo "${combo.name}" failed — all targets exhausted`,
          comboName: combo.name,
          comboStepId: null,
          comboExecutionKey: null,
          correlationId: reqId,
        }).catch(() => {});
      } catch {}
    }
    return withCorrelationId(withSessionHeader(response, sessionId), reqId);
  }
  telemetry.endPhase();

  // Single model request
  const response = await handleSingleModelChat(
    body,
    resolvedModelStr,
    clientRawRequest,
    request,
    null,
    apiKeyInfo,
    telemetry,
    {
      sessionId,
      forceLiveComboTest: isComboLiveTest,
      forcedConnectionId: requestedConnectionId,
      correlationId: reqId,
    },
    null,
    false
  );
  recordTelemetry(telemetry);
  return withCorrelationId(withSessionHeader(response, sessionId), reqId);
}

export function buildClientRawRequest(request: Request, body: unknown) {
  const url = new URL(request.url);
  return {
    endpoint: url.pathname,
    body: cloneLogPayload(body),
    headers: Object.fromEntries(request.headers.entries()),
    signal: request.signal ?? null,
  };
}

/**
 * Handle single model chat request
 *
 * Refactored: model resolution, logging, pipeline gates, and chat execution
 * extracted to focused helpers. This function orchestrates the credential
 * retry loop.
 */
async function handleSingleModelChat(
  body: any,
  modelStr: string,
  clientRawRequest: any = null,
  request: any = null,
  comboName: string | null = null,
  apiKeyInfo: any = null,
  telemetry: any = null,
  runtimeOptions: {
    emergencyFallbackTried?: boolean;
    forceLiveComboTest?: boolean;
    sessionId?: string | null;
    forcedConnectionId?: string | null;
    allowedConnectionIds?: string[] | null;
    comboStepId?: string | null;
    comboExecutionKey?: string | null;
<<<<<<< Updated upstream
    skipUpstreamRetry?: boolean;
    allowRateLimitedConnection?: boolean;
    preselectedCredentials?: any;
    cachedSettings?: any;
    providerId?: string | null;
    correlationId?: string | null;
=======
>>>>>>> Stashed changes
  } = {},
  comboStrategy: string | null = null,
  isCombo: boolean = false
) {
  // 1. Resolve model → provider/model
  const resolved = await resolveModelOrError(modelStr, body, clientRawRequest?.endpoint);
  if (resolved.error) return resolved.error;

<<<<<<< Updated upstream
  // Safety net: if auto-combo resolution returned a combo object, redirect
  // to combo flow. This handles the case where the auto-fuzzy match in
  // resolveModelOrError found a combo but the main handler's combo lookup missed it.
  if ((resolved as any).combo) {
    const redirectCombo = (resolved as any).combo;
    log.info(
      "ROUTING",
      `Safety-net combo redirect for "${modelStr}" → combo="${redirectCombo.name}"`
    );
    log.info("ROUTING", `Auto-combo redirect from handleSingleModelChat for "${modelStr}"`);
    log.info("ROUTING", `Auto-combo redirect to combo flow for "${modelStr}"`);
    return handleComboChat({
      body,
      combo: redirectCombo,
      handleSingleModel: (
        b: any,
        m: string,
        target?: {
          connectionId?: string | null;
          executionKey?: string | null;
          stepId?: string | null;
          failoverBeforeRetry?: boolean;
          allowRateLimitedConnection?: boolean;
          providerId?: string | null;
          effectiveComboStrategy?: string | null;
        }
      ) =>
        handleSingleModelChat(
          b,
          m,
          clientRawRequest,
          request,
          redirectCombo.name ?? modelStr,
          apiKeyInfo,
          telemetry,
          {
            sessionId: "", // safety-net redirect doesn't have session context
            forceLiveComboTest: false,
            forcedConnectionId: null,
            allowedConnectionIds: null,
            comboStepId: null,
            comboExecutionKey: null,
            skipUpstreamRetry: target?.failoverBeforeRetry ?? false,
            allowRateLimitedConnection: target?.allowRateLimitedConnection === true,
            providerId: target?.providerId ?? null,
            correlationId: runtimeOptions?.correlationId ?? null,
          },
          target?.effectiveComboStrategy ?? redirectCombo.strategy ?? "priority",
          false
        ),
      isModelAvailable: async () => true,
      log,
      settings: {},
      allCombos: [],
      relayOptions: undefined,
      signal: request?.signal ?? null,
      correlationId: reqId,
    });
  }

  const {
    provider: resolvedProvider,
    model,
    sourceFormat,
    targetFormat,
    extendedContext,
    apiFormat,
  } = resolved;
  // Prefer the combo target's providerId when available — the model string's
  // provider prefix may differ from the credential provider ID (e.g. model
  // "xiaomi/mimo-v2-flash" resolves to provider "xiaomi" but the combo target
  // may specify providerId: "opengate" for credential lookup).
  // Guard: if runtimeOptions.providerId is merely the prefix already encoded in
  // the model string (e.g. "p2" from "p2/test-model"), and resolveModelOrError
  // expanded it to a full custom-node ID (e.g. "openai-compatible-chat-e2e-p2"),
  // trust resolvedProvider so the executor receives the full node ID and can
  // correctly resolve the custom baseUrl. (#3058 follow-up)
  const provider = (() => {
    if (!runtimeOptions.providerId) return resolvedProvider;
    // If the override is identical to resolvedProvider, no-op.
    if (runtimeOptions.providerId === resolvedProvider) return resolvedProvider;
    // If the model string already encodes runtimeOptions.providerId as its prefix,
    // the override is implicit (not an intentional redirect) — use resolvedProvider.
    if (modelStr.startsWith(runtimeOptions.providerId + "/")) return resolvedProvider;
    // Intentional override (e.g. providerId points to a different credential pool).
    return runtimeOptions.providerId;
  })();
=======
  const { provider, model, sourceFormat, targetFormat, extendedContext } = resolved;
>>>>>>> Stashed changes
  const forceLiveComboTest = runtimeOptions.forceLiveComboTest === true;
  const bypassProviderQuotaPolicy = hasProviderQuotaBypassScope(apiKeyInfo?.scopes);
  const hasForcedConnection =
    typeof runtimeOptions.forcedConnectionId === "string" &&
    runtimeOptions.forcedConnectionId.trim().length > 0;
  const effectiveAllowedConnections = intersectAllowedConnectionIds(
    apiKeyInfo?.allowedConnections ?? null,
    runtimeOptions.allowedConnectionIds ?? null
  );
  const bypassReason = forceLiveComboTest
    ? "combo live test"
    : hasForcedConnection
      ? "fixed combo step connection"
      : undefined;

  // 2. Pipeline gates (availability + provider circuit breaker)
  const providerProfile = await getRuntimeProviderProfile(provider);
  const gate = await checkPipelineGates(provider, model, {
    ignoreCircuitBreaker: forceLiveComboTest || hasForcedConnection,
    ignoreModelCooldown: forceLiveComboTest || hasForcedConnection,
    providerProfile,
    ...(bypassReason ? { bypassReason } : {}),
  });
  if (gate) {
    // Log the rejected request so it appears in /dashboard/logs
    try {
      const { saveCallLog } = await import("@/lib/usageDb");
      saveCallLog({
        id: undefined,
        method: "POST",
        path: clientRawRequest?.endpoint || "/v1/chat/completions",
        status: gate.status,
        model,
        requestedModel: body?.model || modelStr,
        provider,
        connectionId: undefined,
        duration: Date.now() - (telemetry?.startTime || Date.now()),
        tokens: {},
        error: `[${gate.status}] Pipeline gate rejected`,
        comboName: isCombo ? comboName : null,
        comboStepId: isCombo ? (runtimeOptions?.comboStepId ?? null) : null,
        comboExecutionKey: isCombo ? (runtimeOptions?.comboExecutionKey ?? null) : null,
        correlationId: runtimeOptions?.correlationId ?? null,
      }).catch(() => {});
    } catch {}
    return gate;
  }

  const breaker = getCircuitBreaker(provider, {
    failureThreshold: providerProfile.failureThreshold,
    resetTimeout: providerProfile.resetTimeoutMs,
    onStateChange: (name: string, from: string, to: string) =>
      log.info("CIRCUIT", `${name}: ${from} → ${to}`),
  });

  const userAgent = request?.headers?.get("user-agent") || "";
  const baseRetrySettings = resolveCooldownAwareRetrySettings(
    await getCachedSettings().catch(() => ({}))
  );
  const disableCooldownAwareRetry =
    isCombo || forceLiveComboTest || runtimeOptions.emergencyFallbackTried === true;
  const retrySettings = disableCooldownAwareRetry
    ? {
        ...baseRetrySettings,
        enabled: false,
        maxRetries: 0,
        maxRetryWaitSec: 0,
        maxRetryWaitMs: 0,
      }
    : baseRetrySettings;
  const requestSignal = request?.signal ?? null;

  if (Array.isArray(effectiveAllowedConnections) && effectiveAllowedConnections.length === 0) {
    log.debug("AUTH", `${provider}/${model} filtered out by connection-level routing constraints`);
    return errorResponse(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      "No eligible connections matched the requested routing constraints"
    );
  }

  // 3. Credential retry loop
  let requestRetryAttempt = 0;
  let requestRetryLastError = null;
  let requestRetryLastStatus = null;
  let requestRetryLastCooldownMs = 0;

  requestAttemptLoop: while (true) {
    const excludedConnectionIds = new Set<string>();
    let lastError = requestRetryLastError;
    let lastStatus = requestRetryLastStatus;
    let lastCooldownMs = requestRetryLastCooldownMs;

    while (true) {
<<<<<<< Updated upstream
      const credentials =
        preselectedCredentials && excludedConnectionIds.size === 0
          ? preselectedCredentials
          : await getProviderCredentialsWithQuotaPreflight(
              provider,
              null,
              effectiveAllowedConnections,
              model,
              {
                sessionKey: runtimeOptions.sessionAffinityKey ?? runtimeOptions.sessionId ?? null,
                excludeConnectionIds: Array.from(excludedConnectionIds),
                ...(runtimeOptions.allowRateLimitedConnection
                  ? { allowRateLimitedConnections: true }
                  : {}),
                ...(forceLiveComboTest
                  ? {
                      allowSuppressedConnections: true,
                      bypassQuotaPolicy: true,
                    }
                  : {}),
                ...(!forceLiveComboTest && bypassProviderQuotaPolicy
                  ? { bypassQuotaPolicy: true }
                  : {}),
                ...(runtimeOptions.forcedConnectionId
                  ? { forcedConnectionId: runtimeOptions.forcedConnectionId }
                  : {}),
=======
      const credentials = await getProviderCredentialsWithQuotaPreflight(
        provider,
        null,
        effectiveAllowedConnections,
        model,
        {
          excludeConnectionIds: Array.from(excludedConnectionIds),
          ...(forceLiveComboTest
            ? {
                allowSuppressedConnections: true,
                bypassQuotaPolicy: true,
>>>>>>> Stashed changes
              }
            : {}),
          ...(runtimeOptions.forcedConnectionId
            ? { forcedConnectionId: runtimeOptions.forcedConnectionId }
            : {}),
        }
      );

      if (!credentials || "allRateLimited" in credentials) {
        if (credentials?.allRateLimited) {
          const retryDecision = getCooldownAwareRetryDecision({
            retryAfter: credentials.retryAfter,
            settings: retrySettings,
            attempt: requestRetryAttempt,
          });

          if (retryDecision.shouldRetry) {
            const waitSec = Math.max(Math.ceil(retryDecision.waitMs / 1000), 0);
            log.info(
              "COOLDOWN_RETRY",
              `${provider}/${model} all connections cooling down (${retryDecision.retryAfterHuman || `retry in ${waitSec}s`}) — waiting ${waitSec}s before retry ${requestRetryAttempt + 1}/${retrySettings.maxRetries}`
            );

            const completed = await waitForCooldownAwareRetry(retryDecision.waitMs, requestSignal);
            if (!completed) {
              log.info(
                "COOLDOWN_RETRY",
                `${provider}/${model} retry wait aborted by client disconnect`
              );
              return errorResponse(499, "Request aborted");
            }

            requestRetryAttempt += 1;
            log.info(
              "COOLDOWN_RETRY",
              `${provider}/${model} cooldown elapsed — restarting request attempt ${requestRetryAttempt}/${retrySettings.maxRetries}`
            );
            continue requestAttemptLoop;
          }
        }

        const breakerFailureStatus = Number(lastStatus ?? credentials?.lastErrorCode);
        if (
          !forceLiveComboTest &&
          credentials?.allRateLimited &&
          PROVIDER_BREAKER_FAILURE_STATUSES.has(breakerFailureStatus)
        ) {
          breaker._onFailure();
        }

        return handleNoCredentials(
          credentials,
          excludedConnectionIds.size > 0 ? Array.from(excludedConnectionIds)[0] : null,
          provider,
          model,
          lastError,
          lastStatus
        );
      }

      const accountId = credentials.connectionId.slice(0, 8);
      log.info("AUTH", `Using ${provider} account: ${accountId}...`);
      let requestBody = body;
      let injectedHandoff = null;
      if (
        comboStrategy === "context-relay" &&
        comboName &&
        runtimeOptions.sessionId &&
        body?._omnirouteSkipContextRelay !== true
      ) {
        const handoff = getHandoff(runtimeOptions.sessionId, comboName);
        if (handoff && handoff.fromAccount !== credentials.connectionId) {
          // Inject only after a real account switch. The combo loop itself cannot
          // reliably detect this because account selection happens inside auth.
          requestBody = injectHandoffIntoBody(body, handoff);
          injectedHandoff = handoff;
          log.info(
            "CONTEXT_RELAY",
            `Injecting handoff for session ${runtimeOptions.sessionId}: ${handoff.fromAccount.slice(
              0,
              8
            )} -> ${credentials.connectionId.slice(0, 8)}`
          );
        }
      }
      const refreshedCredentials = await checkAndRefreshToken(provider, credentials);
      const storeEnabled = isOpenAIResponsesStoreEnabled(
        refreshedCredentials?.providerSpecificData ?? credentials?.providerSpecificData
      );
      if (provider === "codex" && storeEnabled && runtimeOptions.sessionId) {
        requestBody = ensureOpenAIStoreSessionFallback(requestBody, runtimeOptions.sessionId);
      }
      if (provider === "codex" && refreshedCredentials?.accessToken && credentials.connectionId) {
        const workspaceId =
          typeof refreshedCredentials?.providerSpecificData?.workspaceId === "string" &&
          refreshedCredentials.providerSpecificData.workspaceId.trim().length > 0
            ? refreshedCredentials.providerSpecificData.workspaceId
            : typeof credentials?.providerSpecificData?.workspaceId === "string" &&
                credentials.providerSpecificData.workspaceId.trim().length > 0
              ? credentials.providerSpecificData.workspaceId
              : undefined;
        registerCodexConnection(credentials.connectionId, {
          accessToken: refreshedCredentials.accessToken,
          ...(workspaceId ? { workspaceId } : {}),
        });
      }
      if (runtimeOptions.sessionId && body?._omnirouteInternalRequest !== "context-handoff") {
        touchSession(runtimeOptions.sessionId, credentials.connectionId);
        startQuotaMonitor(
          runtimeOptions.sessionId,
          provider,
          credentials.connectionId,
          refreshedCredentials
        );
      }
<<<<<<< Updated upstream
      const proxyInfo = await safeResolveProxy(credentials.connectionId, apiKeyInfo?.id);
      // #5217: sink for the proxy the executor pins internally (e.g. OpencodeExecutor
      // rotation) so the egress log below reflects the real egress, not "direct".
      const appliedProxySink: { proxy: unknown } = { proxy: null };
=======
      const proxyInfo = await safeResolveProxy(credentials.connectionId);
>>>>>>> Stashed changes
      const proxyStartTime = Date.now();

      // 4. Execute chat via core after breaker gate checks (with optional TLS tracking)
      if (telemetry) telemetry.startPhase("connect");
      const { result, tlsFingerprintUsed } = await executeChatWithBreaker({
        bypassCircuitBreaker: forceLiveComboTest || hasForcedConnection,
        breaker,
        body: requestBody,
        provider,
        model,
        refreshedCredentials,
        proxyInfo,
        appliedProxySink,
        log,
        clientRawRequest,
        credentials,
        apiKeyInfo,
        userAgent,
        comboName,
        comboStrategy,
        isCombo,
        comboStepId: runtimeOptions.comboStepId ?? null,
        comboExecutionKey: runtimeOptions.comboExecutionKey ?? runtimeOptions.comboStepId ?? null,
        extendedContext,
        providerProfile,
<<<<<<< Updated upstream
        cachedSettings: runtimeOptions.cachedSettings,
        skipUpstreamRetry: runtimeOptions.skipUpstreamRetry ?? false,
        correlationId: runtimeOptions?.correlationId ?? null,
=======
>>>>>>> Stashed changes
      });
      if (telemetry) telemetry.endPhase();

      const proxyLatency = Date.now() - proxyStartTime;
      const providerAlias = PROVIDER_ID_TO_ALIAS[provider] || provider;
      const effectiveTargetFormat =
        getModelTargetFormat(providerAlias, model) ||
        getTargetFormat(provider, credentials.providerSpecificData) ||
        targetFormat;

<<<<<<< Updated upstream
      // 5. Log proxy + translation events (fire-and-forget; never blocks the response)
      // #5217: reflect the proxy the executor actually applied (per-account rotation).
      void safeLogEvents({
=======
      // 5. Log proxy + translation events
      safeLogEvents({
>>>>>>> Stashed changes
        result,
        proxyInfo: applyExecutorProxyToInfo(proxyInfo, appliedProxySink.proxy),
        proxyLatency,
        provider,
        model,
        sourceFormat,
        targetFormat: effectiveTargetFormat,
        credentials,
        comboName,
        clientRawRequest,
        tlsFingerprintUsed,
      });

      if (result.success) {
        clearModelLock(provider, credentials.connectionId, model);
        if (!forceLiveComboTest) {
          breaker._onSuccess();
        }
        if (injectedHandoff && runtimeOptions.sessionId && comboName) {
          deleteHandoff(runtimeOptions.sessionId, comboName);
        }
        if (telemetry) telemetry.startPhase("finalize");
        if (telemetry) telemetry.endPhase();
        return result.response;
      }

      if (result.errorType === "stream_readiness_timeout") {
        // Stream readiness timeout is an upstream stall, not an account/quota failure.
        // Do NOT mark the account as unavailable or trip the circuit breaker.
        return result.response;
      }

      // Emergency fallback for budget exhaustion (402 / billing / quota keywords):
      // reroute to a free model (default provider/model: nvidia + openai/gpt-oss-120b) exactly once.
      if (!runtimeOptions.emergencyFallbackTried) {
        const fallbackDecision = shouldUseFallback(
          Number(result.status || 0),
          String(result.error || ""),
          Array.isArray(body?.tools) && body.tools.length > 0
        );

        if (isFallbackDecision(fallbackDecision)) {
          const fallbackModelStr = `${fallbackDecision.provider}/${fallbackDecision.model}`;
          const currentModelStr = `${provider}/${model}`;

          if (fallbackModelStr !== currentModelStr) {
            const fallbackBody = { ...body, model: fallbackModelStr };

            // Cap output on emergency fallback to avoid unexpected long responses.
            const maxTokens = Math.min(
              Number(
                fallbackBody.max_tokens ??
                  fallbackBody.max_completion_tokens ??
                  fallbackDecision.maxOutputTokens
              ) || fallbackDecision.maxOutputTokens,
              fallbackDecision.maxOutputTokens
            );
            fallbackBody.max_tokens = maxTokens;
            fallbackBody.max_completion_tokens = maxTokens;

            log.warn(
              "EMERGENCY_FALLBACK",
              `${currentModelStr} -> ${fallbackModelStr} | reason=${fallbackDecision.reason}`
            );

            const fallbackResponse = await handleSingleModelChat(
              fallbackBody,
              fallbackModelStr,
              clientRawRequest,
              request,
              comboName,
              apiKeyInfo,
              telemetry,
              {
                ...runtimeOptions,
                emergencyFallbackTried: true,
                forcedConnectionId: null,
                comboStepId: null,
                comboExecutionKey: null,
              },
              null, // no strategy for emergency fallback
              Boolean(comboName) // isCombo if comboName exists
            );

            if (fallbackResponse.ok) {
              return fallbackResponse;
            }

            log.warn(
              "EMERGENCY_FALLBACK",
              `Emergency fallback to ${fallbackModelStr} failed with status ${fallbackResponse.status}. Resuming original provider account fallback.`
            );
          }
        }
      }

      // 6. Daily quota error check - must be executed before markAccountUnavailable
      // Check if it's a daily quota exhausted error (e.g., ModelScope/Kimi "today's quota for model")
      // Daily quota lockout overrides subsequent rate_limited lockout, ensuring lockout until tomorrow 0:00
      let dailyQuotaExhausted = false;
      const errorStr = String(result.error || "");
      if (result.status === 429 && isDailyQuotaExhausted(errorStr)) {
        // Parse which model is quota-limited
        const match = errorStr.match(/today's quota for model ([^,]+)/);
        const limitedModel = match ? match[1].trim() : model;

        // Lock this model on this connection until tomorrow 00:00
        const lockResult = recordModelLockoutFailure(
          provider,
          credentials.connectionId,
          limitedModel,
          "quota_exhausted",
          result.status,
          0,
          providerProfile
        );

        log.info(
          "MODEL_DAILY_QUOTA",
          JSON.stringify({
            connection: credentials.connectionId.slice(0, 8),
            model: limitedModel,
            cooldownMs: lockResult.cooldownMs,
            failureCount: lockResult.failureCount,
          })
        );

        dailyQuotaExhausted = true;
      }

      // 7. Mark account as quota-exhausted on 429 response (non-daily-quota errors)
      // For providers that route quota/cooldown at model scope, a 429 on one model
      // does not mean the whole connection is exhausted.
      // Daily quota errors are handled above; only process regular rate_limit here
      if (!dailyQuotaExhausted) {
        const passthroughModels = credentials.providerSpecificData?.passthroughModels;
        if (
          result.status === 429 &&
          shouldMarkAccountExhaustedFrom429(provider, model, passthroughModels)
        ) {
          markAccountExhaustedFrom429(credentials.connectionId, provider);
        }
      }

      // 8. Fallback to next account
<<<<<<< Updated upstream
      // A3 guard: if 401 and connection has extra keys, skip connection-level disable
      // (key-level failure already recorded in chatCore.ts via T07)
      // Check extra keys directly from credentials for reliability across restarts
      const hasExtraKeys =
        ((credentials.providerSpecificData?.extraApiKeys as string[] | undefined) ?? []).length >
          0 || connectionHasExtraKeys(credentials.connectionId);
      const is401 = result.status === 401;
      // Our own timeout fired on a slow upstream; don't cool down a healthy account.
      const skipConnectionDisable =
        result.status === 499 ||
        result.errorCode === "client_disconnected" ||
        result.errorType === "client_disconnected" ||
        (is401 && hasExtraKeys) ||
        isSelfInflictedUpstreamTimeout(result.status, result.errorType, provider);

      const { shouldFallback, cooldownMs } = skipConnectionDisable
        ? { shouldFallback: false, cooldownMs: 0 }
        : await markAccountUnavailable(
            credentials.connectionId,
            result.status,
            result.error,
            provider,
            model,
            providerProfile,
            {
              persistUnavailableState: !(
                isCombo &&
                result.status === 429 &&
                (failureKind === "rate_limit" || failureKind === "transient")
              ),
              isCombo,
            }
          );
=======
      const { shouldFallback, cooldownMs } = await markAccountUnavailable(
        credentials.connectionId,
        result.status,
        result.error,
        provider,
        model,
        providerProfile
      );
>>>>>>> Stashed changes

      if (shouldFallback) {
        if (Number.isFinite(cooldownMs) && cooldownMs > 0) {
          lastCooldownMs = cooldownMs;
          requestRetryLastCooldownMs = cooldownMs;
        }
        log.warn("AUTH", `Account ${accountId}... unavailable (${result.status}), trying fallback`);
        excludedConnectionIds.add(credentials.connectionId);
        lastError = result.error;
        lastStatus = result.status;
        requestRetryLastError = result.error;
        requestRetryLastStatus = result.status;
        continue;
      }

      if (!forceLiveComboTest && PROVIDER_BREAKER_FAILURE_STATUSES.has(Number(result.status))) {
        breaker._onFailure();
      }

      return result.response;
    }
  }
}
