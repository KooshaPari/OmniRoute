import { getModelInfo } from "../services/model";
import { clearAccountError, markAccountUnavailable } from "../services/auth";
<<<<<<< Updated upstream
import { connectionHasExtraKeys } from "@omniroute/open-sse/services/apiKeyRotator.ts";
=======
>>>>>>> Stashed changes
import * as log from "../utils/logger";
import { updateProviderCredentials } from "../services/tokenRefresh";
import {
  detectFormatFromEndpoint,
  getTargetFormat,
} from "@omniroute/open-sse/services/provider.ts";
import {
  getModelTargetFormat,
  PROVIDER_ID_TO_ALIAS,
} from "@omniroute/open-sse/config/providerModels.ts";
import { handleChatCore } from "@omniroute/open-sse/handlers/chatCore.ts";
import {
  errorResponse,
  modelCooldownResponse,
  providerCircuitOpenResponse,
  unavailableResponse,
} from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import {
  runWithProxyContext,
  runWithAppliedProxyCapture,
  runWithTlsTracking,
  isTlsFingerprintActive,
  type AppliedProxySink,
} from "@omniroute/open-sse/utils/proxyFetch.ts";
import { resolveProxyForConnection } from "@/lib/localDb";
import { CircuitBreakerOpenError, getCircuitBreaker } from "../../shared/utils/circuitBreaker";
import { logProxyEvent } from "../../lib/proxyLogger";
import { logTranslationEvent } from "../../lib/translatorEvents";
import { getRuntimeProviderProfile } from "@omniroute/open-sse/services/accountFallback.ts";
import { resolveAutoModelOrError } from "./resolveAutoModelOrError";

export async function resolveModelOrError(modelStr: string, body: any, endpointPath: string = "") {
  const modelInfo = await getModelInfo(modelStr);
<<<<<<< Updated upstream
  const sourceFormat = detectFormatFromEndpoint(body, endpointPath);

  if (
    modelInfo.provider === "openai" &&
    typeof modelInfo.model === "string" &&
    CODEX_NATIVE_RESPONSES_MODELS.has(modelInfo.model) &&
    sourceFormat === "openai-responses" &&
    isCodexNativeResponsesRequest(body, endpointPath, requestHeaders)
  ) {
    log.info("ROUTING", `${modelStr} → codex/${modelInfo.model} (Codex native responses)`);
    modelInfo.provider = "codex";
  }

  if (
    modelInfo.provider === "openai" &&
    modelInfo.model === "gpt-5.5" &&
    sourceFormat === "openai-responses" &&
    !isCodexNativeResponsesRequest(body, endpointPath, requestHeaders) &&
    (await hasOnlyActiveCodexAccount())
  ) {
    // #2877: keep the bare model id (do NOT bake a `-medium` suffix). The Codex
    // executor reads a model-name suffix as an explicit `modelEffort` that (per
    // #2331) overrides the client's `reasoning.effort`, so injecting `-medium`
    // here silently demoted a genuine `reasoning.effort=xhigh`. The default
    // effort still comes from the connection fallback when the client sends none.
    log.info("ROUTING", `${modelStr} → codex/gpt-5.5 (Codex-only active account)`);
    modelInfo.provider = "codex";
    modelInfo.model = "gpt-5.5";
  }

  // Forced-rewrite: codex provider doesn't serve DeepSeek/Qwen/Kimi/etc. Reroute
  // these to their canonical native provider so the request lands on the right
  // upstream API key instead of failing with a 400 on the OAuth account.
  // Ambiguous candidates (e.g. deepseek-v4-pro lives on both ds + opencode-go)
  // resolve to the model-family's native provider via NON_OAUTH_PROVIDER_BY_FAMILY.
  if (
    modelInfo.provider === "codex" &&
    typeof modelInfo.model === "string" &&
    NON_OAUTH_MODEL_PREFIX.test(modelInfo.model)
  ) {
    log.info(
      "ROUTING",
      `codex/${modelInfo.model} → re-resolving via native provider (codex OAuth does not serve this model)`
    );
    const rerouted = await getModelInfo(modelInfo.model);
    if (rerouted.provider && rerouted.provider !== "codex") {
      log.info("ROUTING", `codex/${modelInfo.model} → ${rerouted.provider}/${rerouted.model}`);
      Object.assign(modelInfo, rerouted);
    } else if ((rerouted as any).errorType === "ambiguous_model") {
      const candidates: string[] = (rerouted as any).candidateProviders || [];
      const family = modelInfo.model.match(NON_OAUTH_MODEL_PREFIX)?.[1]?.toLowerCase();
      const pick = family && PREFERRED_BY_FAMILY[family];
      if (pick && candidates.includes(pick)) {
        log.info(
          "ROUTING",
          `codex/${modelInfo.model} → ${pick}/${modelInfo.model} (ambiguity resolved by family)`
        );
        modelInfo.provider = pick;
        modelInfo.model = (rerouted as any).model;
      }
    }
  }

  const autoResolved = await resolveAutoModelOrError(modelStr, modelInfo);
  if (autoResolved) return autoResolved;

=======
>>>>>>> Stashed changes
  if (!modelInfo.provider) {
    if ((modelInfo as any).errorType === "ambiguous_model") {
      const message =
        (modelInfo as any).errorMessage ||
        `Ambiguous model '${modelStr}'. Use provider/model prefix (ex: gh/${modelStr} or cc/${modelStr}).`;
      log.warn("CHAT", message, {
        model: modelStr,
        candidates:
          (modelInfo as any).candidateAliases || (modelInfo as any).candidateProviders || [],
      });
      return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, message) };
    }
    log.warn("CHAT", "Invalid model format", { model: modelStr });
    return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid model format") };
  }

  const { provider, model, extendedContext } = modelInfo;
  const sourceFormat = detectFormatFromEndpoint(body, endpointPath);
  const providerAlias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  let targetFormat = getModelTargetFormat(providerAlias, model) || getTargetFormat(provider);
  if ((modelInfo as any).apiFormat === "responses") {
    targetFormat = "openai-responses";
    log.info("ROUTING", `Custom model apiFormat=responses → targetFormat=openai-responses`);
  }

  const ctxTag = extendedContext && providerAlias === "claude" ? " [1m]" : "";
  if (modelStr !== `${provider}/${model}`) {
    log.info("ROUTING", `${modelStr} → ${provider}/${model}${ctxTag}`);
  } else {
    log.info("ROUTING", `Provider: ${provider}, Model: ${model}${ctxTag}`);
  }

  return { provider, model, sourceFormat, targetFormat, extendedContext };
}

export async function checkPipelineGates(
  provider: string,
  model: string,
  options: {
    ignoreCircuitBreaker?: boolean;
    ignoreModelCooldown?: boolean;
    bypassReason?: string;
    providerProfile?: {
      circuitBreakerThreshold?: number;
      circuitBreakerReset?: number;
      failureThreshold?: number;
      resetTimeoutMs?: number;
    } | null;
  } = {}
) {
  const bypassReason = options.bypassReason || "pipeline override";
  const providerProfile = options.providerProfile ?? (await getRuntimeProviderProfile(provider));
  const breaker = getCircuitBreaker(provider, {
    failureThreshold: providerProfile.failureThreshold ?? providerProfile.circuitBreakerThreshold,
    resetTimeout: providerProfile.resetTimeoutMs ?? providerProfile.circuitBreakerReset,
    onStateChange: (name: string, from: string, to: string) =>
      log.info("CIRCUIT", `${name}: ${from} → ${to}`),
  });
  if (options.ignoreCircuitBreaker && !breaker.canExecute()) {
    log.info("CIRCUIT", `Bypassing OPEN circuit breaker for ${provider} (${bypassReason})`);
  } else if (!breaker.canExecute()) {
    const retryAfterMs = breaker.getRetryAfterMs();
    const retryAfterSec = Math.max(Math.ceil(retryAfterMs / 1000), 1);
    log.warn("CIRCUIT", `Circuit breaker OPEN for ${provider}, rejecting request`);
    return providerCircuitOpenResponse(provider, retryAfterSec);
  }

  return null;
}

export async function executeChatWithBreaker({
  bypassCircuitBreaker,
  breaker,
  body,
  provider,
  model,
  refreshedCredentials,
  proxyInfo,
  appliedProxySink,
  log: handlerLog,
  clientRawRequest,
  credentials,
  apiKeyInfo,
  userAgent,
  comboName,
  comboStrategy,
  isCombo,
  comboStepId,
  comboExecutionKey,
  extendedContext,
  providerProfile,
<<<<<<< Updated upstream
  cachedSettings,
  skipUpstreamRetry = false,
  trafficType = "production",
  correlationId = null,
}: ExecuteChatWithBreakerOptions): Promise<{ result: any; tlsFingerprintUsed: boolean }> {
=======
}: any): Promise<{ result: any; tlsFingerprintUsed: boolean }> {
>>>>>>> Stashed changes
  let tlsFingerprintUsed = false;

  // #5217: capture the proxy actually applied during execution so the caller can
  // merge it into proxyInfo before the egress log (executors pinning a per-account
  // proxy internally otherwise leave the egress log reading "direct").
  const capture = <T>(fn: () => T): T =>
    appliedProxySink ? runWithAppliedProxyCapture(appliedProxySink, fn) : fn();

  try {
    const chatFn = () =>
      capture(() =>
      runWithProxyContext(proxyInfo?.proxy || null, () =>
        (handleChatCore as any)({
          body: { ...body, model: `${provider}/${model}` },
          modelInfo: { provider, model, extendedContext },
          credentials: refreshedCredentials,
          log: handlerLog,
          clientRawRequest,
          connectionId: credentials.connectionId,
          apiKeyInfo,
          userAgent,
          comboName,
          comboStrategy,
          isCombo,
          comboStepId,
          comboExecutionKey,
<<<<<<< Updated upstream
          cachedSettings,
          skipUpstreamRetry,
          trafficType: normalizedTrafficType,
          correlationId,
=======
>>>>>>> Stashed changes
          onCredentialsRefreshed: async (newCreds: any) => {
            await updateProviderCredentials(credentials.connectionId, {
              accessToken: newCreds.accessToken,
              refreshToken: newCreds.refreshToken,
              expiresIn: newCreds.expiresIn,
              expiresAt: newCreds.expiresAt,
              providerSpecificData: newCreds.providerSpecificData,
              // Cookie/session providers (chatgpt-web) rotate the stored
              // apiKey blob mid-request — forward it so the DB credential
              // doesn't go stale after Set-Cookie rotation.
              apiKey: newCreds.apiKey,
              testStatus: "active",
            });
          },
          onRequestSuccess: async () => {
            await clearAccountError(credentials.connectionId, credentials);
          },
          onStreamFailure: async (failure: any) => {
            if (!credentials.connectionId) return;
<<<<<<< Updated upstream
            if (
              Number(failure?.status) === 499 ||
              failure?.code === "client_disconnected" ||
              failure?.type === "client_disconnected"
            ) {
              return;
            }
            // A3 guard: if 401 and connection has extra keys, skip connection-level disable
            // (key-level failure already recorded in chatCore.ts via T07)
            // Check extra keys directly from credentials for reliability across restarts
            const extraKeys =
              (credentials.providerSpecificData?.extraApiKeys as string[] | undefined) ?? [];
            const hasExtraKeys =
              extraKeys.length > 0 || connectionHasExtraKeys(credentials.connectionId);
            const is401 = Number(failure?.status) === 401;
            if (is401 && hasExtraKeys) {
              log.debug(
                "AUTH",
                `A3 guard: skipping markAccountUnavailable for 401 with extra keys on ${credentials.connectionId.slice(0, 8)}`
              );
              return;
            }
=======
>>>>>>> Stashed changes
            await markAccountUnavailable(
              credentials.connectionId,
              Number(failure?.status || HTTP_STATUS.BAD_GATEWAY),
              String(failure?.message || failure?.code || "stream failure"),
              provider,
              model,
              providerProfile
            );
          },
        })
      )
      );

    if (bypassCircuitBreaker) {
      if (!proxyInfo?.proxy && isTlsFingerprintActive()) {
        const tracked = await runWithTlsTracking(chatFn);
        return { result: tracked.result, tlsFingerprintUsed: tracked.tlsFingerprintUsed };
      }

      const result = await chatFn();
      return { result, tlsFingerprintUsed: false };
    }

    if (!proxyInfo?.proxy && isTlsFingerprintActive()) {
      const tracked = await breaker.execute(async () => runWithTlsTracking(chatFn));
      return { result: tracked.result, tlsFingerprintUsed: tracked.tlsFingerprintUsed };
    }

    const result = await breaker.execute(chatFn);
    return { result, tlsFingerprintUsed: false };
  } catch (cbErr: any) {
    if (cbErr instanceof CircuitBreakerOpenError) {
      log.warn("CIRCUIT", `${provider} circuit open during retry: ${cbErr.message}`);
      return {
        result: {
          success: false,
          response: providerCircuitOpenResponse(provider, Math.ceil(cbErr.retryAfterMs / 1000)),
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        },
        tlsFingerprintUsed: false,
      };
    }

    if (cbErr?.code === "PROXY_UNREACHABLE" || /proxy unreachable/i.test(cbErr?.message || "")) {
      const detail = cbErr?.message || "Proxy unreachable";
      log.warn("PROXY", detail);
      return {
        result: {
          success: false,
          response: unavailableResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, detail, 2),
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
          error: detail,
        },
        tlsFingerprintUsed: false,
      };
    }

    throw cbErr;
  }
}

export function handleNoCredentials(
  credentials: any,
  excludeConnectionId: string | null,
  provider: string,
  model: string,
  lastError: string | null,
  lastStatus: number | null
) {
  if (credentials?.allRateLimited) {
    const errorMsg = lastError || credentials.lastError || "Unavailable";
    const status =
      lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
    const cooldownModel =
      typeof credentials.cooldownModel === "string" && credentials.cooldownModel.trim().length > 0
        ? credentials.cooldownModel.trim()
        : model;

    if (credentials.cooldownScope === "model" && Number(status) === HTTP_STATUS.RATE_LIMITED) {
      log.warn(
        "CHAT",
        `[${provider}/${cooldownModel}] all credentials cooling down${
          credentials.retryAfterHuman ? ` (${credentials.retryAfterHuman})` : ""
        }`
      );
      return modelCooldownResponse({
        model: cooldownModel,
        retryAfter: credentials.retryAfter,
      });
    }

    log.warn("CHAT", `[${provider}/${model}] ${errorMsg} (${credentials.retryAfterHuman})`);
    return unavailableResponse(
      status,
      `[${provider}/${model}] ${errorMsg}`,
      credentials.retryAfter,
      credentials.retryAfterHuman
    );
  }
  if (lastError && lastStatus) {
    log.warn("CHAT", "Preserving last upstream error after credential exhaustion", {
      provider,
      model,
      lastStatus,
    });
    return errorResponse(lastStatus, lastError);
  }
  if (!excludeConnectionId) {
<<<<<<< Updated upstream
    // Ported from upstream decolua/9router#336 (Ibrahim Ryan): surface as 404
    // NOT_FOUND instead of 400 BAD_REQUEST so combo routing can fall through to
    // the next target. The combo target loop (open-sse/services/combo.ts) treats
    // 400 as a hard stop to break body-specific infinite fallback loops
    // (PR #4316 / issue #4279). 404 flows through checkFallbackError as
    // `shouldFallback: true` (generic-error catch-all path in
    // open-sse/services/accountFallback.ts), letting a combo like
    // `antigravity/opus → github/opus` skip a provider whose credentials are
    // all disabled. log level is `warn` rather than `error` because zero active
    // credentials is an expected operator-driven state, not a server fault.
    log.warn("AUTH", `No active credentials for provider: ${provider}`);
    return errorResponse(HTTP_STATUS.NOT_FOUND, `No active credentials for provider: ${provider}`);
=======
    log.error("AUTH", `No credentials for provider: ${provider}`);
    return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
>>>>>>> Stashed changes
  }
  log.warn("CHAT", "No more accounts available", { provider });
  return errorResponse(
    lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE,
    lastError || "All accounts unavailable"
  );
}

export async function safeResolveProxy(connectionId: string) {
  try {
    return await resolveProxyForConnection(connectionId);
  } catch (proxyErr: any) {
    log.debug("PROXY", `Failed to resolve proxy: ${proxyErr.message}`);
    return null;
  }
}

<<<<<<< Updated upstream
export async function safeResolveProxy(connectionId: string, apiKeyId?: string) {
  try {
    return await resolveProxyForConnection(connectionId, apiKeyId);
  } catch (proxyErr) {
    return decideProxyResolutionFailure(proxyErr);
  }
}

/**
 * #5217: merge a proxy the executor applied internally (captured via
 * AppliedProxySink) into the pre-execution proxyInfo so the egress logger reflects
 * the real egress. No applied proxy → proxyInfo unchanged. A pre-existing
 * non-direct level is preserved; otherwise reported as "account" (per-account
 * proxy, e.g. OpenCode rotation). Pure + unit-testable.
 */
export function applyExecutorProxyToInfo(
  proxyInfo: { proxy?: unknown; level?: string; levelId?: string | null } | null | undefined,
  appliedProxy: unknown
) {
  if (!appliedProxy) return proxyInfo;
  const priorLevel = proxyInfo?.level;
  return {
    ...(proxyInfo || {}),
    proxy: appliedProxy,
    level: priorLevel && priorLevel !== "direct" ? priorLevel : "account",
  };
}

// Async because the egress-IP lookup lazy-imports proxyEgress; callers treat
// this as fire-and-forget logging (the internal try/catch swallows everything).
export async function safeLogEvents({
=======
export function safeLogEvents({
>>>>>>> Stashed changes
  result,
  proxyInfo,
  proxyLatency,
  provider,
  model,
  sourceFormat,
  targetFormat,
  credentials,
  comboName,
  clientRawRequest,
  tlsFingerprintUsed = false,
}) {
  try {
    const rawIp =
      clientRawRequest?.headers?.["x-forwarded-for"] ||
      clientRawRequest?.headers?.["x-real-ip"] ||
      clientRawRequest?.headers?.["cf-connecting-ip"] ||
      null;
    const publicIp = rawIp ? rawIp.split(",")[0].trim() : null;

    logProxyEvent({
      status: result.success
        ? "success"
        : result.status === 408 || result.status === 504
          ? "timeout"
          : "error",
      proxy: proxyInfo?.proxy || null,
      level: proxyInfo?.level || "direct",
      levelId: proxyInfo?.levelId || null,
      provider,
      targetUrl: `${provider}/${model}`,
      publicIp,
      latencyMs: proxyLatency,
      error: result.success ? null : result.error || null,
      connectionId: credentials.connectionId,
      comboId: comboName || null,
      account: credentials.connectionId?.slice(0, 8) || null,
      tlsFingerprint: tlsFingerprintUsed,
    });
  } catch {}

  try {
    logTranslationEvent({
      provider,
      model,
      sourceFormat,
      targetFormat,
      status: result.success ? "success" : "error",
      statusCode: result.success ? 200 : result.status || 500,
      latency: proxyLatency,
      endpoint: clientRawRequest?.endpoint || "/v1/chat/completions",
      connectionId: credentials.connectionId || null,
      comboName: comboName || null,
    });
  } catch {}
}

export function withSessionHeader(response: Response, sessionId: string | null): Response {
  if (!response || !sessionId) return response;

  try {
    response.headers.set("X-OmniRoute-Session-Id", sessionId);
    return response;
  } catch {
    const cloned = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    cloned.headers.set("X-OmniRoute-Session-Id", sessionId);
    return cloned;
  }
}
<<<<<<< Updated upstream

export function withCorrelationId(response: Response, correlationId: string | null): Response {
  if (!response || !correlationId) return response;

  try {
    response.headers.set("X-Correlation-Id", correlationId);
    return response;
  } catch {
    const cloned = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    cloned.headers.set("X-Correlation-Id", correlationId);
    return cloned;
  }
}

export function withSelectedConnectionHeader(
  response: Response,
  connectionId: string | null | undefined
): Response {
  if (!response || !connectionId) return response;

  try {
    response.headers.set("X-OmniRoute-Selected-Connection-Id", connectionId);
    return response;
  } catch {
    const cloned = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    cloned.headers.set("X-OmniRoute-Selected-Connection-Id", connectionId);
    return cloned;
  }
}
=======
>>>>>>> Stashed changes
