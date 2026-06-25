/**
 * resolveExecutorWithProxy — extracted leaf from chatCore.ts.
 *
 * Wraps the provider executor with the optional CLIProxyAPI (cliproxyapi)
 * upstream proxy routing strategy. Three modes:
 *
 *   - mode="native" (default)  → returns the native executor unchanged
 *   - mode="cliproxyapi"        → returns the CLIProxyAPI executor instead
 *   - mode="fallback"           → returns a wrapper that tries the native
 *                                executor first and falls back to the
 *                                CLIProxyAPI executor on specific status
 *                                codes (5xx, 429, network errors by default;
 *                                configurable via the
 *                                `cliproxyapi_fallback_codes` setting).
 *
 * The fallback wrapper:
 *   - retries the proxy executor only on retryable status codes or on
 *     thrown errors (treated as network / parse failures);
 *   - re-throws the last error if the proxy executor also fails;
 *   - is fire-and-forget w.r.t. logging — never blocks the upstream
 *     call on slow / unreachable settings cache.
 *
 * This module is a pure leaf — it depends only on:
 *   - `getExecutor` from `../executors/index.ts`
 *   - `getUpstreamProxyConfigCached` from `./comboContextCache.ts`
 *   - `getCachedSettings` from `@/lib/db/readCache`
 *   - the `ExecutorLog` type from `../executors/base.ts`
 *
 * Keeping the leaf separate from `chatCore.ts` lets:
 *   - tests target the wrapper directly (no chatCore harness boot);
 *   - the proxy routing surface evolve independently of the 4,900+ LoC
 *     of the main chatCore handler;
 *   - other callers (e.g. the upcoming "imageGen upstream proxy"
 *     subcommand) reuse the same wrapper without depending on chatCore.
 */

import { getExecutor } from "../../executors/index.ts";
import { getUpstreamProxyConfigCached } from "./comboContextCache.ts";
import type { ExecutorLog, ExecuteInput } from "../../executors/base.ts";
import { getCachedSettings } from "@/lib/db/readCache";

/** Default retryable status codes for the CLIProxyAPI fallback wrapper. */
export const DEFAULT_CLIPROXYAPI_FALLBACK_CODES: readonly number[] = Object.freeze([
  429, 500, 502, 503, 504,
]);

/** Executor return type — inferred from the BaseExecutor.execute() return. */
export type ExecutorResult = Awaited<ReturnType<ReturnType<typeof getExecutor>["execute"]>>;

/** Public surface of the proxy-wrapped executor returned by this module. */
export type ProxyWrappedExecutor = ReturnType<typeof getExecutor>;

/**
 * Read the user-configured fallback codes from settings, falling back to the
 * defaults. The setting is a comma-separated list of integer status codes
 * (e.g. `"429,502,504"`). The defaults are always substituted if the setting
 * is missing, blank, or parses to an empty list.
 */
export async function readCliproxyapiFallbackCodes(): Promise<readonly number[]> {
  try {
    const allSettings = await getCachedSettings();
    const raw = (allSettings as Record<string, unknown>).cliproxyapi_fallback_codes;
    if (typeof raw !== "string" || !raw.trim()) {
      return DEFAULT_CLIPROXYAPI_FALLBACK_CODES;
    }
    const parsed = raw
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 100 && n < 600);
    return parsed.length > 0 ? parsed : DEFAULT_CLIPROXYAPI_FALLBACK_CODES;
  } catch {
    // fail-open: settings cache is best-effort
    return DEFAULT_CLIPROXYAPI_FALLBACK_CODES;
  }
}

/**
 * Test whether a status code is retryable under the given fallback code list.
 * Status 0 is always retryable — it represents a thrown exception from the
 * native executor (network / parse / connection error), which the CLIProxyAPI
 * executor is expected to be able to recover from.
 */
export function isRetryableStatus(
  status: number,
  fallbackCodes: readonly number[] = DEFAULT_CLIPROXYAPI_FALLBACK_CODES
): boolean {
  return fallbackCodes.includes(status) || status === 0;
}

/**
 * Build the fallback wrapper. The wrapper:
 *   1. calls the native executor;
 *   2. on thrown error → retries via the proxy executor;
 *   3. on a retryable status code → retries via the proxy executor;
 *   4. on a non-retryable status code → returns the native result as-is.
 */
function buildFallbackWrapper(
  prov: string,
  nativeExec: ReturnType<typeof getExecutor>,
  proxyExec: ReturnType<typeof getExecutor>,
  fallbackCodes: readonly number[],
  log: ExecutorLog | null | undefined
): ProxyWrappedExecutor {
  const wrapper = Object.create(nativeExec) as ProxyWrappedExecutor;
  wrapper.execute = async (input: ExecuteInput) => {
    let nativeResult;
    try {
      nativeResult = await nativeExec.execute(input);
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

    if (!isRetryableStatus(nativeResult.response.status, fallbackCodes)) {
      return nativeResult;
    }
    log?.info?.(
      "UPSTREAM_PROXY",
      `${prov} native failed (${nativeResult.response.status}), retrying via CLIProxyAPI`
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
}

/**
 * Resolve the executor for `prov`, honoring the upstream proxy routing mode
 * configured for that provider.
 *
 * @param prov Provider name (e.g. "anthropic", "openai", "github-copilot").
 * @param log  Optional logger for the `UPSTREAM_PROXY` tag.
 * @returns    The native executor, the CLIProxyAPI executor, or a fallback
 *             wrapper around the native + proxy executors.
 */
export async function resolveExecutorWithProxy(
  prov: string,
  log?: ExecutorLog | null
): Promise<ProxyWrappedExecutor> {
  const cfg = await getUpstreamProxyConfigCached(prov);
  if (!cfg.enabled || cfg.mode === "native") return getExecutor(prov);

  if (cfg.mode === "cliproxyapi") {
    log?.info?.("UPSTREAM_PROXY", `${prov} routed through CLIProxyAPI (passthrough)`);
    return getExecutor("cliproxyapi");
  }

  // mode === "fallback"
  const nativeExec = getExecutor(prov);
  const proxyExec = getExecutor("cliproxyapi");
  const fallbackCodes = await readCliproxyapiFallbackCodes();
  return buildFallbackWrapper(prov, nativeExec, proxyExec, fallbackCodes, log);
}
