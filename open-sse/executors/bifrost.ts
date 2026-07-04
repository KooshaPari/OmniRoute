/**
 * BifrostBackend Executor — Tier-1 router bridge to maximhq/bifrost (Go).
 *
 * Routes OmniRoute requests through a local Bifrost AI gateway process,
 * which handles provider dispatch, format translation, fallback, load
 * balancing, virtual keys, budget management, semantic cache, MCP client,
 * and observability.
 *
 * Wire format: OpenAI-compatible. Bifrost exposes /v1/chat/completions,
 * /v1/responses, /v1/embeddings, etc., and accepts the same JSON shape
 * that the rest of OmniRoute uses. This means chatCore's SSE parsing,
 * tokenizer, and response post-processing work unchanged.
 *
 * Activation:
 *   1. Per-provider upstream_proxy_config with type="bifrost" (preferred
 *      for clean drop-in swap), OR
 *   2. Per-connection bifrostMode toggle in providerSpecificData (UI).
 *
 * Default (Phase 1, this turn): backwards-compat. If BIFROST_ENABLED env
 * var is unset or "false", the executor throws at execute() time and the
 * caller falls back to the legacy chatCore path. This lets us ship the
 * executor without changing routing behavior, and flip individual
 * providers to Bifrost-backed mode by env var or provider config.
 *
 * Reference: ADR-031 (Tier-1 router decision), docs/adr/0031-bifrost-tier1-router.md,
 * PLAN.md § 2.5 (v8.1 Bifrost track).
 *
 * @module open-sse/executors/bifrost
 */

import {
  BaseExecutor,
  mergeUpstreamExtraHeaders,
  mergeAbortSignals,
  type ExecuteInput,
} from "./base.ts";
import { HTTP_STATUS, FETCH_TIMEOUT_MS } from "../config/constants.ts";
import {
  applyBifrostModelOverride,
  isBifrostSupported,
  resolveBifrostProviderId,
} from "./bifrostProviderMap.ts";
import {
  listBifrostModelsForProvider,
  refreshBifrostModels,
  type BifrostFetcher,
} from "../../src/lib/db/bifrostModels.ts";
import {
  isActive as isKillSwitchActive,
  recordObservation as recordKillSwitchObservation,
} from "../services/bifrostKillSwitch.ts";
import { getExecutor } from "./index.ts";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const BIFROST_TAG = "BIFROST";

/**
 * Resolve the Bifrost base URL. Reads from env, falls back to the
 * default localhost:8080 (which is Bifrost's documented default).
 */
async function resolveBifrostBaseUrl(): Promise<string> {
  const envUrl = process.env.BIFROST_BASE_URL;
  if (envUrl && typeof envUrl === "string") return envUrl.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

/**
 * Whether Bifrost integration is enabled. Disabled by default in Phase 1;
 * flip via env var to opt a deployment into Bifrost-backed routing.
 */
function isBifrostEnabled(): boolean {
  const flag = process.env.BIFROST_ENABLED;
  if (!flag) return false;
  return flag === "true" || flag === "1";
}

/**
 * BifrostBackend — Tier-1 router executor.
 *
 * Extends BaseExecutor but overrides `execute()` entirely. Does NOT use
 * BaseExecutor's session pool / API key rotator / token refresh, because
 * Bifrost manages all of that internally. The executor's only job is to
 * forward the request to the local Bifrost process.
 */
export class BifrostBackendExecutor extends BaseExecutor {
  constructor(provider: string, config: ConstructorParameters<typeof BaseExecutor>[1]) {
    super(provider, config);
  }

  /**
   * Execute — forward the request to Bifrost's OpenAI-compatible endpoint.
   *
   * Behavior:
   *  - If Bifrost is not enabled (env var off), throws so the caller can
   *    fall back to the legacy chatCore path.
   *  - If the OmniRoute provider is not in the Bifrost provider map (e.g.
   *    web-cookie providers), throws — the legacy executor should handle it.
   *  - Otherwise, resolves the Bifrost provider ID + model override, and
   *    POSTs to `${baseUrl}/v1/chat/completions` with the rewritten body.
   *  - Returns the standard `{ response, url, headers, transformedBody }`
   *    shape so chatCore's SSE parsing + response post-processing work
   *    unchanged.
   */
  async execute(input: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    if (!isBifrostEnabled()) {
      throw new Error(
        `[${BIFROST_TAG}] Bifrost is not enabled. Set BIFROST_ENABLED=1 and BIFROST_BASE_URL to use the Tier-1 router. ` +
          `Provider "${this.provider}" stays on the legacy chatCore path.`
      );
    }

    if (!isBifrostSupported(this.provider)) {
      throw new Error(
        `[${BIFROST_TAG}] Provider "${this.provider}" is not in the Bifrost provider map. ` +
          `Stay on the legacy executor (open-sse/handlers/chatCore.ts).`
      );
    }

    // B9 wiring: kill switch pre-check. If the kill switch is active for
    // this provider (degradation detected by prior observations), throw
    // so the dispatcher falls back to the legacy chatCore path.
    // Recorded under the BIFROST_TAG for log correlation.
    if (isKillSwitchActive(this.provider)) {
      input.log?.warn?.(
        BIFROST_TAG,
        `Bifrost kill switch active for "${this.provider}" — falling back to legacy chatCore`
      );
      throw new Error(
        `[${BIFROST_TAG}] Kill switch active for provider "${this.provider}". ` +
          `Falling back to legacy chatCore until kill switch clears.`
      );
    }

    const bifrostProviderId = resolveBifrostProviderId(this.provider);
    if (!bifrostProviderId) {
      // Defensive — isBifrostSupported already covered this branch, but
      // keep the explicit guard for type narrowing.
      throw new Error(`[${BIFROST_TAG}] resolveBifrostProviderId returned null for "${this.provider}".`);
    }

    const baseUrl = await resolveBifrostBaseUrl();
    const model = applyBifrostModelOverride(this.provider, input.model);
    const url = `${baseUrl}/v1/chat/completions`;

    // Transform body: rewrite the `model` field if the override function
    // changed it (e.g. Azure deployment-name → model-id normalization).
    // We do NOT rewrite the provider field because Bifrost inspects the
    // model's vendor prefix (gpt-*, claude-*, gemini-*) to pick the
    // provider — provider-id is informational only.
    const body =
      input.body && typeof input.body === "object"
        ? { ...(input.body as Record<string, unknown>), model }
        : { model };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Bifrost-Provider": bifrostProviderId,
      // Echo the original OmniRoute provider ID so Bifrost's audit log
      // and dashboards can show the originating OmniRoute context.
      "X-OmniRoute-Provider": this.provider,
    };

    // Forward the API key (if present) as the Bifrost virtual-key bearer.
    // Bifrost's auth layer will validate against its own key store and
    // bill against the upstream provider key configured there.
    if (input.credentials?.apiKey) {
      headers["Authorization"] = `Bearer ${input.credentials.apiKey}`;
    } else if (input.credentials?.accessToken) {
      // OAuth-style: forward as bearer if no API key.
      headers["Authorization"] = `Bearer ${input.credentials.accessToken}`;
    }

    // Merge in any upstreamExtraHeaders the caller supplied. These can
    // override our defaults above if explicitly set (e.g. a per-tenant
    // virtual key header). The helper mutates `headers` in place and
    // returns void.
    mergeUpstreamExtraHeaders(headers, input.upstreamExtraHeaders ?? null);

    // Merge abort signals: caller's signal OR fetch timeout, whichever
    // fires first.
    const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const combinedSignal = input.signal
      ? mergeAbortSignals(input.signal, timeoutSignal)
      : timeoutSignal;

    input.log?.info?.(
      BIFROST_TAG,
      `Bifrost → ${url} (omniProvider: ${this.provider}, bifrostProvider: ${bifrostProviderId}, model: ${model})`
    );

    const fetchStart = Date.now();
    let fetchResponse: Response | undefined;
    try {
      fetchResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    } finally {
      // B9 wiring: record observation regardless of success/failure so the
      // sliding-window stats stay accurate. ok is true iff we got a Response
      // (network errors throw before fetchResponse is assigned).
      const latencyMs = Date.now() - fetchStart;
      const ok = fetchResponse !== undefined;
      try {
        recordKillSwitchObservation({
          timestamp: Date.now(),
          provider: this.provider,
          latencyMs,
          ok,
        });
      } catch (ksErr) {
        // Never let kill-switch bookkeeping break the request path.
        input.log?.warn?.(
          BIFROST_TAG,
          `recordObservation failed: ${ksErr instanceof Error ? ksErr.message : String(ksErr)}`
        );
      }
    }

    const response = fetchResponse!;

    if (response.status === HTTP_STATUS.RATE_LIMITED) {
      input.log?.warn?.(BIFROST_TAG, `Bifrost rate limited: ${response.status}`);
    } else if (response.status >= 500) {
      input.log?.warn?.(BIFROST_TAG, `Bifrost upstream error: ${response.status}`);
    }

    return {
      response,
      url,
      headers,
      transformedBody: body,
    };
  }

  /**
   * Health check — probes Bifrost's /health endpoint. Bifrost exposes
   * this in its default deployment for orchestrator probes (k8s liveness,
   * load balancer, etc.).
   *
   * Fallback (older Bifrost versions without /health): use the local
   * `bifrost_models` cache via listBifrostModelsForProvider(); if the
   * cache is empty or stale, refresh it by hitting /v1/models once
   * (via refreshBifrostModels). This is the B4 wiring: sub-millisecond
   * lookup in the steady state, network roundtrip only on cache miss.
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string; version?: string }> {
    const start = Date.now();
    if (!isBifrostEnabled()) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: "Bifrost not enabled (BIFROST_ENABLED unset)",
      };
    }
    const baseUrl = await resolveBifrostBaseUrl();

    // 1. Probe /health first.
    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        let version: string | undefined;
        try {
          const payload = (await res.json()) as { version?: string };
          version = payload.version;
        } catch {
          // Non-JSON body is OK; just no version metadata.
        }
        return { ok: true, latencyMs, version };
      }
      // 404 means no /health; fall through to the cache-wired /v1/models
      // path. Other non-2xx codes are real errors and surface immediately.
      if (res.status !== HTTP_STATUS.NOT_FOUND) {
        return { ok: false, latencyMs, error: `HTTP ${res.status}` };
      }
    } catch {
      // /health probe failed (network/timeout); fall through to cache path.
    }

    // 2. /health missing or unreachable: try the cache, then /v1/models.
    try {
      const cached = listBifrostModelsForProvider(this.provider);
      if (cached.length > 0) {
        return {
          ok: true,
          latencyMs: Date.now() - start,
          version: cached.length.toString(),
        };
      }
      // Cache miss: hit Bifrost's /v1/models once and refresh.
      const fetcher: BifrostFetcher = async (url: string) => {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
        });
        if (!r.ok) {
          throw new Error(`Bifrost /v1/models HTTP ${r.status}`);
        }
        return (await r.json()) as { data?: unknown };
      };
      await refreshBifrostModels(this.provider, fetcher, {
        baseUrl,
        ttlSeconds: 60 * 60,
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ── Dispatcher fallback wrapper (B9 wiring closure) ────────────────

/**
 * Error class for the "Bifrost is configured but cannot serve this request
 * and no legacy fallback is available" case. Surfaces a clear 5xx so the
 * dispatcher can return a meaningful 503-ish response instead of a generic
 * `Internal Server Error`.
 */
export class BifrostNoFallbackError extends Error {
  constructor(
    public readonly provider: string,
    public readonly underlying: string,
  ) {
    super(
      `[${BIFROST_TAG}] No legacy fallback available for provider "${provider}". ` +
        `Underlying error: ${underlying}. ` +
        `Either disable Bifrost for this provider or add a specialized executor.`,
    );
    this.name = "BifrostNoFallbackError";
  }
}

/**
 * Detect whether an Error thrown by BifrostBackendExecutor indicates that
 * the kill switch tripped (auto-detected or manually force-activated) and
 * the dispatcher should fall back to the legacy executor. Returns the
 * matched provider string when matched, undefined otherwise.
 */
function matchKillSwitchFallback(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  // The kill-switch throw inside execute() uses this exact template:
  //   `[BIFROST] Kill switch active for provider "X". Falling back ...`
  const m = /Kill switch active for provider "([^"]+)"/.exec(err.message);
  return m?.[1];
}

/**
 * Dispatch a chat request through Bifrost, with automatic fallback to the
 * legacy executor (open-sse/executors/default.ts or a specialized one) when
 * the Bifrost kill switch is active for the resolved provider.
 *
 * This is the dispatcher-facing entry point that closes the B9 wiring
 * contract: the executor throws on kill-switch-trip, the dispatcher catches
 * it here and routes through the legacy executor instead of returning a
 * 500 to the user.
 *
 * Other errors (provider unsupported, network failure, 5xx upstream) are
 * propagated unchanged so callers can apply their own retry/backoff logic.
 *
 * @param executor  A BifrostBackendExecutor instance (already configured
 *                  for the target provider via provider config or env).
 * @param input     ExecuteInput shape from BaseExecutor.
 * @returns         Same shape as BifrostBackendExecutor.execute().
 */
export async function dispatchBifrostWithFallback(
  executor: BifrostBackendExecutor,
  input: ExecuteInput,
): ReturnType<BifrostBackendExecutor["execute"]> {
  try {
    return await executor.execute(input);
  } catch (err) {
    const fallbackProvider = matchKillSwitchFallback(err);
    if (fallbackProvider === undefined) {
      // Not a kill-switch error — propagate as-is so callers can apply
      // their own retry / backoff / 5xx mapping logic.
      throw err;
    }
    input.log?.warn?.(
      BIFROST_TAG,
      `Bifrost kill switch tripped for "${fallbackProvider}" — falling back to legacy executor ` +
        `(reason: ${err instanceof Error ? err.message : String(err)})`,
    );
    const legacy = getExecutor(fallbackProvider);
    // Avoid an infinite fallback loop: if getExecutor returned another
    // BifrostBackendExecutor (e.g. someone wired it as the default), bail
    // out with a distinct error so the dispatcher can return a clean 503.
    if (legacy instanceof BifrostBackendExecutor) {
      throw new BifrostNoFallbackError(
        fallbackProvider,
        err instanceof Error ? err.message : String(err),
      );
    }
    input.log?.info?.(
      BIFROST_TAG,
      `Legacy fallback → ${legacy.constructor.name} for provider "${fallbackProvider}"`,
    );
    return legacy.execute(input);
  }
}

export default BifrostBackendExecutor;

// ── Dispatcher-facing executor factory (L1a) ──────────────────────

/**
 * Whether Bifrost integration should route a given provider through the
 * BifrostBackendExecutor instead of the legacy `getExecutor()` path.
 *
 * Two activation paths (per docs/frameworks/BIFROST-BACKEND.md):
 *   1. Global env switch:  `BIFROST_ENABLED=1` routes ALL providers
 *      (with per-provider fallback to legacy on kill-switch / unsupported).
 *   2. Per-connection toggle: `providerSpecificData.bifrostMode === true`
 *      routes only that specific connection.
 *
 * L1a implements path (1) only; path (2) requires the upstreamProxy.ts
 * module that this fork is missing (fork drift — see DAG S6 P6d).
 */
export function shouldRouteViaBifrost(provider: string, opts?: {
  providerSpecificData?: { bifrostMode?: boolean | null } | null;
}): boolean {
  if (process.env.BIFROST_ENABLED === "1" || process.env.BIFROST_ENABLED === "true") {
    return true;
  }
  if (opts?.providerSpecificData?.bifrostMode === true) {
    return true;
  }
  void provider;
  return false;
}

/**
 * Build a dispatcher-shaped executor that forwards `.execute(input)` calls
 * to `dispatchBifrostWithFallback(new BifrostBackendExecutor(provider, {}), input)`.
 *
 * Returned object mimics the BaseExecutor surface (just `.execute` +
 * `.getProvider`) so it can be returned from `resolveExecutorWithProxy()`
 * in place of `getExecutor(provider)` without any downstream changes.
 *
 * The empty `{} as ProviderConfig` is safe because BifrostBackendExecutor
 * does not consult `this.config` for URL construction (it derives the URL
 * from the BIFROST_BASE_URL env var); see bifrost.ts:90-92.
 */
export function createBifrostBackedExecutor(
  provider: string,
  log?: {
    info?: (tag: string, msg: string) => void;
    warn?: (tag: string, msg: string) => void;
  },
): {
  execute: (input: ExecuteInput) => ReturnType<BifrostBackendExecutor["execute"]>;
  getProvider: () => string;
} {
  log?.info?.(
    BIFROST_TAG,
    `${provider} → BifrostBackendExecutor (Tier-1 router, fallback-wrapped)`,
  );
  const bifrost = new BifrostBackendExecutor(provider, {} as ConstructorParameters<typeof BaseExecutor>[1]);
  return {
    getProvider: () => bifrost.getProvider(),
    execute: (input) => dispatchBifrostWithFallback(bifrost, input),
  };
}
