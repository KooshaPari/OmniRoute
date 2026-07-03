/**
 * chatCore upstream-proxy executor resolver (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Extracted from handleChatCore: resolves the executor for a provider honoring the configured
 * upstream proxy mode and Bifrost Tier-1 routing.
 *
 * Resolution order (first match wins):
 *   1. Bifrost Tier-1 router — if `shouldRouteViaBifrost(prov)` is true (env var or per-connection
 *      bifrostMode flag), returns a `createBifrostBackedExecutor` wrapper with automatic fallback
 *      to the legacy path on kill-switch activation. When `BIFROST_SHADOW_ENABLED=true` is set,
 *      returns a `createShadowBackedExecutor` wrapper that runs legacy + bifrost in parallel (B6.x
 *      phased ramp) and returns the path chosen by the active ramp phase.
 *   2. `native` / disabled — the provider's own executor (same as `getExecutor(prov)`).
 *   3. `cliproxyapi` — the CLIProxyAPI passthrough executor with model-name mapping.
 *   4. `fallback` — a wrapper that tries the native executor first and retries via CLIProxyAPI on
 *      configured failure codes (default 5xx + 429 + network) or on a thrown error.
 *
 * Behaviour after resolution is byte-identical to the previous inline closure (it only captured `log`).
 */

import { getExecutor } from "../../executors/index.ts";
import { getCachedSettings } from "@/lib/db/readCache";
import { getUpstreamProxyConfigCached } from "./comboContextCache.ts";
import { shouldRouteViaBifrost } from "../../executors/bifrost.ts";

type LoggerLike =
  | {
      info?: (...args: unknown[]) => void;
      error?: (...args: unknown[]) => void;
      warn?: (...args: unknown[]) => void;
    }
  | null
  | undefined;

type ExecuteInput = {
  model: string;
  body: unknown;
  stream: boolean;
  credentials: unknown;
  signal?: AbortSignal | null;
  log?: unknown;
  upstreamExtraHeaders?: Record<string, string> | null;
};

const CLIPROXYAPI_SENTINEL_PROVIDER_ID = "cliproxyapi";

async function resolveCliproxyapiModel(
  providerId: string,
  model: string,
  providerMapping: Record<string, string> | null | undefined
): Promise<string> {
  const mapped = providerMapping?.[model];
  if (mapped) return mapped;

  if (providerId === CLIPROXYAPI_SENTINEL_PROVIDER_ID) return model;

  const sentinelCfg = await getUpstreamProxyConfigCached(CLIPROXYAPI_SENTINEL_PROVIDER_ID);
  return sentinelCfg.cliproxyapiModelMapping?.[model] || model;
}

async function mapCliproxyapiInput(
  providerId: string,
  input: ExecuteInput,
  providerMapping: Record<string, string> | null | undefined
): Promise<ExecuteInput> {
  const mappedModel = await resolveCliproxyapiModel(providerId, input.model, providerMapping);
  if (mappedModel === input.model) return input;

  const mappedBody =
    input.body && typeof input.body === "object"
      ? { ...(input.body as Record<string, unknown>), model: mappedModel }
      : input.body;

  return {
    ...input,
    model: mappedModel,
    body: mappedBody,
  };
}

async function executeCliproxyapiMapped(
  proxyExec: { execute: (input: ExecuteInput) => Promise<unknown> },
  providerId: string,
  input: ExecuteInput,
  providerMapping: Record<string, string> | null | undefined
) {
  return proxyExec.execute(await mapCliproxyapiInput(providerId, input, providerMapping));
}

export async function resolveExecutorWithProxy(
  prov: string,
  log?: LoggerLike,
  providerSpecificData?: Record<string, unknown> | null,
) {
  // ── Bifrost routing check (Phase 1) ───────────────────────────
  // Check BEFORE the upstream proxy path because bifrost is a standalone
  // Tier-1 router option, not part of the upstream proxy system.
  // Activation: BIFROST_ENABLED=1 env var or per-connection bifrostMode flag.
  //
  // B6.x: when BIFROST_SHADOW_ENABLED=true, use shadow dispatch (legacy + bifrost
  // in parallel, serves path determined by active ramp phase).
  if (shouldRouteViaBifrost(prov, { providerSpecificData })) {
    const shadowRaw = process.env.BIFROST_SHADOW_ENABLED;
    if (shadowRaw === "true" || shadowRaw === "1") {
      log?.info?.("UPSTREAM_PROXY", `${prov} routed through Bifrost shadow (B6.x phased ramp)`);
      return createShadowBackedExecutor(prov, log);
    }
    log?.info?.("UPSTREAM_PROXY", `${prov} routed through Bifrost (Tier-1 router)`);
    const { createBifrostBackedExecutor } = await import("../../executors/bifrost.ts");
    return createBifrostBackedExecutor(prov, log);
  }

  const cfg = await getUpstreamProxyConfigCached(prov);
  if (!cfg.enabled || cfg.mode === "native") return getExecutor(prov);

  if (cfg.mode === "cliproxyapi") {
    log?.info?.("UPSTREAM_PROXY", `${prov} routed through CLIProxyAPI (passthrough)`);
    const proxyExec = getExecutor("cliproxyapi");
    const wrapper = Object.create(proxyExec);
    wrapper.execute = (input: ExecuteInput) =>
      executeCliproxyapiMapped(proxyExec, prov, input, cfg.cliproxyapiModelMapping);
    return wrapper;
  }

  // mode === "fallback": try native first, retry via CLIProxyAPI on specific failures
  const nativeExec = getExecutor(prov);
  const proxyExec = getExecutor("cliproxyapi");

  // Read custom fallback codes from settings. Default: 5xx + 429 + network errors.
  let fallbackCodes: number[] = [429, 500, 502, 503, 504];
  try {
    const allSettings = await getCachedSettings();
    if (
      typeof allSettings.cliproxyapi_fallback_codes === "string" &&
      allSettings.cliproxyapi_fallback_codes.trim()
    ) {
      const parsed = allSettings.cliproxyapi_fallback_codes
        .split(",")
        .map((s: string) => Number.parseInt(s.trim(), 10))
        .filter((n: number) => !Number.isNaN(n));
      if (parsed.length > 0) fallbackCodes = parsed;
    }
  } catch {
    /* use defaults */
  }
  const isRetryableStatus = (s: number) => fallbackCodes.includes(s) || s === 0;

  const wrapper = Object.create(nativeExec);
  wrapper.execute = async (input: ExecuteInput) => {
    let result;
    try {
      result = await nativeExec.execute(input);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log?.info?.("UPSTREAM_PROXY", `${prov} native error (${errMsg}), retrying via CLIProxyAPI`);
      try {
        return await executeCliproxyapiMapped(proxyExec, prov, input, cfg.cliproxyapiModelMapping);
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
      return await executeCliproxyapiMapped(proxyExec, prov, input, cfg.cliproxyapiModelMapping);
    } catch (proxyErr) {
      const proxyMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
      log?.error?.("UPSTREAM_PROXY", `${prov} CLIProxyAPI fallback also failed: ${proxyMsg}`);
      throw proxyErr;
    }
  };
  return wrapper;
}

/**
 * Create a shadow-backed executor for the B6.x phased ramp.
 *
 * Returns an executor-like object that runs the legacy `chatCore` executor and
 * the `BifrostBackendExecutor` in parallel (via `dispatchWithShadow` from
 * trafficShadow.ts), comparing outcomes and serving the path chosen by the
 * active ramp phase.
 *
 * Activation: requires BIFROST_SHADOW_ENABLED=true in ADDITION to the bifrost
 * routing path being active (i.e. both env vars must be set).
 */
async function createShadowBackedExecutor(
  prov: string,
  log?: LoggerLike,
): Promise<{
  execute: (input: ExecuteInput) => Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }>;
  getProvider: () => string;
}> {
  // Create the legacy executor: always available, no env guard needed.
  const legacyExecutor = getExecutor(prov);

  // Create the bifrost executor (lazy import to avoid circular deps).
  const { BifrostBackendExecutor } = await import("../../executors/bifrost.ts");
  const bifrostExecutor = new BifrostBackendExecutor(prov, {} as any);

  log?.info?.("BIFROST_SHADOW", `${prov} shadow executor created (B6.x phased ramp)`);

  return {
    getProvider: () => prov,

    execute: async (input) => {
      // Lazy-import dispatchWithShadow only when execute() is called.
      const { dispatchWithShadow } = await import("../../services/trafficShadow.ts");
      const result = await dispatchWithShadow(input, {
        legacyExecutor,
        bifrostExecutor,
        provider: prov,
        model: input.model,
      });
      return {
        response: result.servedResponse,
        url: result.servedUrl,
        headers: {},
        transformedBody: input.body,
      };
    },
  };
}
