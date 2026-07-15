// @ts-nocheck
/**
 * Proactive Token Health Check Scheduler
 *
 * Background job that periodically refreshes OAuth tokens before they expire.
 * Each connection can configure its own `healthCheckInterval` (minutes).
 * Default: 60 minutes.  0 = disabled.
 *
 * The scheduler runs a lightweight sweep every TICK_MS (60 s).
 * For each eligible connection it calls the provider-specific refresh function,
 * updates the DB, and logs the result.
 */

import {
  getProviderConnections,
  getProviderConnectionById,
  updateProviderConnection,
  getSettings,
  resolveProxyForConnection,
} from "@/lib/localDb";
import {
  getAccessToken,
  supportsTokenRefresh,
  isUnrecoverableRefreshError,
} from "@omniroute/open-sse/services/tokenRefresh.ts";
import { pickMaskedDisplayValue } from "@/shared/utils/maskEmail";

// ── Constants ────────────────────────────────────────────────────────────────
const TICK_MS = 60 * 1000; // sweep interval: every 60 seconds
const DEFAULT_HEALTH_CHECK_INTERVAL_MIN = 60; // default per-connection interval
const EXPIRED_RETRY_MAX = 3; // max retry attempts for expired connections before giving up
const EXPIRED_RETRY_BACKOFF_MIN = 5; // backoff between expired retries (minutes)
const LOG_PREFIX = "[HealthCheck]";
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function isBuildProcess(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PHASE === "phase-production-build";
}

function isAutomatedTestProcess(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" ||
      process.env.VITEST !== undefined ||
      process.argv.some((arg) => arg.includes("test")))
  );
}

function getConnectionLogLabel(conn: { name?: string; email?: string; id?: string }): string {
  return pickMaskedDisplayValue([conn.name, conn.email], conn.id || "-");
}

export function extractResolvedProxyConfig(resolvedProxy: unknown) {
  if (
    resolvedProxy &&
    typeof resolvedProxy === "object" &&
    !Array.isArray(resolvedProxy) &&
    "proxy" in resolvedProxy
  ) {
    return (resolvedProxy as { proxy?: unknown }).proxy ?? null;
  }

  return resolvedProxy ?? null;
}

function getEffectiveTokenExpiryIso(conn: any): string | null {
  if (!conn || typeof conn !== "object") return null;
  return conn.tokenExpiresAt || conn.expiresAt || null;
}

function getEffectiveTokenExpiryMs(conn: any): number {
  const effectiveExpiry = getEffectiveTokenExpiryIso(conn);
  if (!effectiveExpiry) return 0;
  const expiryMs = new Date(effectiveExpiry).getTime();
  return Number.isFinite(expiryMs) ? expiryMs : 0;
}

<<<<<<< Updated upstream
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes

function getCopilotTokenExpiryMs(expiresAt: unknown): number {
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
    return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
  }
  if (typeof expiresAt === "string" && expiresAt.trim()) {
    const parsed = new Date(expiresAt).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isGitHubAccessTokenOnlyConnection(conn: any): boolean {
  return (
    String(conn?.provider || "").toLowerCase() === "github" &&
    typeof conn?.accessToken === "string" &&
    conn.accessToken.trim().length > 0
  );
}

function canClearGitHubNoRefreshTokenState(conn: any): boolean {
  return (
    !conn?.testStatus ||
    conn.testStatus === "active" ||
    (conn.testStatus === "expired" && conn.errorCode === "no_refresh_token")
  );
}

// ── Refresh circuit breaker ───────────────────────────────────────────────
// A refresh that returns null (network blip, dead proxy, unclassified error)
// leaves the connection active, so the next 60s sweep retries immediately —
// the production refresh loop (claude/aa5dd5cf 1352×, kimi 270×). We track
// consecutive failures and back off exponentially so a stuck connection stops
// hammering the upstream (and stops flooding the logs) instead of looping.
const REFRESH_CIRCUIT_BASE_MIN = 5;
const REFRESH_CIRCUIT_MAX_MIN = 240; // cap at 4h

export function getRefreshBackoffUntil(streak: number, now: string): string {
  const steps = Math.max(0, streak - 1);
  const backoffMin = Math.min(REFRESH_CIRCUIT_BASE_MIN * 2 ** steps, REFRESH_CIRCUIT_MAX_MIN);
  return new Date(new Date(now).getTime() + backoffMin * 60 * 1000).toISOString();
}

export function isInRefreshBackoff(conn: any, nowMs: number): boolean {
  const until = conn?.providerSpecificData?.refreshCircuit?.until;
  if (typeof until !== "string") return false;
  const untilMs = new Date(until).getTime();
  return Number.isFinite(untilMs) && untilMs > nowMs;
}

=======
>>>>>>> Stashed changes
export function buildRefreshFailureUpdate(conn: any, now: string) {
  const wasExpired = conn.testStatus === "expired";
  const retryCount = (conn.expiredRetryCount ?? 0) + (wasExpired ? 1 : 0);

  return {
    lastHealthCheckAt: now,
    // A failed background refresh should not evict otherwise healthy accounts
    // from request routing. Keep non-expired connections active and only persist
    // the refresh error metadata for observability.
    testStatus: wasExpired ? "expired" : "active",
    lastError: "Health check: token refresh failed",
    lastErrorAt: now,
    lastErrorType: "token_refresh_failed",
    lastErrorSource: "oauth",
    errorCode: "refresh_failed",
    ...(wasExpired ? { expiredRetryCount: retryCount, expiredRetryAt: now } : {}),
  };
}

function isEnvFlagEnabled(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return TRUE_ENV_VALUES.has(value.trim().toLowerCase());
}

function isHealthCheckDisabled(): boolean {
  return (
    isEnvFlagEnabled("OMNIROUTE_DISABLE_TOKEN_HEALTHCHECK") ||
    isBuildProcess() ||
    isAutomatedTestProcess()
  );
}

// ── Logging helper ───────────────────────────────────────────────────────────
let cachedHideLogs: boolean | null = null;
let cacheTimestamp = 0;
let pendingHideLogs: Promise<boolean> | null = null;
const CACHE_TTL = 30_000; // Cache settings for 30 seconds

async function shouldHideLogs(): Promise<boolean> {
  if (
    isEnvFlagEnabled("OMNIROUTE_HIDE_HEALTHCHECK_LOGS") ||
    isBuildProcess() ||
    isAutomatedTestProcess()
  ) {
    return true;
  }

  const now = Date.now();

  // Return cached value if valid
  if (cachedHideLogs !== null && now - cacheTimestamp < CACHE_TTL) {
    return cachedHideLogs;
  }

  // Return pending promise if a query is already in progress (request coalescing)
  if (pendingHideLogs !== null) {
    return pendingHideLogs;
  }

  // Create new promise for DB query
  pendingHideLogs = (async () => {
    try {
      const settings = await getSettings();
      cachedHideLogs = settings.hideHealthCheckLogs === true;
      cacheTimestamp = now;
      return cachedHideLogs;
    } catch {
      return false;
    } finally {
      pendingHideLogs = null;
    }
  })();

  return pendingHideLogs;
}

function log(message: string, ...args: any[]) {
  shouldHideLogs().then((hide) => {
    if (!hide) console.log(message, ...args);
  });
}

function logWarn(message: string, ...args: any[]) {
  shouldHideLogs().then((hide) => {
    if (!hide) console.warn(message, ...args);
  });
}

function logError(message: string, ...args: any[]) {
  shouldHideLogs().then((hide) => {
    if (!hide) console.error(message, ...args);
  });
}

/**
 * Clear the cached hideLogs setting (call when settings are updated).
 */
export function clearHealthCheckLogCache() {
  cachedHideLogs = null;
  cacheTimestamp = 0;
}

// ── Singleton guard (globalThis survives HMR re-evaluation) ─────────────────

declare global {
  var __omnirouteTokenHC:
    { initialized: boolean; interval: ReturnType<typeof setInterval> | null } | undefined;
}

function getHCState() {
  if (!globalThis.__omnirouteTokenHC) {
    globalThis.__omnirouteTokenHC = { initialized: false, interval: null };
  }
  return globalThis.__omnirouteTokenHC;
}

/**
 * Start the health-check scheduler (idempotent).
 */
export function initTokenHealthCheck() {
  const state = getHCState();
  if (state.initialized || isHealthCheckDisabled()) return;
  state.initialized = true;

  log(`${LOG_PREFIX} Starting proactive token health-check (tick every ${TICK_MS / 1000}s)`);

  const timer = setTimeout(() => {
    sweep();
    state.interval = setInterval(sweep, TICK_MS);
    if (state.interval && typeof state.interval === "object" && "unref" in state.interval) {
      (state.interval as { unref?: () => void }).unref?.();
    }
  }, 10_000);
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
}

/**
 * Stop the scheduler (useful for tests / hot-reload).
 */
export function stopTokenHealthCheck() {
  const state = getHCState();
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.initialized = false;
}

// ── Core sweep ───────────────────────────────────────────────────────────────
async function sweep() {
  try {
    const connections = await getProviderConnections({ authType: "oauth" });

    if (!connections || connections.length === 0) return;

    const staggerMs = parseInt(process.env.HEALTHCHECK_STAGGER_MS || "3000", 10);

    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      try {
        await checkConnection(conn);
      } catch (err) {
        // Per-connection isolation: one failure never blocks others
        logError(`${LOG_PREFIX} Error checking ${conn.name || conn.id}:`, err.message);
      }

      // Stagger delay between checks to prevent bursting (Issue #1220)
      if (staggerMs > 0 && i < connections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, staggerMs));
      }
    }
  } catch (err) {
    logError(`${LOG_PREFIX} Sweep error:`, err.message);
  }
}

/**
 * Check a single connection and refresh if due.
 */
export async function checkConnection(conn) {
  if (!conn?.id) return;

  const latestConnection = (await getProviderConnectionById(conn.id)) || conn;
  conn = latestConnection;

  // Determine interval (0 = disabled)
  const intervalMin = conn.healthCheckInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL_MIN;
  if (intervalMin <= 0) return;
  if (!conn.isActive) return;
  if (!conn.refreshToken || typeof conn.refreshToken !== "string") {
    if (isGitHubAccessTokenOnlyConnection(conn)) {
      const now = new Date().toISOString();
      const providerSpecificData = conn.providerSpecificData || {};
      const hasCopilotToken =
        typeof providerSpecificData.copilotToken === "string" &&
        providerSpecificData.copilotToken.trim().length > 0;
      const copilotExpiresAtMs = getCopilotTokenExpiryMs(
        providerSpecificData.copilotTokenExpiresAt
      );
      const copilotAboutToExpire =
        !hasCopilotToken ||
        !copilotExpiresAtMs ||
        copilotExpiresAtMs - Date.now() < TOKEN_EXPIRY_BUFFER;

      let refreshedProviderSpecificData: Record<string, unknown> | null = null;
      if (copilotAboutToExpire) {
        const hideLogs = await shouldHideLogs();
        const proxyResolution = await resolveProxyForConnection(conn.id);
        const proxyConfig = extractResolvedProxyConfig(proxyResolution);
        const healthCheckLog = {
          info: (tag: string, msg: string) => {
            if (!hideLogs) console.log(LOG_PREFIX, `[${tag}]`, msg);
          },
          warn: (tag: string, msg: string) => {
            if (!hideLogs) console.warn(LOG_PREFIX, `[${tag}]`, msg);
          },
          error: (tag: string, msg: string, extra?: Record<string, unknown>) => {
            if (!hideLogs) console.error(LOG_PREFIX, `[${tag}]`, msg, extra || "");
          },
        };

        const copilotResult = await refreshCopilotToken(
          conn.accessToken,
          healthCheckLog,
          proxyConfig
        );
        if (copilotResult?.token) {
          refreshedProviderSpecificData = {
            ...providerSpecificData,
            copilotToken: copilotResult.token,
            copilotTokenExpiresAt: copilotResult.expiresAt,
          };
        }
      }

      if (canClearGitHubNoRefreshTokenState(conn)) {
        await updateProviderConnection(conn.id, {
          lastHealthCheckAt: now,
          testStatus: "active",
          lastError:
            copilotAboutToExpire && !refreshedProviderSpecificData
              ? "Health check: Copilot token refresh failed"
              : null,
          lastErrorAt: copilotAboutToExpire && !refreshedProviderSpecificData ? now : null,
          lastErrorType:
            copilotAboutToExpire && !refreshedProviderSpecificData ? "token_refresh_failed" : null,
          lastErrorSource: copilotAboutToExpire && !refreshedProviderSpecificData ? "oauth" : null,
          errorCode:
            copilotAboutToExpire && !refreshedProviderSpecificData ? "refresh_failed" : null,
          expiredRetryCount: null,
          expiredRetryAt: null,
          ...(refreshedProviderSpecificData
            ? { providerSpecificData: refreshedProviderSpecificData }
            : {}),
        });
      } else {
        await updateProviderConnection(conn.id, {
          lastHealthCheckAt: now,
          ...(refreshedProviderSpecificData
            ? { providerSpecificData: refreshedProviderSpecificData }
            : {}),
        });
      }

      log(
        `${LOG_PREFIX} ${conn.provider}/${getConnectionLogLabel(conn)} has no refresh token but has a GitHub access token; keeping connection active`
      );
      return;
    }

    // #5326: a refresh-CAPABLE provider (e.g. antigravity/gemini) with no usable
    // refresh token can never self-heal via the sweep — it genuinely needs re-auth.
    // Silently skipping here left the row at testStatus="active" while the dashboard
    // badge (which derives expiry from tokenExpiresAt||expiresAt) showed a confusing
    // cosmetic "Token Expired". Surface reality as a terminal "expired" status instead.
    // Guard tightly so we do NOT clobber:
    //   - providers that simply don't use refresh tokens (supportsTokenRefresh=false)
    //   - connections already in a terminal/specific state (expired/banned/credits_exhausted)
    //   - transient cooldown state (unavailable) owned by the request path
    const refreshCapableNeedsReauth =
      supportsTokenRefresh(conn.provider) &&
      (!conn.testStatus || conn.testStatus === "active") &&
      !(conn.apiKey && conn.apiKey.length > 0); // API-key-only connections don't need refresh tokens
    if (refreshCapableNeedsReauth) {
      const now = new Date().toISOString();
      await updateProviderConnection(conn.id, {
        testStatus: "expired",
        lastHealthCheckAt: now,
        lastError: "No refresh token available — re-authenticate this account.",
        lastErrorAt: now,
        lastErrorType: "no_refresh_token",
        lastErrorSource: "oauth",
        errorCode: "no_refresh_token",
      });
      log(
        `${LOG_PREFIX} ${conn.provider}/${getConnectionLogLabel(conn)} has no refresh token; marking expired (needs re-auth)`
      );
    }
    return;
  }

  // Retry expired connections with exponential backoff up to EXPIRED_RETRY_MAX times.
  if (conn.testStatus === "expired") {
    const retryCount = conn.expiredRetryCount ?? 0;
    if (retryCount >= EXPIRED_RETRY_MAX) return;

    const lastRetry = conn.expiredRetryAt ? new Date(conn.expiredRetryAt).getTime() : 0;
    const backoffMs = EXPIRED_RETRY_BACKOFF_MIN * 60 * 1000 * Math.pow(2, retryCount);
    if (Date.now() - lastRetry < backoffMs) return;

    log(
      `${LOG_PREFIX} Retrying expired ${conn.provider}/${getConnectionLogLabel(conn)} (attempt ${retryCount + 1}/${EXPIRED_RETRY_MAX})`
    );
  }

  if (!supportsTokenRefresh(conn.provider)) {
    const now = new Date().toISOString();
    await updateProviderConnection(conn.id, { lastHealthCheckAt: now });
    log(
      `${LOG_PREFIX} Skipping ${conn.provider}/${getConnectionLogLabel(conn)} (refresh unsupported)`
    );
    return;
  }

  const intervalMs = intervalMin * 60 * 1000;
  const lastCheck = conn.lastHealthCheckAt ? new Date(conn.lastHealthCheckAt).getTime() : 0;

  // Prefer expiry-driven refresh when the provider returns a concrete expiry timestamp.
  // Rotating-token providers such as Codex should not be refreshed on a fixed hourly
  // cadence while the access token is still valid for days.
  const tokenExpiresAt = getEffectiveTokenExpiryMs(conn);
  const hasKnownExpiry = tokenExpiresAt > 0;
  const isAboutToExpire = hasKnownExpiry && tokenExpiresAt - Date.now() < TOKEN_EXPIRY_BUFFER;
  const shouldRefreshByInterval = !hasKnownExpiry && Date.now() - lastCheck >= intervalMs;

  if (!isAboutToExpire && !shouldRefreshByInterval) return;

  const reason = isAboutToExpire ? "token expiring soon" : `interval: ${intervalMin}min`;
  log(`${LOG_PREFIX} Refreshing ${conn.provider}/${getConnectionLogLabel(conn)} (${reason})`);

  const attemptedRefreshToken = conn.refreshToken;
  const attemptedAccessToken = conn.accessToken || null;
  const credentials = {
    refreshToken: attemptedRefreshToken,
    accessToken: attemptedAccessToken,
    expiresAt: getEffectiveTokenExpiryIso(conn),
    providerSpecificData: conn.providerSpecificData,
  };

  const hideLogs = await shouldHideLogs();
  const proxyResolution = await resolveProxyForConnection(conn.id);
  const proxyConfig = extractResolvedProxyConfig(proxyResolution);
  const result = await getAccessToken(
    conn.provider,
    credentials,
    {
      info: (tag, msg) => {
        if (!hideLogs) console.log(`${LOG_PREFIX} [${tag}] ${msg}`);
      },
      warn: (tag, msg) => {
        if (!hideLogs) console.warn(`${LOG_PREFIX} [${tag}] ${msg}`);
      },
      error: (tag, msg, extra) => {
        if (!hideLogs) console.error(`${LOG_PREFIX} [${tag}] ${msg}`, extra || "");
      },
    },
    proxyConfig
  );

  const now = new Date().toISOString();

  // ─── Handle unrecoverable errors (e.g. refresh_token_reused) ───────────
  // OpenAI Codex uses rotating one-time-use refresh tokens.
  // Once used, the old token is permanently invalidated.
  // Retrying will never succeed → deactivate and stop the loop.
  if (isUnrecoverableRefreshError(result)) {
    const currentConnection = await getProviderConnectionById(conn.id);
    const credentialsChangedSinceSweep =
      !!currentConnection &&
      (currentConnection.refreshToken !== attemptedRefreshToken ||
        (currentConnection.accessToken || null) !== attemptedAccessToken);

    if (credentialsChangedSinceSweep) {
      await updateProviderConnection(conn.id, {
        lastHealthCheckAt: now,
      });
      logWarn(
        `${LOG_PREFIX} ! ${conn.provider}/${getConnectionLogLabel(conn)} changed during refresh; skipping stale deactivation`
      );
      return;
    }

    const accessTokenStillValid =
      getEffectiveTokenExpiryMs(currentConnection || conn) > Date.now() + TOKEN_EXPIRY_BUFFER;

    if (accessTokenStillValid) {
      await updateProviderConnection(conn.id, {
        lastHealthCheckAt: now,
        testStatus: "active",
        lastError: `Health check refresh failed (${result.error}). Re-authenticate before the current access token expires.`,
        lastErrorAt: now,
        lastErrorType: result.error,
        lastErrorSource: "oauth",
        errorCode: result.error,
      });
      logWarn(
        `${LOG_PREFIX} ! ${conn.provider}/${getConnectionLogLabel(conn)} refresh token is invalid (${result.error}), but the current access token is still valid; keeping connection active`
      );
      return;
    }

    await updateProviderConnection(conn.id, {
      lastHealthCheckAt: now,
      testStatus: "expired",
      lastError: `Refresh token consumed (${result.error}). Please re-authenticate this account.`,
      lastErrorAt: now,
      lastErrorType: result.error,
      lastErrorSource: "oauth",
      errorCode: result.error,
      isActive: false,
<<<<<<< Updated upstream
      // Only rotating-token providers (Codex/OpenAI/etc.) have single-use refresh
      // tokens that are genuinely consumed and worthless after a failed refresh, so
      // clearing them is safe. For non-rotating providers (Google: antigravity /
      // gemini) the stored refresh_token is the user's only recovery
      // artifact — nulling it caused #3679 (the connection reports "No valid refresh
      // token available" and can never recover even after re-activation). Preserve it.
      ...(isRotatingProvider ? { refreshToken: null } : {}),
=======
      refreshToken: null,
>>>>>>> Stashed changes
    });
    logError(
      `${LOG_PREFIX} ✗ ${conn.provider}/${getConnectionLogLabel(conn)} — ` +
        `Refresh token is permanently invalid (${result.error}). ` +
        `Connection deactivated. Re-authenticate to restore.`
    );
    return;
  }

  if (result && result.accessToken) {
    const updateData: any = {
      accessToken: result.accessToken,
      lastHealthCheckAt: now,
      testStatus: "active",
      lastError: null,
      lastErrorAt: null,
      lastErrorType: null,
      lastErrorSource: null,
      errorCode: null,
      expiredRetryCount: null,
      expiredRetryAt: null,
    };

    if (result.refreshToken) {
      updateData.refreshToken = result.refreshToken;
    }

    if (result.expiresIn) {
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();
      updateData.expiresAt = expiresAt;
      updateData.tokenExpiresAt = expiresAt;
    } else if (result.expiresAt) {
      updateData.expiresAt = result.expiresAt;
      updateData.tokenExpiresAt = result.expiresAt;
    }

    if (result.providerSpecificData) {
      updateData.providerSpecificData = {
        ...(conn.providerSpecificData || {}),
        ...result.providerSpecificData,
      };
    }

    await updateProviderConnection(conn.id, updateData);
    log(`${LOG_PREFIX} ✓ ${conn.provider}/${getConnectionLogLabel(conn)} refreshed`);
  } else {
    const updateData = buildRefreshFailureUpdate(conn, now);
    await updateProviderConnection(conn.id, updateData);
    logWarn(
      `${LOG_PREFIX} ✗ ${conn.provider}/${getConnectionLogLabel(conn)} refresh failed` +
        (conn.testStatus === "expired"
          ? ` (${updateData.expiredRetryCount}/${EXPIRED_RETRY_MAX} expired retries used)`
          : "")
    );
  }
}

// Auto-start when imported
initTokenHealthCheck();

export default initTokenHealthCheck;
