// @ts-nocheck
import { PROVIDERS, OAUTH_ENDPOINTS } from "../config/constants.ts";
import { getGitHubCopilotRefreshHeaders } from "../config/providerHeaderProfiles.ts";
import { pbkdf2Sync } from "node:crypto";
import { runWithProxyContext } from "../utils/proxyFetch.ts";
<<<<<<< Updated upstream
import { serializeRefresh, wasRefreshTokenRotated } from "./refreshSerializer.ts";
import { WINDSURF_CONFIG } from "@/lib/oauth/constants/oauth";
import { buildGitLabOAuthEndpoints, resolveGitLabOAuthBaseUrl } from "@/lib/oauth/gitlab";
=======
>>>>>>> Stashed changes

// Token expiry buffer (refresh if expires within 5 minutes)
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

<<<<<<< Updated upstream
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
  antigravity: 15 * 60 * 1000,
  agy: 15 * 60 * 1000, // same Google backend as antigravity (non-rotating refresh tokens)
};

/**
 * Get the proactive refresh lead time (ms) for a given provider.
 *
 * Precedence:
 *   1. A per-connection override in `providerSpecificData.refreshLeadMs`
 *      (must be a positive finite number), so an operator can tune the lead
 *      time for a single connection without touching the provider defaults.
 *   2. The provider default from REFRESH_LEAD_MS.
 *   3. TOKEN_EXPIRY_BUFFER_MS (5 min) when nothing else applies.
 */
export function getRefreshLeadMs(
  provider: string,
  providerSpecificData?: { refreshLeadMs?: unknown } | null
): number {
  const override = providerSpecificData?.refreshLeadMs;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return override;
  }
  return REFRESH_LEAD_MS[provider] ?? TOKEN_EXPIRY_BUFFER_MS;
}

=======
>>>>>>> Stashed changes
const CACHE_SECRET = "omniroute-token-cache";

// In-flight refresh promise cache to prevent race conditions
// Key: "provider:sha256(refreshToken)" → Value: Promise<result>
const refreshPromiseCache = new Map();

<<<<<<< Updated upstream
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

// ── #4038: compare-and-swap (CAS) guard on the refresh persist ───────────────
// Fix A makes [network refresh + DB write] atomic *for a single connection's
// mutex*. It does NOT protect against a THIRD writer (a sibling process, a
// concurrent HealthCheck, or a replica) landing a fresher rotation on the same
// `connection_id` between the moment the caller read the row and the moment this
// persist runs. Overwriting that fresher row reverts the sibling's rotation, the
// next caller loads the reverted (now-consumed) refresh_token, and Auth0/Anthropic
// revoke the whole token family (the 1352× claude/aa5dd5cf invalidation storm).
//
// The CAS guard carries the refresh_token the caller PRESENTED (the version token,
// since refresh_tokens rotate on every refresh) plus a `reread` of the row's
// current refresh_token. Right before persisting, `getAccessToken` re-reads and, if
// a concurrent writer already rotated the row past the presented token, SKIPS the
// persist so the DB stays at the fresher state. The caller still receives the new
// accessToken — upstream already authenticated the request; only the DB write is
// skipped. No active guard ⇒ behavior is byte-identical to before (opt-in).
type CasGuard = {
  /** The refresh_token the caller presented for this refresh (CAS version token). */
  expectedRefreshToken: string | null;
  /** Re-reads the CURRENT persisted refresh_token for this connection (decrypted). */
  reread: () => Promise<string | null | undefined>;
};
const casGuardStore = new AsyncLocalStorage<CasGuard>();
const casGuardStats = { skipped: 0, persisted: 0 };

export function runWithCasGuard<T>(
  guard: CasGuard | undefined | null,
  fn: () => Promise<T>
): Promise<T> {
  if (!guard) return fn();
  return casGuardStore.run(guard, fn);
}

export function getActiveCasGuard(): CasGuard | undefined {
  return casGuardStore.getStore();
}

/** Skip/persist counters for observability + tests. */
export function getCasGuardStats(): { skipped: number; persisted: number } {
  return { ...casGuardStats };
}

/** Test-only: reset the CAS counters between cases. */
export function _resetCasGuardStats(): void {
  casGuardStats.skipped = 0;
  casGuardStats.persisted = 0;
}

/**
 * Returns true when the persist should be SKIPPED because a concurrent writer
 * already rotated the row's refresh_token past the one we presented (CAS mismatch).
 * Best-effort: any reread failure falls through to persist (never blocks recovery).
 */
async function casGuardShouldSkipPersist(log?: RefreshLogger): Promise<boolean> {
  const guard = getActiveCasGuard();
  if (!guard || !guard.expectedRefreshToken) return false;
  let current: string | null | undefined;
  try {
    current = await guard.reread();
  } catch {
    return false; // reread failed — fall through to persist (best-effort)
  }
  // wasRefreshTokenRotated is true iff both are non-empty AND current !== expected.
  if (wasRefreshTokenRotated(guard.expectedRefreshToken, current)) {
    casGuardStats.skipped++;
    log?.warn?.(
      "TOKEN_REFRESH",
      "CAS guard: skipping persist — a concurrent writer already rotated the refresh_token (#4038)"
    );
    return true;
  }
  casGuardStats.persisted++;
  return false;
}

=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
/**
 * Refresh Windsurf (Devin CLI / Codeium) tokens.
 *
 * Windsurf uses Firebase Secure Token Service (STS) for token refresh.
 * If the token is a long-lived Codeium API key (import flow), it never
 * expires and refresh is a no-op returning the same token.
 * If the token is a Firebase ID token (device-code flow), it expires after
 * ~1 hour and can be refreshed with the stored Firebase refresh token.
 */
export async function refreshWindsurfToken(
  refreshToken: string,
  providerSpecificData: Record<string, unknown> | null | undefined,
  log: RefreshLogger,
  proxyConfig: unknown = null
) {
  if (!refreshToken) {
    log?.warn?.(
      "TOKEN_REFRESH",
      "No refresh token stored for Windsurf — token may be a long-lived API key"
    );
    return null;
  }

  const authMethod = (providerSpecificData?.authMethod as string) || "import";

  // Long-lived Codeium API keys (import flow) have no expiry — nothing to refresh.
  if (authMethod === "import") {
    log?.debug?.("TOKEN_REFRESH", "Windsurf import token is long-lived — no refresh needed");
    return null;
  }

  // Firebase STS refresh for browser-flow tokens.
  // Resolves via WINDSURF_CONFIG.firebaseApiKey, which honors the
  // WINDSURF_FIREBASE_API_KEY env override and falls back to the embedded
  // public default in publicCreds.ts. See docs/security/PUBLIC_CREDS.md.
  const firebaseApiKey = WINDSURF_CONFIG.firebaseApiKey || "";
  if (!firebaseApiKey) {
    log?.warn?.(
      "TOKEN_REFRESH",
      "Windsurf Firebase API key unavailable — skipping Firebase token refresh"
    );
    return null;
  }
  const tokenUrl = `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`;

  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: buildFormParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Windsurf Firebase token", {
        status: response.status,
        error: errorText.slice(0, 200),
      });

      // Firebase STS returns structured errors. Detect unrecoverable token states.
      try {
        const fbError = JSON.parse(errorText);
        const fbCode =
          typeof fbError?.error?.message === "string"
            ? fbError.error.message
            : typeof fbError?.error === "string"
              ? fbError.error
              : null;
        if (
          typeof fbCode === "string" &&
          (fbCode.includes("USER_DISABLED") ||
            fbCode.includes("TOKEN_EXPIRED") ||
            fbCode.includes("INVALID_REFRESH_TOKEN") ||
            fbCode.includes("USER_NOT_FOUND"))
        ) {
          log?.error?.(
            "TOKEN_REFRESH",
            "Windsurf Firebase token is permanently invalid. Re-authentication required.",
            {
              fbCode,
            }
          );
          return { error: "unrecoverable_refresh_error", code: fbCode };
        }
      } catch {
        // not JSON — fall through
      }

      return null;
    }

    const data = await response.json();
    const expiresIn = parseInt(data.expires_in ?? "3600", 10);

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Windsurf Firebase token", {
      expiresIn,
      hasNewIdToken: !!data.id_token,
    });

    return {
      accessToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn,
    };
  } catch (error) {
    log?.error?.(
      "TOKEN_REFRESH",
      `Network error refreshing Windsurf token: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * CodeBuddy CN (Tencent) token refresh — POST /v2/plugin/auth/token/refresh with
 * the refresh token carried in the X-Refresh-Token header (not a form body),
 * matching the official CodeBuddy CLI. Response: { code: 0, data: <token> }.
 */
export async function refreshCodebuddyCnToken(
  refreshToken: string,
  log: RefreshLogger,
  proxyConfig: unknown = null
) {
  if (!refreshToken) return null;
  const { CODEBUDDY_CN_CONFIG } = await import("@/lib/oauth/constants/oauth");
  const oauth = CODEBUDDY_CN_CONFIG;
  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(oauth.refreshUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": oauth.userAgent,
          "X-Requested-With": "XMLHttpRequest",
          "X-Domain": "copilot.tencent.com",
          "X-Refresh-Token": refreshToken,
          "X-Auth-Refresh-Source": "plugin",
          "X-Product": "SaaS",
        },
        body: "{}",
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh CodeBuddy CN token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    if (data?.code !== 0 || !data?.data?.accessToken) {
      log?.error?.("TOKEN_REFRESH", "CodeBuddy CN token refresh returned no token", {
        code: data?.code,
        msg: data?.msg,
      });
      return null;
    }

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed CodeBuddy CN token", {
      hasNewAccessToken: !!data.data.accessToken,
      hasNewRefreshToken: !!data.data.refreshToken,
      expiresIn: data.data.expiresIn,
    });

    return {
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken || refreshToken,
      expiresIn: data.data.expiresIn,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", `Network error refreshing CodeBuddy CN token: ${error?.message}`);
    return null;
  }
}

=======
>>>>>>> Stashed changes
export async function refreshClineToken(refreshToken, log, proxyConfig: unknown = null) {
  const endpoint = PROVIDERS.cline?.refreshUrl;
  if (!endpoint) {
    log?.warn?.("TOKEN_REFRESH", "No refresh URL configured for Cline");
    return null;
  }

  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          refreshToken,
          grantType: "refresh_token",
          clientType: "extension",
        }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Cline token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    const expiresAtIso = data?.expiresAt;
    const expiresIn = expiresAtIso
      ? Math.max(1, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000))
      : undefined;

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Cline token", {
      hasNewAccessToken: !!data?.accessToken,
      hasNewRefreshToken: !!data?.refreshToken,
      expiresIn,
    });

    return {
      accessToken: data?.accessToken,
      refreshToken: data?.refreshToken || refreshToken,
      expiresIn,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Cline token: ${error.message}`);
    return null;
  }
}

/**
 * Specialized refresh for Kimi Coding OAuth tokens.
 * Uses custom X-Msh-* headers required by Kimi OAuth API.
 */
export async function refreshKimiCodingToken(refreshToken, log, proxyConfig: unknown = null) {
  const endpoint = PROVIDERS["kimi-coding"]?.refreshUrl || PROVIDERS["kimi-coding"]?.tokenUrl;
  if (!endpoint) {
    log?.warn?.("TOKEN_REFRESH", "No refresh URL configured for Kimi Coding");
    return null;
  }

  // Generate device info for headers (same as OAuth flow)
  const deviceId = "kimi-refresh-" + Date.now();
  const platform = "omniroute";
  const version = "2.1.2";
  const deviceModel =
    typeof process !== "undefined" ? `${process.platform} ${process.arch}` : "unknown";

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: PROVIDERS["kimi-coding"]?.clientId || "",
    });

    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "X-Msh-Platform": platform,
          "X-Msh-Version": version,
          "X-Msh-Device-Model": deviceModel,
          "X-Msh-Device-Id": deviceId,
        },
        body: params,
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Kimi Coding token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const tokens = await response.json();
    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Kimi Coding token", {
      hasNewAccessToken: !!tokens.access_token,
      hasNewRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scope: tokens.scope,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Kimi Coding token: ${error.message}`);
    return null;
  }
}

/**
 * Specialized refresh for Claude OAuth tokens
 */
export async function refreshClaudeOAuthToken(refreshToken, log, proxyConfig: unknown = null) {
  try {
    // Standard OAuth2 token refresh uses form-urlencoded (not JSON)
    const params = buildFormParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: PROVIDERS.claude.clientId,
    });

    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(OAUTH_ENDPOINTS.anthropic.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "anthropic-beta": "oauth-2025-04-20",
        },
        body: params.toString(),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Claude OAuth token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const tokens = await response.json();

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Claude OAuth token", {
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
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Claude token: ${error.message}`);
    return null;
  }
}

/**
 * Specialized refresh for Google providers (Gemini, Antigravity)
 */
export async function refreshGoogleToken(
  refreshToken,
  clientId,
  clientSecret,
  log,
  proxyConfig: unknown = null
) {
  const response = await runWithProxyContext(proxyConfig, () =>
    fetch(OAUTH_ENDPOINTS.google.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: buildFormParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    log?.error?.("TOKEN_REFRESH", "Failed to refresh Google token", {
      status: response.status,
      error: errorText,
    });
    return null;
  }

  const tokens = await response.json();

  log?.info?.("TOKEN_REFRESH", "Successfully refreshed Google token", {
    hasNewAccessToken: !!tokens.access_token,
    hasNewRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in,
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in,
  };
}

export async function refreshQwenToken(refreshToken, log, proxyConfig: unknown = null) {
  const endpoint = OAUTH_ENDPOINTS.qwen.token;

  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: buildFormParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: PROVIDERS.qwen.clientId,
        }),
      })
    );

    if (response.status === 200) {
      const tokens = await response.json();

      log?.info?.("TOKEN_REFRESH", "Successfully refreshed Qwen token", {
        hasNewAccessToken: !!tokens.access_token,
        hasNewRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresIn: tokens.expires_in,
        providerSpecificData: tokens.resource_url
          ? { resourceUrl: tokens.resource_url }
          : undefined,
      };
    } else {
      const errorText = await response.text().catch(() => "");

      // Detect unrecoverable invalid_request (expired/revoked refresh token or bad client_id)
      let errorCode = null;
      try {
        const parsed = JSON.parse(errorText);
        errorCode = parsed?.error;
      } catch {
        // not JSON, ignore
      }

      if (errorCode === "invalid_request") {
        log?.error?.(
          "TOKEN_REFRESH",
          "Qwen refresh token is invalid or expired. Re-authentication required.",
          {
            status: response.status,
          }
        );
        return { error: "invalid_request" };
      }

      log?.warn?.("TOKEN_REFRESH", `Error with Qwen endpoint`, {
        status: response.status,
        error: errorText,
      });
    }
  } catch (error) {
    log?.warn?.("TOKEN_REFRESH", `Network error trying Qwen endpoint`, {
      error: error.message,
    });
  }

  log?.error?.("TOKEN_REFRESH", "Failed to refresh Qwen token");
  return null;
}

/**
 * Specialized refresh for Codex (OpenAI) OAuth tokens.
 * OpenAI uses rotating (one-time-use) refresh tokens.
 * Returns { error: 'refresh_token_reused' } when the token has already been consumed,
 * so callers can stop retrying and request re-authentication.
 */
export async function refreshCodexToken(refreshToken, log, proxyConfig: unknown = null) {
  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(OAUTH_ENDPOINTS.openai.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: buildFormParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: PROVIDERS.codex.clientId,
          scope: "openid profile email offline_access",
        }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();

      // Detect unrecoverable "refresh_token_reused" or "invalid_grant" error from OpenAI
      // This means the token was already consumed or has expired.
      // Retrying with the same token will never succeed.
      let errorCode = null;
      try {
        const parsed = JSON.parse(errorText);
        errorCode =
          parsed?.error?.code || (typeof parsed?.error === "string" ? parsed.error : null);
      } catch {
        // not JSON, ignore
      }

      if (
        errorCode === "refresh_token_reused" ||
        errorCode === "invalid_grant" ||
        errorCode === "token_expired" ||
        errorCode === "invalid_token"
      ) {
        log?.error?.(
          "TOKEN_REFRESH",
          "Codex refresh token already used or invalid. Re-authentication required.",
          {
            status: response.status,
            errorCode,
          }
        );
        return { error: "unrecoverable_refresh_error", code: errorCode };
      }

      log?.error?.("TOKEN_REFRESH", "Failed to refresh Codex token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const tokens = await response.json();

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Codex token", {
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
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Codex token: ${error.message}`);
    return null;
  }
}

/**
 * Specialized refresh for Kiro (AWS CodeWhisperer) tokens
 * Supports both AWS SSO OIDC (Builder ID/IDC) and Social Auth (Google/GitHub)
 */
export async function refreshKiroToken(
  refreshToken,
  providerSpecificData,
  log,
  proxyConfig: unknown = null
) {
  try {
    const authMethod = providerSpecificData?.authMethod;
    const clientId = providerSpecificData?.clientId;
    const clientSecret = providerSpecificData?.clientSecret;
    const region = providerSpecificData?.region;

    // AWS SSO OIDC (Builder ID or IDC)
    // If clientId and clientSecret exist, assume AWS SSO OIDC (default to builder-id if authMethod not specified)
    if (clientId && clientSecret) {
      const endpoint = `https://oidc.${region || "us-east-1"}.amazonaws.com/token`;

      const response = await runWithProxyContext(proxyConfig, () =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: refreshToken,
            grantType: "refresh_token",
          }),
        })
      );

      if (!response.ok) {
        const errorText = await response.text();
        log?.error?.("TOKEN_REFRESH", "Failed to refresh Kiro AWS token", {
          status: response.status,
          error: errorText,
        });
        return null;
      }

      const tokens = await response.json();

      log?.info?.("TOKEN_REFRESH", "Successfully refreshed Kiro AWS token", {
        hasNewAccessToken: !!tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || refreshToken,
        expiresIn: tokens.expiresIn,
      };
    }

    // Social Auth (Google/GitHub) - use Kiro's refresh endpoint
    const tokenUrl = PROVIDERS.kiro.tokenUrl;
    if (!tokenUrl) {
      log?.error?.("TOKEN_REFRESH", "Missing Kiro token endpoint");
      return null;
    }
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          refreshToken: refreshToken,
        }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Kiro social token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const tokens = await response.json();

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Kiro social token", {
      hasNewAccessToken: !!tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || refreshToken,
      expiresIn: tokens.expiresIn,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Kiro token: ${error.message}`);
    return null;
  }
}

/**
 * Specialized refresh for Qoder OAuth tokens
 */
export async function refreshQoderToken(refreshToken, log, proxyConfig: unknown = null) {
  if (!OAUTH_ENDPOINTS.qoder.token || !PROVIDERS.qoder.clientId || !PROVIDERS.qoder.clientSecret) {
    log?.warn?.(
      "TOKEN_REFRESH",
      "Qoder OAuth refresh skipped: browser OAuth is not configured in this environment"
    );
    return null;
  }

  const basicAuth = btoa(`${PROVIDERS.qoder.clientId}:${PROVIDERS.qoder.clientSecret}`);

  const response = await runWithProxyContext(proxyConfig, () =>
    fetch(OAUTH_ENDPOINTS.qoder.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: buildFormParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: PROVIDERS.qoder.clientId,
        client_secret: PROVIDERS.qoder.clientSecret,
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    log?.error?.("TOKEN_REFRESH", "Failed to refresh Qoder token", {
      status: response.status,
      error: errorText,
    });
    return null;
  }

  const tokens = await response.json();

  log?.info?.("TOKEN_REFRESH", "Successfully refreshed Qoder token", {
    hasNewAccessToken: !!tokens.access_token,
    hasNewRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in,
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in,
  };
}

/**
 * Specialized refresh for GitHub Copilot OAuth tokens
 */
export async function refreshGitHubToken(refreshToken, log, proxyConfig: unknown = null) {
  const response = await runWithProxyContext(proxyConfig, () =>
    fetch(OAUTH_ENDPOINTS.github.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: buildFormParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: PROVIDERS.github.clientId,
        client_secret: PROVIDERS.github.clientSecret,
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    log?.error?.("TOKEN_REFRESH", "Failed to refresh GitHub token", {
      status: response.status,
      error: errorText,
    });
    return null;
  }

  const tokens = await response.json();

  log?.info?.("TOKEN_REFRESH", "Successfully refreshed GitHub token", {
    hasNewAccessToken: !!tokens.access_token,
    hasNewRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in,
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in,
  };
}

/**
 * Refresh GitHub Copilot token using GitHub access token
 */
export async function refreshCopilotToken(githubAccessToken, log, proxyConfig: unknown = null) {
  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch("https://api.github.com/copilot_internal/v2/token", {
        headers: getGitHubCopilotRefreshHeaders(`token ${githubAccessToken}`),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Copilot token", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Copilot token", {
      hasToken: !!data.token,
      expiresAt: data.expires_at,
    });

    return {
      token: data.token,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    log?.error?.("TOKEN_REFRESH", "Error refreshing Copilot token", {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get access token for a specific provider (internal, does the actual work)
 */
async function _getAccessTokenInternal(provider, credentials, log, proxyConfig: unknown = null) {
  switch (provider) {
    case "gemini":
    case "antigravity":
      return await refreshGoogleToken(
        credentials.refreshToken,
        PROVIDERS[provider].clientId,
        PROVIDERS[provider].clientSecret,
        log,
        proxyConfig
      );

    case "claude":
      return await refreshClaudeOAuthToken(credentials.refreshToken, log, proxyConfig);

    case "codex":
      return await refreshCodexToken(credentials.refreshToken, log, proxyConfig);

    case "qwen":
      return await refreshQwenToken(credentials.refreshToken, log, proxyConfig);

    case "qoder":
      return await refreshQoderToken(credentials.refreshToken, log, proxyConfig);

    case "github":
      return await refreshGitHubToken(credentials.refreshToken, log, proxyConfig);

    case "kiro":
    case "amazon-q":
      return await refreshKiroToken(
        credentials.refreshToken,
        credentials.providerSpecificData,
        log,
        proxyConfig
      );

    case "cline":
      return await refreshClineToken(credentials.refreshToken, log, proxyConfig);

    case "kimi-coding":
      return await refreshKimiCodingToken(credentials.refreshToken, log, proxyConfig);

    default:
      // Fallback to generic OAuth refresh for unknown providers
      return refreshAccessToken(provider, credentials.refreshToken, credentials, log, proxyConfig);
  }
}

/**
 * Whether a provider has a supported refresh path in this service.
 */
export function supportsTokenRefresh(provider) {
  const explicitlySupported = new Set([
    "gemini",
    "antigravity",
    "claude",
    "codex",
    "qwen",
    "qoder",
    "github",
    "kiro",
    "amazon-q",
    "cline",
    "kimi-coding",
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
 * If a refresh is already in-flight for the same provider+token,
 * subsequent calls share the existing promise instead of making
 * parallel OAuth requests.
 */
export async function getAccessToken(provider, credentials, log, proxyConfig: unknown = null) {
  if (!credentials || !credentials.refreshToken || typeof credentials.refreshToken !== "string") {
    log?.warn?.("TOKEN_REFRESH", `No valid refresh token available for provider: ${provider}`);
    return null;
  }

<<<<<<< Updated upstream
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
        // #4038: skip the persist if a concurrent writer already rotated this row past the
        // refresh_token we presented (compare-and-swap) — overwriting would revert it.
        if (await casGuardShouldSkipPersist(log)) {
          return result;
        }
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
=======
>>>>>>> Stashed changes
  const cacheKey = getRefreshCacheKey(provider, credentials.refreshToken);

  // If a refresh is already in-flight, reuse it
  if (refreshPromiseCache.has(cacheKey)) {
    log?.info?.("TOKEN_REFRESH", `Reusing in-flight refresh for ${provider}`);
    return refreshPromiseCache.get(cacheKey);
  }

<<<<<<< Updated upstream
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
        // #4038: same compare-and-swap guard as Layer 1 — skip the persist if a concurrent
        // writer already rotated this row past the refresh_token we presented.
        if (await casGuardShouldSkipPersist(log)) {
          return result;
        }
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
=======
  // Start a new refresh and cache the promise
  const refreshPromise = _getAccessTokenInternal(provider, credentials, log, proxyConfig).finally(
    () => {
>>>>>>> Stashed changes
      refreshPromiseCache.delete(cacheKey);
    }
  );

  refreshPromiseCache.set(cacheKey, refreshPromise);
  return refreshPromise;
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
<<<<<<< Updated upstream
    case "agy":
=======
    case "gemini-cli":
>>>>>>> Stashed changes
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
