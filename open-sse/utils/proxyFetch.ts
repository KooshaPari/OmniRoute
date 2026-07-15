// @ts-nocheck
import { AsyncLocalStorage } from "node:async_hooks";
import { fetch as undiciFetch } from "undici";
import {
  createProxyDispatcher,
  getDefaultDispatcher,
  normalizeProxyUrl,
  proxyConfigToUrl,
  proxyUrlForLogs,
} from "./proxyDispatcher.ts";
import tlsClient from "./tlsClient.ts";
import { isProxyReachable } from "@/lib/proxyHealth";

function isTlsFingerprintEnabled() {
  return process.env.ENABLE_TLS_FINGERPRINT === "true";
}

/** Per-request tracking of whether TLS fingerprint was used */
type TlsFingerprintStore = { used: boolean };
const tlsFingerprintContext = new AsyncLocalStorage<TlsFingerprintStore>();

/**
 * #5217 (Gap-secondary): a mutable sink that records the proxy actually applied
 * by `runWithProxyContext` for the in-flight request. Executors that pin their
 * own per-account proxy *internally* (e.g. OpencodeExecutor wraps its dispatch
 * in `runWithProxyContext(account.proxy, …)`) never propagate that choice back
 * to the caller's `proxyInfo`, so the post-execution `[ProxyEgress]` line logged
 * `proxy=direct` even though `[ProxyFetch] Applied request proxy context: …`
 * fired. Wrapping the execution in `runWithAppliedProxyCapture(sink, fn)` lets
 * the egress logger read the innermost applied proxy (the last writer wins, which
 * is the executor's per-account proxy).
 */
export type AppliedProxySink = { proxy: unknown };
const appliedProxyContext = new AsyncLocalStorage<AppliedProxySink>();

/**
 * Run `fn` with an applied-proxy capture sink in context. Any
 * `runWithProxyContext` call inside `fn` that ends up applying a proxy records
 * that proxy config into `sink.proxy` (innermost wins). The sink is a plain
 * mutable object the caller retains, so it can read `sink.proxy` after `fn`
 * resolves. Pure plumbing — no behavioral change to the request itself.
 */
export function runWithAppliedProxyCapture<T>(sink: AppliedProxySink, fn: () => T): T {
  return appliedProxyContext.run(sink, fn);
}

type FetchWithDispatcherOptions = RequestInit & { dispatcher?: unknown };
type FetchWithDispatcher = (
  input: RequestInfo | URL,
  init?: FetchWithDispatcherOptions
) => Promise<Response>;

<<<<<<< Updated upstream
/**
 * Flatten a fetch error's `cause` chain (and any Happy-Eyeballs `AggregateError`
 * sub-errors) into a single diagnostic line: code/syscall/errno/address:port + a
 * truncated message. undici/native both reject with a bare `TypeError: fetch failed`
 * whose real reason hides in `.cause`; surfacing it is what makes dispatcher-failure
 * bursts (#4252) diagnosable. Never includes a stack trace (Rule #12). Pure + testable.
 */
export function describeFetchCause(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 5 && !seen.has(cur); depth++) {
    seen.add(cur);
    const e = cur as Record<string, unknown>;
    const seg = [
      typeof e.name === "string" && e.name !== "Error" ? e.name : null,
      typeof e.message === "string" ? e.message.slice(0, 160) : null,
      e.code != null ? `code=${String(e.code)}` : null,
      e.syscall != null ? `syscall=${String(e.syscall)}` : null,
      e.errno != null ? `errno=${String(e.errno)}` : null,
      e.address != null
        ? `address=${String(e.address)}${e.port != null ? `:${String(e.port)}` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    if (seg) parts.push(seg);
    if (Array.isArray(e.errors)) {
      for (const sub of (e.errors as unknown[]).slice(0, 4)) {
        const s = (sub ?? {}) as Record<string, unknown>;
        const subSeg = [
          s.code != null ? `code=${String(s.code)}` : null,
          s.syscall != null ? `syscall=${String(s.syscall)}` : null,
          s.address != null
            ? `address=${String(s.address)}${s.port != null ? `:${String(s.port)}` : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" ");
        if (subSeg) parts.push(`↳ ${subSeg}`);
        else if (typeof s.message === "string") parts.push(`↳ ${s.message.slice(0, 80)}`);
      }
    }
    cur = e.cause;
  }
  return parts.join(" | ") || String(err);
}


function isStreamLikeBody(body: unknown): boolean {
  return (
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    (typeof (body as Record<string, unknown>).getReader === "function" ||
      typeof (body as Record<string, unknown>).stream === "function")
  );
}

function requestHasNonReplayableBody(
  input: RequestInfo | URL,
  options: FetchWithDispatcherOptions
): boolean {
  if (isStreamLikeBody(options.body as unknown)) return true;
  if (typeof Request !== "undefined" && input instanceof Request) {
    if (input.bodyUsed) return true;
    if (input.body !== null) return true;
  }
  return false;
}

/** Injectable dependencies for testability (Approach B DI). */
export type ProxyFetchDeps = {
  undiciFetch?: FetchWithDispatcher;
  nativeFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

=======
>>>>>>> Stashed changes
type PatchState = {
  originalFetch: typeof globalThis.fetch;
  proxyContext: AsyncLocalStorage<unknown>;
  isPatched: boolean;
};

const isCloud = typeof caches !== "undefined" && typeof caches === "object";
const PATCH_STATE_KEY = Symbol.for("omniroute.proxyFetch.state");

function getPatchState(): PatchState {
  const scopedGlobal = globalThis as typeof globalThis & {
    [PATCH_STATE_KEY]?: PatchState;
  };

  if (!scopedGlobal[PATCH_STATE_KEY]) {
    scopedGlobal[PATCH_STATE_KEY] = {
      originalFetch: globalThis.fetch,
      proxyContext: new AsyncLocalStorage(),
      isPatched: false,
    };
  }
  return scopedGlobal[PATCH_STATE_KEY];
}

const patchState = getPatchState();
const originalFetch = patchState.originalFetch;
const originalFetchWithDispatcher = originalFetch as FetchWithDispatcher;
const proxyContext = patchState.proxyContext;

function noProxyMatch(targetUrl) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy) return false;

  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return false;
  }

  const hostname = target.hostname.toLowerCase();
  const port = target.port || (target.protocol === "https:" ? "443" : "80");
  const patterns = noProxy
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  return patterns.some((pattern) => {
    if (pattern === "*") return true;

    const [patternHost, patternPort] = pattern.split(":");
    if (patternPort && patternPort !== port) return false;

    if (!patternHost) return false;

    // Support wildcard matching (e.g. 192.168.* or *.local)
    if (patternHost.includes("*")) {
      const regexStr =
        "^" +
        patternHost
          .split("*")
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*") +
        "$";
      if (new RegExp(regexStr).test(hostname)) return true;
    }

    if (patternHost.startsWith(".")) {
      return hostname.endsWith(patternHost) || hostname === patternHost.slice(1);
    }
    return hostname === patternHost || hostname.endsWith(`.${patternHost}`);
  });
}

function isLocalAddress(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.match(/^172\.(1[6-9]|2\d|3[0-1])\./)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".lan")) return true;
  return false;
}

function resolveEnvProxyUrl(targetUrl) {
  if (noProxyMatch(targetUrl)) return null;

  let protocol;
  try {
    protocol = new URL(targetUrl).protocol;
  } catch {
    return null;
  }

  const proxyUrl =
    protocol === "https:"
      ? process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.ALL_PROXY ||
        process.env.all_proxy
      : process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        process.env.ALL_PROXY ||
        process.env.all_proxy;

  if (!proxyUrl) return null;
  return normalizeProxyUrl(proxyUrl, "environment proxy");
}

function resolveProxyForRequest(targetUrl) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    target = null;
  }

  // Always bypass proxy for local/LAN addresses
  if (target && isLocalAddress(target.hostname.toLowerCase())) {
    return { source: "direct", proxyUrl: null };
  }

  const contextProxy = proxyContext.getStore();
  if (contextProxy) {
    return { source: "context", proxyUrl: proxyConfigToUrl(contextProxy) };
  }

  const envProxyUrl = resolveEnvProxyUrl(targetUrl);
  if (envProxyUrl) {
    return { source: "env", proxyUrl: envProxyUrl };
  }

  return { source: "direct", proxyUrl: null };
}

function getTargetUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return String(input);
}

export async function runWithProxyContext(proxyConfig, fn) {
  if (typeof fn !== "function") {
    throw new TypeError("runWithProxyContext requires a callback function");
  }

  // Inherit existing context if no specific proxyConfig is provided
  const currentContext = proxyContext.getStore();
  const effectiveProxyConfig = proxyConfig || currentContext || null;

  const resolvedProxyUrl = effectiveProxyConfig ? proxyConfigToUrl(effectiveProxyConfig) : null;

  // T14: Proxy Fast-Fail
  // Perform a short TCP reachability check before issuing upstream requests.
  if (resolvedProxyUrl) {
    const reachable = await isProxyReachable(resolvedProxyUrl);
    if (!reachable) {
      const proxyLabel = proxyUrlForLogs(resolvedProxyUrl);
      const err = new Error(`[Proxy Fast-Fail] Proxy unreachable: ${proxyLabel}`) as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = "PROXY_UNREACHABLE";
      err.statusCode = 503;
      throw err;
    }
  }

  return proxyContext.run(effectiveProxyConfig, async () => {
    if (resolvedProxyUrl && effectiveProxyConfig !== currentContext) {
      console.log(
        `[ProxyFetch] Applied request proxy context: ${proxyUrlForLogs(resolvedProxyUrl)}`
      );
    }
    // #5217: record the proxy actually applied so a post-execution egress logger
    // reflects the real egress (executors that pin a per-account proxy internally
    // otherwise leave proxyInfo reading "direct"). Innermost runWithProxyContext
    // wins, which is exactly the per-account proxy the executor selected.
    if (effectiveProxyConfig) {
      const sink = appliedProxyContext.getStore();
      if (sink) sink.proxy = effectiveProxyConfig;
    }
    return fn();
  });
}

async function patchedFetch(input: RequestInfo | URL, options: FetchWithDispatcherOptions = {}) {
  if (options?.dispatcher) {
    // When a dispatcher is present, we MUST use the undici library fetch
    // to ensure version compatibility. Node 22 built-in fetch (undici v6)
    // is incompatible with undici v8 dispatchers (missing onRequestStart, etc.)
    return (undiciFetch as unknown as (...args: unknown[]) => Promise<Response>)(input, options);
  }

  const targetUrl = getTargetUrl(input);
  let resolved;
  try {
    resolved = resolveProxyForRequest(targetUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ProxyFetch] Proxy configuration error: ${message}`);
    throw error;
  }
  const { source, proxyUrl } = resolved;

  if (!proxyUrl) {
    // TLS fingerprint spoofing for direct connections (no proxy configured)
    if (isTlsFingerprintEnabled() && tlsClient.available) {
      try {
        const store = tlsFingerprintContext.getStore();
        if (store) store.used = true;
        return await tlsClient.fetch(targetUrl, {
          ...options,
          headers: options.headers,
          signal: options.signal ?? undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[ProxyFetch] TLS fingerprint failed, falling back to native fetch: ${message}`
        );
        const store = tlsFingerprintContext.getStore();
        if (store) store.used = false;
      }
    }
    // Direct connection (no proxy) — use undici with custom dispatcher for timeout control.
    // Falls back to original native fetch if dispatcher initialization fails (#1054).
<<<<<<< Updated upstream
    // Retries once on transient dispatcher errors before falling back (fix: proxyfetch-undici-retry).
    //
    // Non-replayable body guard: if the body is stream-like (ReadableStream/Blob)
    // or the input is a Request that carries a body, the first dispatcher attempt
    // owns that body. Retrying or falling back to native fetch would replay a
    // consumed/locked body and can mask the original transport error with
    // "Response body object should not be disturbed or locked".
    const hasNonReplayableBody = requestHasNonReplayableBody(input, options);
    const maxAttempts = hasNonReplayableBody ? 1 : 2;
    const _undiciDirect =
      deps.undiciFetch ?? (undiciFetch as unknown as (...args: unknown[]) => Promise<Response>);
    const _nativeFallback =
      (deps.nativeFetch as FetchWithDispatcher | undefined) ?? originalFetchWithDispatcher;
    let lastDispatcherError: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await _undiciDirect(input, {
          ...options,
          // #4252: first attempt uses the pooled keep-alive dispatcher; a retry
          // (after a transient socket error) uses the no-keep-alive dispatcher so
          // it opens a FRESH socket instead of grabbing another stale pooled one
          // — the burst pattern was the retry re-hitting a dead pooled socket and
          // then falling through to native fetch (which also pools) → 502.
          dispatcher: attempt === 0 ? getDefaultDispatcher() : getRetryDispatcher(),
        });
      } catch (dispatcherError) {
        const msg =
          dispatcherError instanceof Error ? dispatcherError.message : String(dispatcherError);
        // CAUTION: Do NOT fallback to native fetch if the error is a version mismatch (invalid onRequestStart)
        // because the native fetch will definitely fail with the undici v8 dispatcher.
        if (msg.includes("onRequestStart")) {
          console.error(
            `[ProxyFetch] Fatal version mismatch: Dispatcher (v8) vs Fetch (v6/native). Hardware upgrade or SOCKS5 config isolation required. Error: ${msg}`
          );
          throw dispatcherError;
        }
        // Only retry/fallback for connection/dispatcher errors, not HTTP errors.
        // Prefer the .code property when available (more stable across undici
        // versions than message-string matching); fall back to substring match
        // for errors that lack a structured code.
        const errCode = (dispatcherError as { code?: unknown })?.code;
        if (
          msg.includes("fetch failed") ||
          errCode === "ECONNREFUSED" ||
          msg.includes("ECONNREFUSED") ||
          (typeof errCode === "string" && errCode.startsWith("UND_ERR")) ||
          msg.includes("UND_ERR")
        ) {
          if (attempt === 0 && maxAttempts > 1) {
            // First failure — retry once with a short jittered delay before giving up.
            lastDispatcherError = dispatcherError;
            await new Promise((r) => setTimeout(r, 25 + Math.random() * 50));
            continue;
          }
          if (hasNonReplayableBody) {
            const detail = `dispatcher=[${describeFetchCause(dispatcherError)}] native=[skipped: non-replayable request body]`;
            console.warn(
              `[ProxyFetch] skipping native fetch fallback for non-replayable body: ${detail}`
            );
            if (dispatcherError instanceof Error) {
              (dispatcherError as Error & { proxyFetchDetail?: string }).proxyFetchDetail = detail;
            }
            throw dispatcherError;
          }

          // All attempts exhausted — try proxy fallback before native fetch
          if (source === "direct" && isFeatureFlagEnabled("PROXY_AUTO_SELECT_ENABLED")) {
            let targetHostname = "";
            try {
              targetHostname = new URL(targetUrl).hostname;
            } catch {
              // ignore
            }
            if (targetHostname) {
              const fallbackProxyUrl = await findWorkingProxy(targetHostname, targetUrl);
              if (fallbackProxyUrl) {
                try {
                  const dispatcher = createProxyDispatcher(fallbackProxyUrl);
                  return await _undiciDirect(input, { ...options, dispatcher });
                } catch {
                  // Proxy also failed — fall through to native fetch
                }
              }
            }
          }
          // Preserve original phrase intact for monitoring: "Undici dispatcher failed, falling back to native fetch"
          // #4252: append the flattened err.cause (code/syscall/errno/address) — the bare
          // "fetch failed" message hides what actually broke, making bursts undiagnosable.
          console.warn(
            `[ProxyFetch] Undici dispatcher failed, falling back to native fetch (after retry): ${describeFetchCause(dispatcherError)}`
          );
          try {
            return await _nativeFallback(input, options);
          } catch (nativeError) {
            // #4252: both the undici dispatcher AND native fetch failed. Surface BOTH
            // causes (server log) and tag the propagated error so the combo executor sees
            // a diagnosable failure IMMEDIATELY instead of a bare "fetch failed" — the
            // latter left jobs sitting until the 30s semaphore queue timeout, which then
            // tripped the circuit breaker.
            const detail = `dispatcher=[${describeFetchCause(dispatcherError)}] native=[${describeFetchCause(nativeError)}]`;
            console.warn(`[ProxyFetch] native fetch fallback ALSO failed: ${detail}`);
            if (nativeError instanceof Error) {
              (nativeError as Error & { proxyFetchDetail?: string }).proxyFetchDetail = detail;
            }
            throw nativeError;
          }
        }
=======
    try {
      return await (undiciFetch as unknown as (...args: unknown[]) => Promise<Response>)(input, {
        ...options,
        dispatcher: getDefaultDispatcher(),
      });
    } catch (dispatcherError) {
      const msg =
        dispatcherError instanceof Error ? dispatcherError.message : String(dispatcherError);
      // CAUTION: Do NOT fallback to native fetch if the error is a version mismatch (invalid onRequestStart)
      // because the native fetch will definitely fail with the undici v8 dispatcher.
      if (msg.includes("onRequestStart")) {
        console.error(
          `[ProxyFetch] Fatal version mismatch: Dispatcher (v8) vs Fetch (v6/native). Hardware upgrade or SOCKS5 config isolation required. Error: ${msg}`
        );
>>>>>>> Stashed changes
        throw dispatcherError;
      }
      // Only fallback for connection/dispatcher errors, not HTTP errors
      if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("UND_ERR")) {
        console.warn(`[ProxyFetch] Undici dispatcher failed, falling back to native fetch: ${msg}`);
        return originalFetchWithDispatcher(input, options);
      }
      throw dispatcherError;
    }
  }

  try {
    const dispatcher = createProxyDispatcher(proxyUrl);
    return await (undiciFetch as unknown as (...args: unknown[]) => Promise<Response>)(input, {
      ...options,
      dispatcher,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ProxyFetch] Proxy request failed (${source}, fail-closed): ${message}`);
    throw error;
  }
}

if (!isCloud && !patchState.isPatched) {
  globalThis.fetch = patchedFetch;
  patchState.isPatched = true;
}

/**
 * Run a function with TLS fingerprint tracking context.
 * After fn completes, returns { result, tlsFingerprintUsed }.
 */
export async function runWithTlsTracking(fn) {
  const store = { used: false };
  const result = await tlsFingerprintContext.run(store, fn);
  return { result, tlsFingerprintUsed: store.used };
}

/** Check if TLS fingerprint is enabled and available */
export function isTlsFingerprintActive() {
  return isTlsFingerprintEnabled() && tlsClient.available;
}

export default isCloud ? originalFetch : patchedFetch;
