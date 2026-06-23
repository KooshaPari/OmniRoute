// @ts-nocheck
import { AsyncLocalStorage } from "node:async_hooks";
import { PROVIDERS, OAUTH_ENDPOINTS } from "../config/constants.ts";
import { getGitHubCopilotRefreshHeaders } from "../config/providerHeaderProfiles.ts";
import { pbkdf2Sync } from "node:crypto";
import { runWithProxyContext } from "../utils/proxyFetch.ts";
import { serializeRefresh } from "./refreshSerializer.ts";
import { WINDSURF_CONFIG } from "@/lib/oauth/constants/oauth";
import { buildGitLabOAuthEndpoints, resolveGitLabOAuthBaseUrl } from "@/lib/oauth/gitlab";

// --- Per-provider refresh functions (extracted to co-located files in PR-#4609-batch) ---
export { refreshWindsurfToken } from "./tokenRefresh/providers/windsurf";
export { refreshClineToken } from "./tokenRefresh/providers/cline";
export { refreshKimiCodingToken } from "./tokenRefresh/providers/kimiCoding";
export { refreshGitLabDuoToken } from "./tokenRefresh/providers/gitlabDuo";
export { refreshClaudeOAuthToken } from "./tokenRefresh/providers/claudeOAuth";
export { refreshGoogleToken } from "./tokenRefresh/providers/google";
export { refreshQwenToken } from "./tokenRefresh/providers/qwen";
export { refreshCodexToken } from "./tokenRefresh/providers/codex";
export { refreshKiroToken } from "./tokenRefresh/providers/kiro";
export { refreshQoderToken } from "./tokenRefresh/providers/qoder";
export { refreshGitHubToken } from "./tokenRefresh/providers/github";
export { refreshCopilotToken } from "./tokenRefresh/providers/copilot";


// Default token expiry buffer (refresh if expires within 5 minutes).
// Used as fallback for providers without an explicit lead time in
// REFRESH_LEAD_MS below.
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// Per-provider proactive-refresh lead time.
//
// For multi-account OAuth on providers that enforce "single active session per
// client_id" (notably OpenAI Codex / Auth0), refreshing one account's token
// can invalidate the refresh_token family of OTHER accounts under the same
// client. We MINIMIZE refresh frequency for these providers: stay on the
// original access_token until it is genuinely about to expire, so each account
// gets the full access_token lifetime without triggering Auth0's family-
// invalidation logic on its siblings.
//
// Trade-off: when refresh finally happens (last 5 min before expiry), Auth0
// MAY invalidate other accounts' refresh_tokens. The user must re-auth those.
// This is the upstream limitation documented in openai/codex#9648.
//
// Providers with non-rotating tokens (Google, Anthropic) or where multi-
// account is naturally isolated keep longer lead times.
export const REFRESH_LEAD_MS: Record<string, number> = {
  // Rotating refresh tokens — minimize refresh frequency to avoid the
  // "refresh-invalidates-siblings" cascade documented for OpenAI Auth0.
  codex: 5 * 60 * 1000, // 5 minutes
  openai: 5 * 60 * 1000, // same Auth0 backend as codex
  claude: 5 * 60 * 1000, // Anthropic OAuth rotates refresh_tokens (user-reported)
  "gitlab-duo": 5 * 60 * 1000, // GitLab token family revocation on misuse
  kiro: 5 * 60 * 1000, // AWS SSO OIDC issues one-time-use refresh tokens
  "kimi-coding": 5 * 60 * 1000, // Moonshot rotates per-refresh
  qwen: 5 * 60 * 1000, // Alibaba device-code path also rotates
  // Non-rotating providers — longer lead is safe.
  iflow: 24 * 60 * 60 * 1000, // 24 hours
  // Google OAuth refresh_tokens are permanent (non-rotating) — longer lead
  // is safe and reduces unnecessary upstream chatter.
  "gemini-cli": 15 * 60 * 1000,
  antigravity: 15 * 60 * 1000,
  agy: 15 * 60 * 1000, // same Google backend as antigravity (non-rotating refresh tokens)
};

/**
 * Get the proactive refresh lead time (ms) for a given provider.
 * Falls back to TOKEN_EXPIRY_BUFFER_MS (5 min) when not explicitly listed.
 */
export function getRefreshLeadMs(provider: string): number {
  return REFRESH_LEAD_MS[provider] ?? TOKEN_EXPIRY_BUFFER_MS;
}

const CACHE_SECRET = "omniroute-token-cache";

// In-flight refresh promise cache to prevent race conditions
// Key: "provider:sha256(refreshToken)" → Value: Promise<result>
const refreshPromiseCache = new Map();

// Per-connection mutex: prevents parallel OAuth refresh for rotating tokens.
// Key: connectionId → Value: { promise, waiters }
// Primary dedup when credentials.connectionId is present; refreshPromiseCache is fallback.
const connectionRefreshMutex = new Map();

// ─── Token Rotation Map (codex-multi-auth pattern) ─────────────────────────
//
// When a rotating-token provider (Codex, Kimi, GitLab Duo, etc.) refreshes,
// the old refresh_token is consumed and a new one is issued. Any subsequent
// caller arriving with the OLD token would, without protection, hit upstream
// and trigger "refresh_token_reused" — which Auth0 treats as a security event
// and invalidates the entire token family.
//
// This in-memory map caches RECENT rotations so a stale caller can be redirected
// to the new tokens WITHOUT touching upstream. The DB staleness check inside
// the per-connection mutex covers the same scenario when connectionId is known,
// but not all callers pass connectionId (e.g., legacy code paths, retries that
// snapshot credentials before the rotation lands in DB).
//
// Ported from ndycode/codex-multi-auth (lib/refresh-queue.ts:218-248), the only
// publicly known tool that reliably sustains multiple Codex OAuth accounts.
//
// Key format: `provider:sha256(oldRefreshToken)`
// Value: { result: tokens, expiresAt: ms_since_epoch }
type RotationEntry = {
  result: { accessToken: string; refreshToken: string; expiresIn?: number; expiresAt?: string };
  expiresAt: number;
};
const tokenRotationMap = new Map<string, RotationEntry>();
const ROTATION_MAP_TTL_MS = 60 * 1000; // 60 seconds — long enough to catch in-flight stale callers

function cleanupRotationMap(now: number = Date.now()): void {
  if (tokenRotationMap.size === 0) return;
  for (const [key, entry] of tokenRotationMap.entries()) {
    if (entry.expiresAt <= now) tokenRotationMap.delete(key);
  }
}

function lookupRotation(provider: string, refreshToken: string): RotationEntry | undefined {
  cleanupRotationMap();
  const key = getRefreshCacheKey(provider, refreshToken);
  const entry = tokenRotationMap.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    tokenRotationMap.delete(key);
    return undefined;
  }
  return entry;
}

function recordRotation(
  provider: string,
  oldRefreshToken: string,
  result: { accessToken: string; refreshToken: string; expiresIn?: number; expiresAt?: string }
): void {
  if (!oldRefreshToken || !result.refreshToken || oldRefreshToken === result.refreshToken) {
    return;
  }
  const key = getRefreshCacheKey(provider, oldRefreshToken);
  tokenRotationMap.set(key, {
    result,
    expiresAt: Date.now() + ROTATION_MAP_TTL_MS,
  });
}

// Exported for tests + diagnostics; not part of the public API surface.
export function _getTokenRotationMapStats(): { size: number; entries: number } {
  cleanupRotationMap();
  return { size: tokenRotationMap.size, entries: tokenRotationMap.size };
}

export function _clearTokenRotationMap(): void {
  tokenRotationMap.clear();
}

// AsyncLocalStorage for plumbing `onPersist` through executor.refreshCredentials
// without modifying every executor's signature. The chatCore.ts / base.ts call
// sites wrap executor.refreshCredentials in `runWithOnPersist(persistFn, () => ...)`
// and `getAccessToken` reads the active store as a fallback when no explicit
// onPersist parameter is provided. This keeps Fix A's atomic [refresh + persist]
// guarantee while avoiding per-executor signature changes.
type RefreshPersistResult = Record<string, unknown>;
type RefreshPersistFn = (result: RefreshPersistResult) => Promise<void>;
const onPersistStore = new AsyncLocalStorage<RefreshPersistFn>();

export function runWithOnPersist<T>(
  onPersist: RefreshPersistFn | undefined | null,
  fn: () => Promise<T>
): Promise<T> {
  if (!onPersist) return fn();
  return onPersistStore.run(onPersist, fn);
}

export function getActiveOnPersist(): RefreshPersistFn | undefined {
  return onPersistStore.getStore();
}

type RefreshLogger = {
  info?: (tag: string, message: string, data?: Record<string, unknown>) => void;
  warn?: (tag: string, message: string, data?: Record<string, unknown>) => void;
  error?: (tag: string, message: string, data?: Record<string, unknown>) => void;
  debug?: (tag: string, message: string, data?: Record<string, unknown>) => void;
} | null;

function buildFormParams(entries: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  return params;
}

function getRefreshCacheKey(provider, refreshToken) {
  const tokenHash = pbkdf2Sync(refreshToken, CACHE_SECRET, 1000, 32, "sha256").toString("hex");
  return `${provider}:${tokenHash}`;
}

/**
 * OAuth2 error codes that mean the refresh token is permanently dead and
 * retrying will never succeed → callers must emit the unrecoverable sentinel
 * so the HealthCheck deactivates the account instead of looping every 60s.
 * Deliberately EXCLUDES transient codes (server_error, temporarily_unavailable,
 * slow_down) so we never deactivate an account over a recoverable blip.
 */
const UNRECOVERABLE_OAUTH_ERROR_CODES = new Set([
  "invalid_grant",
  "invalid_request",
  "refresh_token_reused",
  "invalid_token",
  "expired_token",
  "unauthorized_client",
  "access_denied",
]);

/**
 * Extract a canonical OAuth error code from a refresh-endpoint error body of
 * ANY shape. Production proxies/MITMs deliver the same `invalid_grant` 400 in
 * several shapes — a plain object `{error:"invalid_grant"}`, a nested
 * `{error:{code:"invalid_grant"}}`, a JSON **string** (double-encoded body),
 * or the raw JSON text wrapped as `{error:"<json text>"}` by a catch branch.
 * The old `errorBody.error === "invalid_grant"` only matched the first shape,
 * so the others returned `null` → the HealthCheck refresh loop (root cause of
 * the 1352× claude/aa5dd5cf invalidation storm).
 *
 * Returns the matched code (only if it is in UNRECOVERABLE_OAUTH_ERROR_CODES)
 * or null. Never matches loosely — a known code is accepted only when it is a
 * bare code string or the value of an `"error"`/`"error_code"` field, so a 502
 * HTML page or a `server_error` body never becomes a false positive.
 */
export function extractOAuthErrorCode(raw: unknown, depth = 0): string | null {
  if (raw == null || depth > 6) return null;

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    if (UNRECOVERABLE_OAUTH_ERROR_CODES.has(s)) return s;
    // The string may itself be JSON (a double-encoded body, or the raw text).
    if (s[0] === "{" || s[0] === "[" || s[0] === '"') {
      try {
        const nested = extractOAuthErrorCode(JSON.parse(s), depth + 1);
        if (nested) return nested;
      } catch {
        // not valid JSON — fall through to the field scan
      }
    }
    // Safety net: a known code appearing as the value of an "error"/"error_code"
    // field inside otherwise-unparsed text. Scoped to avoid false positives.
    const m = s.match(/"error(?:_code)?"\s*:\s*"([a-z_]+)"/i);
    if (m && UNRECOVERABLE_OAUTH_ERROR_CODES.has(m[1])) return m[1];
    return null;
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return (
      extractOAuthErrorCode(o.error, depth + 1) ??
      extractOAuthErrorCode(o.code, depth + 1) ??
      extractOAuthErrorCode(o.error_code, depth + 1)
    );
  }

  return null;
}

/**
 * Read an error response body ONCE and classify it. Returns the raw text (for
 * logging) and the extracted unrecoverable OAuth code (or null). Reading once
 * avoids the double-read bug where `response.json()` consumes the stream and a
 * later `response.text()` returns empty.
 */
async function readRefreshErrorBody(
  response: Response
): Promise<{ rawText: string; code: string | null }> {
  const rawText = await response.text().catch(() => "");
  let parsed: unknown = rawText;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // keep rawText as-is
  }
  const code = extractOAuthErrorCode(parsed) ?? extractOAuthErrorCode(rawText);
  return { rawText, code };
}

/**
 * Refresh OAuth access token using refresh token
 */
export async function refreshAccessToken(
  provider,
  refreshToken,
  credentials,
  log,
  proxyConfig: unknown = null
) {
  const config = PROVIDERS[provider];

  const refreshEndpoint = config?.refreshUrl || config?.tokenUrl;
  if (!config || !refreshEndpoint) {
    log?.warn?.("TOKEN_REFRESH", `No refresh endpoint configured for provider: ${provider}`);
    return null;
  }

  if (!refreshToken) {
    log?.warn?.("TOKEN_REFRESH", `No refresh token available for provider: ${provider}`);
    return null;
  }

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (config.clientId) params.set("client_id", config.clientId);
    if (config.clientSecret) params.set("client_secret", config.clientSecret);

    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(refreshEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params,
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", `Failed to refresh token for ${provider}`, {
        status: response.status,
        error: errorText,
      });
      const code = extractOAuthErrorCode(errorText);
      if (code === "invalid_grant" || code === "invalid_request") {
        return { error: "unrecoverable_refresh_error", code };
      }
      return null;
    }

    const tokens = await response.json();

    log?.info?.("TOKEN_REFRESH", `Successfully refreshed token for ${provider}`, {
      hasNewAccessToken: !!tokens.access_token,
      hasNewRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresIn: tokens.expires_in,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", `Error refreshing token for ${provider}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Specialized refresh for Cline OAuth tokens.
 * Cline refresh endpoint expects JSON body and returns camelCase fields.
 */
/**
 * Refresh Windsurf (Devin CLI / Codeium) tokens.
 *
 * Windsurf uses Firebase Secure Token Service (STS) for token refresh.
 * If the token is a long-lived Codeium API key (import flow), it never
 * expires and refresh is a no-op returning the same token.
 * If the token is a Firebase ID token (device-code flow), it expires after
 * ~1 hour and can be refreshed with the stored Firebase refresh token.
 */
export function supportsTokenRefresh(provider) {
  const explicitlySupported = new Set([
    "gemini",
    "gemini-cli",
    "antigravity",
    "agy",
    "claude",
    "codex",
    "qwen",
    "qoder",
    "github",
    "kiro",
    "amazon-q",
    "cline",
    "kimi-coding",
    "windsurf",
    "devin-cli",
    "gitlab-duo",
  ]);
  if (explicitlySupported.has(provider)) return true;
  const config = PROVIDERS[provider];
  return !!(config?.refreshUrl || config?.tokenUrl);
}

/**
 * Check if a refresh result indicates an unrecoverable error
 * (e.g. the refresh token was already consumed and cannot be reused).
 * Callers should stop retrying and request re-authentication.
 */
export function isUnrecoverableRefreshError(result) {
  return (
    result &&
    typeof result === "object" &&
    (result.error === "unrecoverable_refresh_error" ||
      result.error === "refresh_token_reused" ||
      result.error === "invalid_request" ||
      result.error === "invalid_grant")
  );
}

/**
 * Get access token for a specific provider (with deduplication).
 *
 * Deduplication strategy (two layers):
 * 1. Per-connection mutex (primary): if credentials.connectionId is present, all concurrent
 *    callers for that connection share one in-flight promise regardless of which token they
 *    loaded. This prevents refresh_token_reused errors with rotating (one-time-use) tokens,
 *    e.g. Codex/OpenAI, where callers that loaded credentials at different times may hold
 *    different token strings but refer to the same connection.
 * 2. Token-hash fallback: if no connectionId, dedup by provider+sha256(refreshToken) as before.
 *
 * Additionally, when connectionId is present, the stale-token check reads the DB to detect
 * whether another process already refreshed the token. If the DB token is still valid it is
 * returned immediately without a new upstream call.
 *
 * @param onPersist - Optional callback invoked INSIDE the per-connection mutex closure after a
 *   successful refresh, before the mutex releases. Use this to atomically persist the new tokens
 *   to the DB within the same lock window. If `onPersist` throws, the error is logged and
 *   re-thrown so the caller is aware of the persistence failure.
 */
export async function getAccessToken(
  provider,
  credentials,
  log,
  proxyConfig: unknown = null,
  onPersist?: RefreshPersistFn
) {
  if (!credentials || !credentials.refreshToken || typeof credentials.refreshToken !== "string") {
    log?.warn?.("TOKEN_REFRESH", `No valid refresh token available for provider: ${provider}`);
    return null;
  }

  // If the caller did not pass onPersist explicitly, fall back to the active
  // AsyncLocalStorage store. This lets `runWithOnPersist(persistFn, () =>
  // executor.refreshCredentials(creds, log))` plumb the persist callback through
  // executors (e.g. CodexExecutor) without modifying their signature.
  const effectiveOnPersist = onPersist ?? getActiveOnPersist();

  const connectionId = credentials.connectionId;

  // ── Layer 1: per-connection mutex ──────────────────────────────────────────
  if (connectionId && typeof connectionId === "string") {
    const existing = connectionRefreshMutex.get(connectionId);
    if (existing) {
      existing.waiters++;
      log?.info?.("TOKEN_REFRESH", "Concurrent refresh detected — sharing in-flight refresh", {
        provider,
        connectionId,
        waiters: existing.waiters,
      });
      return existing.promise;
    }

    const entry = { promise: null, waiters: 0 };
    entry.promise = (async () => {
      const result = await _getAccessTokenWithStalenessCheck(
        provider,
        credentials,
        log,
        proxyConfig
      );
      // Invoke onPersist INSIDE the mutex so [network call + DB write] are one atomic step.
      // This prevents a concurrent waiter from reading stale credentials before the DB is updated.
      if (result?.accessToken && effectiveOnPersist) {
        try {
          await effectiveOnPersist(result);
        } catch (persistErr) {
          const { sanitizeErrorMessage } = await import("../utils/error.ts");
          log?.error?.(
            "TOKEN_REFRESH",
            `onPersist callback failed for ${provider}/${connectionId}: ${sanitizeErrorMessage(persistErr instanceof Error ? persistErr : new Error(String(persistErr)))}`
          );
          throw persistErr;
        }
      }
      return result;
    })().finally(() => {
      connectionRefreshMutex.delete(connectionId);
    });
    connectionRefreshMutex.set(connectionId, entry);
    return entry.promise;
  }

  // ── Layer 2: token-hash fallback (no connectionId) ─────────────────────────
  const cacheKey = getRefreshCacheKey(provider, credentials.refreshToken);

  if (refreshPromiseCache.has(cacheKey)) {
    log?.info?.("TOKEN_REFRESH", `Reusing in-flight refresh for ${provider}`);
    return refreshPromiseCache.get(cacheKey);
  }

  // Layer 2 has no per-connection mutex, so callers that pass an onPersist
  // callback expect it to fire after a successful refresh. Without this hook
  // the legacy `connectionId`-less path would silently swallow the callback,
  // leaving DB rows out of sync with rotated tokens (Codex/OpenAI). We still
  // resolve the promise to all waiters with the refreshed credentials.
  const refreshPromise = serializeRefresh(provider, () =>
    _getAccessTokenInternal(provider, credentials, log, proxyConfig)
  )
    .then(async (result) => {
      if (result?.accessToken && effectiveOnPersist) {
        try {
          await effectiveOnPersist(result);
        } catch (persistErr) {
          const { sanitizeErrorMessage } = await import("../utils/error.ts");
          log?.error?.(
            "TOKEN_REFRESH",
            `Layer 2 onPersist callback failed for ${provider}: ${sanitizeErrorMessage(persistErr instanceof Error ? persistErr : new Error(String(persistErr)))}`
          );
          throw persistErr;
        }
      } else if (result?.accessToken && !effectiveOnPersist) {
        log?.warn?.(
          "TOKEN_REFRESH",
          `Layer 2 refresh succeeded for ${provider} without onPersist — DB row will not be updated with rotated token. Callers should pass connectionId for Layer 1 atomicity.`
        );
      }
      return result;
    })
    .finally(() => {
      refreshPromiseCache.delete(cacheKey);
    });

  refreshPromiseCache.set(cacheKey, refreshPromise);
  return refreshPromise;
}

/**
 * Internal helper: performs the DB staleness check then calls the actual refresh.
 * Only called from the per-connection mutex path (Layer 1 above).
 */
async function _getAccessTokenWithStalenessCheck(provider, credentials, log, proxyConfig) {
  // ROTATION MAP CHECK (codex-multi-auth pattern): if this refresh_token was
  // rotated very recently (within ROTATION_MAP_TTL_MS), reuse the cached new
  // tokens INSTEAD of hitting upstream. Auth0 treats re-use of a rotated token
  // as a security event and revokes the entire token family — fatal for
  // multi-account Codex setups. The in-memory rotation map catches this even
  // when the caller bypasses the DB staleness path (no connectionId, stale
  // in-memory credentials in retries, etc.).
  const rotated = lookupRotation(provider, credentials.refreshToken);
  if (rotated) {
    log?.info?.(
      "TOKEN_REFRESH",
      `Rotation map hit for ${provider}. Returning cached rotated tokens (avoids family-revoke).`
    );
    return rotated.result;
  }

  // RACE CONDITION PREVENTION:
  // If the credentials object in memory is stale (e.g. it waited in a semaphore while another
  // request refreshed the token), using its OLD refreshToken will cause the provider (e.g. OpenAI)
  // to reject it with 'refresh_token_reused' and revoke the new token family.
  // We MUST check if the DB has a newer token before proceeding with a network refresh.
  if (credentials.connectionId) {
    try {
      const { getProviderConnectionById } = await import("../../src/lib/db/providers");
      const dbConnection = await getProviderConnectionById(credentials.connectionId);
      if (dbConnection && dbConnection.refreshToken) {
        const now = Date.now();
        const dbExpiresAt = dbConnection.expiresAt ? new Date(dbConnection.expiresAt).getTime() : 0;

        if (dbConnection.refreshToken !== credentials.refreshToken) {
          log?.info?.(
            "TOKEN_REFRESH",
            `Stale token detected in memory for ${provider}. Using refreshed token from DB.`
          );

          // If the DB token is not expired, we can just return it!
          if (dbExpiresAt > now + 60000) {
            // 60 seconds buffer
            log?.info?.("TOKEN_REFRESH", `DB token is still valid. Skipping OAuth refresh.`);
            return {
              accessToken: dbConnection.accessToken,
              refreshToken: dbConnection.refreshToken,
              // Return absolute expiresAt so downstream callers do NOT recompute lifetime
              // from a relative expiresIn value (which would incorrectly extend the TTL).
              // expiresIn intentionally omitted here.
              expiresAt: dbConnection.expiresAt,
            };
          } else {
            // DB token is also expired, but it's the NEWEST one. We must use it to refresh.
            credentials.refreshToken = dbConnection.refreshToken;
            credentials.accessToken = dbConnection.accessToken;
          }
        }
        // NOTE: Fix F (skip when DB == memory and DB > now+60s) was intentionally
        // removed. The caller (checkAndRefreshToken) already decided to refresh
        // because the token is within TOKEN_EXPIRY_BUFFER_MS of expiry. Re-checking
        // with a tighter 60-second window here would skip legitimate refreshes and
        // let near-expired tokens hit the upstream. Layer-1 mutex (per-connection)
        // and Layer-2 dedup (token-hash) already prevent concurrent refreshes for
        // the import-burst scenario.
      }
    } catch (e) {
      log?.warn?.(
        "TOKEN_REFRESH",
        `Failed to check DB for stale token: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  const oldRefreshToken = credentials.refreshToken;
  // Front 1: serialize the network refresh across all connections of the same
  // rotation group (e.g. Codex+openai share one Auth0 client) so two sibling
  // accounts never refresh concurrently and trip Auth0 family revocation.
  const result = await serializeRefresh(provider, () =>
    _getAccessTokenInternal(provider, credentials, log, proxyConfig)
  );

  // Record the rotation so subsequent stale callers can be redirected to the
  // new tokens without re-hitting upstream (which would trigger Auth0 family
  // revocation). Only records when the refresh actually rotated the token.
  if (
    result &&
    typeof result === "object" &&
    !("error" in result) &&
    (result as { accessToken?: string }).accessToken &&
    (result as { refreshToken?: string }).refreshToken
  ) {
    recordRotation(
      provider,
      oldRefreshToken,
      result as {
        accessToken: string;
        refreshToken: string;
        expiresIn?: number;
        expiresAt?: string;
      }
    );
  }

  return result;
}

/**
 * Refresh token by provider type (alias for getAccessToken)
 * @deprecated Since v0.2.70 — use getAccessToken() directly.
 * Still exported because open-sse/index.js and src/sse wrapper use it.
 * Will be removed in a future major version.
 */
export const refreshTokenByProvider = getAccessToken;

/**
 * Format credentials for provider
 */
export function formatProviderCredentials(provider, credentials, log) {
  const config = PROVIDERS[provider];
  if (!config) {
    log?.warn?.("TOKEN_REFRESH", `No configuration found for provider: ${provider}`);
    return null;
  }

  switch (provider) {
    case "gemini":
      return {
        apiKey: credentials.apiKey,
        accessToken: credentials.accessToken,
        projectId: credentials.projectId,
      };

    case "claude":
      return {
        apiKey: credentials.apiKey,
        accessToken: credentials.accessToken,
      };

    case "codex":
    case "qwen":
    case "qoder":
    case "openai":
    case "openrouter":
      return {
        apiKey: credentials.apiKey,
        accessToken: credentials.accessToken,
      };

    case "antigravity":
    case "agy":
    case "gemini-cli":
      return {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      };

    default:
      return {
        apiKey: credentials.apiKey,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      };
  }
}

/**
 * Get all access tokens for a user
 */
export async function getAllAccessTokens(userInfo, log) {
  const results = {};

  if (userInfo.connections && Array.isArray(userInfo.connections)) {
    for (const connection of userInfo.connections) {
      if (connection.isActive && connection.provider) {
        const token = await getAccessToken(
          connection.provider,
          {
            refreshToken: connection.refreshToken,
          },
          log
        );

        if (token) {
          results[connection.provider] = token;
        }
      }
    }
  }

  return results;
}

/**
 * Refresh token with retry and exponential backoff
 * Retries on failure with increasing delay: 1s, 2s, 3s...
 *
 * Includes:
 * - Per-provider circuit breaker (5 consecutive failures → 30min pause)
 * - 30s timeout per refresh attempt to prevent hanging connections
 *
 * @param {function} refreshFn - Async function that returns token or null
 * @param {number} maxRetries - Max retry attempts (default 3)
 * @param {object} log - Logger instance (optional)
 * @param {string} provider - Provider ID for circuit breaker tracking (optional)
 * @returns {Promise<object|null>} Token result or null if all retries fail
 */

// ─── Circuit Breaker State ──────────────────────────────────────────────────
const _circuitBreaker: Record<string, { failures: number; blockedUntil: number }> = {};
const CIRCUIT_BREAKER_THRESHOLD = 5; // consecutive failures before tripping
const CIRCUIT_BREAKER_COOLDOWN = 30 * 60 * 1000; // 30 minutes
const REFRESH_TIMEOUT_MS = 30_000; // 30s max per refresh attempt

interface CircuitBreakerStatusEntry {
  failures: number;
  blocked: boolean;
  blockedUntil: string | null;
  remainingMs: number;
}

interface RefreshLoggerLike {
  error?: (scope: string, message: string) => void;
  warn?: (scope: string, message: string) => void;
}

/**
 * Check if a provider is circuit-breaker blocked.
 */
export function isProviderBlocked(provider: string): boolean {
  const state = _circuitBreaker[provider];
  if (!state) return false;
  if (!state.blockedUntil) return false;
  if (state.blockedUntil > Date.now()) return true;
  // Cooldown expired — reset
  delete _circuitBreaker[provider];
  return false;
}

/**
 * Get active per-connection mutex entries (for diagnostics/metrics).
 * Returns a snapshot of connections that have an in-flight refresh and their waiter count.
 */
export function getConnectionRefreshMutexStatus(): Record<string, { waiters: number }> {
  const result: Record<string, { waiters: number }> = {};
  for (const [connectionId, entry] of connectionRefreshMutex.entries()) {
    result[connectionId] = { waiters: entry.waiters };
  }
  return result;
}

/**
 * Get circuit breaker status for all providers (for diagnostics).
 */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerStatusEntry> {
  const result: Record<string, CircuitBreakerStatusEntry> = {};
  for (const [provider, state] of Object.entries(_circuitBreaker)) {
    result[provider] = {
      failures: state.failures,
      blocked: state.blockedUntil > Date.now(),
      blockedUntil:
        state.blockedUntil > Date.now() ? new Date(state.blockedUntil).toISOString() : null,
      remainingMs: Math.max(0, state.blockedUntil - Date.now()),
    };
  }
  return result;
}

/**
 * Record a successful refresh — resets circuit breaker for provider.
 */
function recordSuccess(provider: string) {
  if (_circuitBreaker[provider]) {
    delete _circuitBreaker[provider];
  }
}

/**
 * Record a failed refresh — increments circuit breaker counter.
 */
function recordFailure(provider: string, log: RefreshLoggerLike | null = null) {
  if (!_circuitBreaker[provider]) {
    _circuitBreaker[provider] = { failures: 0, blockedUntil: 0 };
  }
  _circuitBreaker[provider].failures++;

  if (_circuitBreaker[provider].failures >= CIRCUIT_BREAKER_THRESHOLD) {
    _circuitBreaker[provider].blockedUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
    log?.error?.(
      "TOKEN_REFRESH",
      `🔴 Circuit breaker tripped for ${provider}: ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures. ` +
        `Blocked for ${CIRCUIT_BREAKER_COOLDOWN / 60000}min. Provider needs re-authentication.`
    );
  }
}

/**
 * Execute a function with a timeout.
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T | null> {
  return await new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    if (typeof timer === "object" && "unref" in timer) {
      (timer as { unref?: () => void }).unref?.();
    }

    fn().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function refreshWithRetry(
  refreshFn,
  maxRetries = 3,
  log: RefreshLogger = null,
  provider = "unknown"
) {
  // Circuit breaker check
  if (isProviderBlocked(provider)) {
    log?.warn?.("TOKEN_REFRESH", `⚡ Circuit breaker active for ${provider}, skipping refresh`);
    return null;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 1000;
      log?.debug?.("TOKEN_REFRESH", `Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const result = await withTimeout(refreshFn, REFRESH_TIMEOUT_MS);
      if (isUnrecoverableRefreshError(result)) {
        log?.warn?.(
          "TOKEN_REFRESH",
          `Unrecoverable refresh error for ${provider}: ${result.error} — skipping retries`
        );
        return result;
      }
      if (result) {
        recordSuccess(provider);
        return result;
      }
    } catch (error) {
      log?.warn?.("TOKEN_REFRESH", `Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
    }
  }

  // All retries exhausted — record failure for circuit breaker
  recordFailure(provider, log);
  log?.error?.("TOKEN_REFRESH", `All ${maxRetries} retry attempts failed for ${provider}`);
  return null;
}
