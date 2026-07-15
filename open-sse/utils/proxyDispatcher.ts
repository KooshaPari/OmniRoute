import { Agent, ProxyAgent, type Dispatcher } from "undici";
import { socksDispatcher } from "fetch-socks";
import { getUpstreamTimeoutConfig } from "@/shared/utils/runtimeTimeouts";
<<<<<<< Updated upstream
import { stripIpv6Brackets, detectIpLiteralFamily, parseProxyFamily } from "./proxyFamily.ts";
import { createSocksDispatcherWithFamily } from "./socksConnectorWithFamily.ts";
import {
  clearDispatcherCache,
  createRoundRobinDispatcher,
  getDefaultCachedDispatcher,
  getDispatcherCache,
  getRetryCachedDispatcher,
  setDefaultCachedDispatcher,
  setRetryCachedDispatcher,
} from "./proxyDispatcherCache.ts";

export { __cacheProxyDispatcherForTest, clearDispatcherCache } from "./proxyDispatcherCache.ts";

=======

const DISPATCHER_CACHE_KEY = Symbol.for("omniroute.proxyDispatcher.cache");
const DEFAULT_DISPATCHER_KEY = Symbol.for("omniroute.proxyDispatcher.default");
>>>>>>> Stashed changes
const SUPPORTED_PROTOCOLS = new Set(["http:", "https:", "socks5:"]);

<<<<<<< Updated upstream
=======
type DispatcherCache = Map<string, Dispatcher>;
type GlobalWithDispatcherCache = typeof globalThis & {
  [DISPATCHER_CACHE_KEY]?: DispatcherCache;
  [DEFAULT_DISPATCHER_KEY]?: Dispatcher;
};
>>>>>>> Stashed changes
type SocksDispatcherOptions = {
  type: number;
  host: string;
  port: number;
  userId?: string;
  password?: string;
};
type ProxyConfigObject = {
  type?: string;
  host?: string;
  port?: string | number | null;
  username?: string;
  password?: string;
};

<<<<<<< Updated upstream
=======
function getDispatcherCache(): DispatcherCache {
  const globalWithCache = globalThis as GlobalWithDispatcherCache;
  if (!globalWithCache[DISPATCHER_CACHE_KEY]) {
    globalWithCache[DISPATCHER_CACHE_KEY] = new Map();
  }
  return globalWithCache[DISPATCHER_CACHE_KEY];
}

/**
 * Clear all cached proxy dispatchers.
 * Call this when proxy configuration changes to avoid stale connections.
 */
export function clearDispatcherCache() {
  const cache = getDispatcherCache();
  cache.clear();

  const globalWithCache = globalThis as GlobalWithDispatcherCache;
  delete globalWithCache[DEFAULT_DISPATCHER_KEY];
}

>>>>>>> Stashed changes
function getDispatcherOptions() {
  const timeouts = getUpstreamTimeoutConfig(process.env, (message) => {
    console.warn(`[ProxyDispatcher] ${message}`);
  });

  return {
    headersTimeout: timeouts.fetchHeadersTimeoutMs,
    bodyTimeout: timeouts.fetchBodyTimeoutMs,
    connectTimeout: timeouts.fetchConnectTimeoutMs,
    keepAliveTimeout: timeouts.fetchKeepAliveTimeoutMs,
  };
}

function getProxyDispatcherOptions() {
  const options = getDispatcherOptions();
  // Disable keep-alive and pipelining for proxy connections.
  // Cheap proxy servers aggressively drop idle sockets without sending TCP RST,
  // causing "socket hang up" or "Client network socket disconnected" errors
  // on subsequent requests that try to reuse the pooled connection.
  return {
    ...options,
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
    pipelining: 0,
  };
}

<<<<<<< Updated upstream
export function getDefaultDispatcherConnectionLimit(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.OMNIROUTE_DIRECT_DISPATCHER_CONNECTIONS;
  if (raw == null || raw.trim() === "") return DEFAULT_PROXY_DISPATCHER_CONNECTIONS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.warn(
      `[ProxyDispatcher] Invalid OMNIROUTE_DIRECT_DISPATCHER_CONNECTIONS="${raw}". Using default ${DEFAULT_PROXY_DISPATCHER_CONNECTIONS}.`
    );
    return DEFAULT_PROXY_DISPATCHER_CONNECTIONS;
  }

  return Math.min(Math.floor(parsed), MAX_PROXY_DISPATCHER_CONNECTIONS);
}

function getDefaultDispatcherOptions(env: Record<string, string | undefined> = process.env) {
  const options = getDispatcherOptions();
  // #4580 — On the direct egress path, undici's default pipelining (1) let a long
  // SSE stream monopolize the single pooled socket per origin. Keep the public
  // connection-limit option here, but getDefaultDispatcher() fans it out across
  // independent one-connection Agents; in production traces, one multi-connection
  // Agent could still queue same-origin Codex streams behind prior trailers.
  return {
    ...options,
    connections: getDefaultDispatcherConnectionLimit(env),
    pipelining: 0,
  };
}

function createRoundRobinDirectDispatcher(connectionLimit: number): Dispatcher {
  const baseOptions = getDispatcherOptions();
  const perAgentOptions = {
    ...baseOptions,
    connections: 1,
    pipelining: 0,
  };
  const dispatchers = Array.from({ length: connectionLimit }, () => new Agent(perAgentOptions));
  return createRoundRobinDispatcher(dispatchers);
}

export function getDefaultDispatcher(): Dispatcher {
  let dispatcher = getDefaultCachedDispatcher();
  if (!dispatcher) {
    dispatcher = createRoundRobinDirectDispatcher(getDefaultDispatcherConnectionLimit());
    setDefaultCachedDispatcher(dispatcher);
=======
export function getDefaultDispatcher(): Dispatcher {
  const globalWithCache = globalThis as GlobalWithDispatcherCache;
  if (!globalWithCache[DEFAULT_DISPATCHER_KEY]) {
    globalWithCache[DEFAULT_DISPATCHER_KEY] = new Agent(getDispatcherOptions());
>>>>>>> Stashed changes
  }
  return dispatcher;
}

/**
<<<<<<< Updated upstream
 * Dispatcher for RETRYING a direct request that just failed with a transient
 * socket error (UND_ERR_SOCKET / "other side closed" / ECONNRESET).
 *
 * The default direct dispatcher pools keep-alive sockets for up to
 * `fetchKeepAliveTimeoutMs` (4 s). Edges such as nvidia / opencode-zen silently
 * close idle keep-alive sockets within that window, so the next request that
 * reuses the pooled socket fails — and these failures arrive in bursts (#4252).
 * Retrying on the SAME pooled dispatcher can grab ANOTHER stale socket, so the
 * retry uses this no-keep-alive / no-pipelining dispatcher (mirroring the proxy
 * dispatcher mitigation) to force a fresh socket. Healthy keep-alive reuse on
 * the first attempt is preserved — only the retry pays the fresh-socket cost.
 */
export function getRetryDispatcher(): Dispatcher {
  let dispatcher = getRetryCachedDispatcher();
  if (!dispatcher) {
    dispatcher = new Agent({
      ...getDispatcherOptions(),
      keepAliveTimeout: 1,
      keepAliveMaxTimeout: 1,
      pipelining: 0,
    });
    setRetryCachedDispatcher(dispatcher);
  }
  return dispatcher;
}

/**
=======
>>>>>>> Stashed changes
 * Extract the port from a proxy URL string before URL parsing.
 * `new URL("http://host:80")` strips port 80 since it's the HTTP default,
 * but proxy servers commonly listen on port 80/443, so we need to preserve it.
 */
function extractExplicitPort(urlStr: string): string | null {
  try {
    const idx = urlStr.indexOf("://");
    if (idx === -1) return null;
    const authorityStart = idx + 3;
    const authorityEnd = urlStr.indexOf("/", authorityStart);
    const authority =
      authorityEnd === -1
        ? urlStr.slice(authorityStart)
        : urlStr.slice(authorityStart, authorityEnd);
    const lastColon = authority.lastIndexOf(":");
    const atSign = authority.lastIndexOf("@");
    if (lastColon !== -1 && lastColon > atSign) {
      const portStr = authority.slice(lastColon + 1);
      if (/^\d+$/.test(portStr)) {
        const port = Number(portStr);
        if (Number.isInteger(port) && port >= 1 && port <= 65535) return String(port);
      }
    }
  } catch {}
  return null;
}

function defaultPortForProtocol(protocol: string): string {
  if (protocol === "https:" || protocol === "wss:") return "443";
  if (protocol === "socks5:") return "1080";
  return "8080";
}

function normalizePort(port: string | number | null | undefined, protocol: string): string {
  if (!port) return defaultPortForProtocol(protocol);
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("[ProxyDispatcher] Invalid proxy port");
  }
  return String(parsed);
}

/**
 * Build a proxy URL string manually from parsed URL components.
 * We cannot use URL.toString() because the URL serializer silently strips
 * default ports (80 for http, 443 for https). Proxy servers commonly
 * listen on these ports, so we must always include the port explicitly.
 */
function buildProxyUrlString(parsed: URL, port: string): string {
  const auth = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  return `${parsed.protocol}//${auth}${parsed.hostname}:${port}`;
}

export function isSocks5ProxyEnabled(): boolean {
  return process.env.ENABLE_SOCKS5_PROXY === "true";
}

export function proxyUrlForLogs(proxyUrl: string): string {
  const explicitPort = extractExplicitPort(proxyUrl);
  const parsed = new URL(proxyUrl);
  const port = explicitPort || parsed.port || defaultPortForProtocol(parsed.protocol);
  return `${parsed.protocol}//${parsed.hostname}:${port}`;
}

export function normalizeProxyUrl(
  proxyUrl: string,
  source = "proxy",
  { allowSocks5 = isSocks5ProxyEnabled() } = {}
): string {
  // Extract the explicit port from the raw URL string BEFORE parsing,
  // because `new URL()` silently strips default ports (80 for http,
  // 443 for https), which are valid and common for proxy servers.
  const explicitPort = extractExplicitPort(proxyUrl);

  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new Error(`[ProxyDispatcher] Invalid ${source} URL`);
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `[ProxyDispatcher] Unsupported ${source} protocol: ${parsed.protocol.replace(":", "")}`
    );
  }
  if (parsed.protocol === "socks5:" && !allowSocks5) {
    throw new Error(
      "[ProxyDispatcher] SOCKS5 proxy is disabled (set ENABLE_SOCKS5_PROXY=true to enable)"
    );
  }
  if (!parsed.hostname) {
    throw new Error(`[ProxyDispatcher] Invalid ${source} host`);
  }

  // Use the explicit port from the raw string if present, otherwise apply default.
  const port = explicitPort || normalizePort(parsed.port, parsed.protocol);

  // Build the URL string manually instead of using parsed.toString(),
  // which would strip default ports (80/443) and break the proxy connection.
  return buildProxyUrlString(parsed, port);
}

export function proxyConfigToUrl(
  proxyConfig: unknown,
  { allowSocks5 = isSocks5ProxyEnabled() } = {}
): string | null {
  if (!proxyConfig) return null;

  if (typeof proxyConfig === "string") {
    return normalizeProxyUrl(proxyConfig, "context proxy", { allowSocks5 });
  }

  if (typeof proxyConfig !== "object" || Array.isArray(proxyConfig)) {
    throw new Error("[ProxyDispatcher] Invalid context proxy config");
  }

  const config = proxyConfig as ProxyConfigObject;
  const type = String(config.type || "http").toLowerCase();
  const protocol = `${type}:`;

  if (!SUPPORTED_PROTOCOLS.has(protocol)) {
    throw new Error(`[ProxyDispatcher] Unsupported context proxy protocol: ${type}`);
  }
  if (protocol === "socks5:" && !allowSocks5) {
    throw new Error(
      "[ProxyDispatcher] SOCKS5 proxy is disabled (set ENABLE_SOCKS5_PROXY=true to enable)"
    );
  }
  if (!config.host) {
    throw new Error("[ProxyDispatcher] Context proxy host is required");
  }

  const port = normalizePort(config.port, protocol);

  // Build the URL string manually to preserve the port through normalization.
  const auth = config.username
    ? `${encodeURIComponent(config.username)}:${config.password ? encodeURIComponent(config.password) : ""}@`
    : "";

  const proxyUrlStr = `${type}://${auth}${config.host}:${port}`;

<<<<<<< Updated upstream
  const fam = parseProxyFamily(config.family);
  const normalized = normalizeProxyUrl(proxyUrlStr, "context proxy", { allowSocks5 });
  return fam === "auto" ? normalized : `${normalized}?family=${fam}`;
}

/** Resolve the concrete connect family for a proxy URL, fail-closed on contradictions. */
function resolveDispatcherFamily(parsed: URL): 4 | 6 | null {
  const directive = parseProxyFamily(parsed.searchParams.get("family") ?? undefined);
  const literal = detectIpLiteralFamily(parsed.hostname);
  if (directive === "auto") return literal;
  const want = directive === "ipv6" ? 6 : 4;
  if (literal !== null && literal !== want) {
    throw new Error(
      `[ProxyDispatcher] Proxy family directive ${directive} contradicts ${literal === 6 ? "IPv6" : "IPv4"} literal host`
    );
  }
  return want;
}

/** Test-only accessor for the resolved family. */
export function __resolveDispatcherFamilyForTest(proxyUrl: string): 4 | 6 | null {
  return resolveDispatcherFamily(new URL(proxyUrl));
}

/** Test-only accessor for proxy dispatcher pool options. */
export function __getProxyDispatcherOptionsForTest(
  env: Record<string, string | undefined> = process.env
) {
  return getProxyDispatcherOptions(env);
}

export function __getDefaultDispatcherOptionsForTest(
  env: Record<string, string | undefined> = process.env
) {
  return getDefaultDispatcherOptions(env);
}

export function __createRoundRobinDispatcherForTest(dispatchers: Dispatcher[]): Dispatcher {
  return createRoundRobinDispatcher(dispatchers);
=======
  return normalizeProxyUrl(proxyUrlStr, "context proxy", { allowSocks5 });
>>>>>>> Stashed changes
}

export function createProxyDispatcher(proxyUrl: string): Dispatcher {
  const normalizedUrl = normalizeProxyUrl(proxyUrl, "proxy dispatcher");
  const dispatcherCache = getDispatcherCache();
  const proxyDispatcherOptions = getProxyDispatcherOptions();

  let dispatcher = dispatcherCache.get(normalizedUrl);
  if (dispatcher) return dispatcher;

  const parsed = new URL(normalizedUrl);
  const explicitPort = extractExplicitPort(normalizedUrl);
  const port = explicitPort || normalizePort(parsed.port, parsed.protocol);

  if (parsed.protocol === "socks5:") {
    const socksOptions: SocksDispatcherOptions = {
      type: 5,
      host: parsed.hostname,
      port: Number(port),
    };
    if (parsed.username) socksOptions.userId = decodeURIComponent(parsed.username);
    if (parsed.password) socksOptions.password = decodeURIComponent(parsed.password);
    dispatcher = socksDispatcher(
      socksOptions as Parameters<typeof socksDispatcher>[0],
      proxyDispatcherOptions
    ) as Dispatcher;
  } else {
    dispatcher = new ProxyAgent({
      uri: normalizedUrl,
      ...proxyDispatcherOptions,
    });
  }

  dispatcherCache.set(normalizedUrl, dispatcher);
  return dispatcher;
}
