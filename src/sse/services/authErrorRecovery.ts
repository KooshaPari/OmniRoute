/**
 * Error recovery: markAccountUnavailable, clearAccountError, clearRecoveredProviderState.
 *
 * Handles connection cooldown, model lockout, egress-bucketed lockout,
 * terminal status transitions, and auto-disable for banned accounts.
 *
 * Extracted from auth.ts for modularity. The barrel re-exports from auth.ts
 * preserve all existing import paths.
 */
import {
  getProviderConnections,
  updateProviderConnection,
  getProviderConnectionById,
} from "@/lib/db/providers";
import { toProviderConnection } from "@/lib/db/providers/lazyConnectionView";
import { getRecentEgressIpForConnection, EGRESS_IP_LOOKUP_WINDOW_MS } from "@/lib/db/proxyLogs";
import { getDbInstance } from "@/lib/db/core";
import { getCachedProviderNodes, getCachedSettings } from "@/lib/db/readCache";
import {
  getUnavailableUntil,
  cooldownUntilMs,
  checkFallbackError,
  lockModel,
  hasPerModelQuota,
  getRuntimeProviderProfile,
  recordModelLockoutFailure,
  retryHintBypassesMaxCooldownMs,
  isProviderModelUnsupported400,
} from "@omniroute/open-sse/services/accountFallback.ts";
import { isSharedWalletCredits402 } from "@omniroute/open-sse/services/accountFallback/sharedWalletCredits.ts";
import { getQuotaScopeLabelForProvider } from "@omniroute/open-sse/services/antigravityQuotaFamily.ts";
import { persistAntigravityFamilyCooldownIfQuota } from "@omniroute/open-sse/services/antigravityFamilyCooldown.ts";
import {
  ALIBABA_FREE_DRAINED_LOCK_MS,
  getAlibabaBillingMode,
  isAlibabaFreeQuotaExhaustedError,
  isAlibabaModelStudioProvider,
  mergeAlibabaFreeDrainedModels,
  rehydrateAlibabaFreeDrainedModelLocks,
} from "@omniroute/open-sse/services/alibabaFreeTier.ts";
import { getCodexModelScope } from "@omniroute/open-sse/config/codexQuotaScopes.ts";
import {
  getCodexChildCooldown,
  persistCodexChildCooldown,
} from "@omniroute/open-sse/services/codexAccount/index.ts";
import {
  honorsRuleLockScope,
  isEgressBucketedLockScope,
  egressBucketedLockProviders,
} from "@omniroute/open-sse/config/providerErrorRules.ts";
import { isLocalProvider } from "@omniroute/open-sse/config/providerRegistry.ts";
import { COOLDOWN_MS, RateLimitReason } from "@omniroute/open-sse/config/constants.ts";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/errorSanitization.ts";
import { describeUpstreamFailure } from "@/shared/utils/upstreamError";
import { resolveProviderId } from "@/shared/constants/providers";
import {
  classifyProviderError,
  PROVIDER_ERROR_TYPES,
} from "@omniroute/open-sse/services/errorClassifier.ts";
import { resolveTerminalConnectionStatus } from "./authTerminalStatus.ts";
import { getResource404Bypass } from "./requestResourceHealth";
import { isVertexConnectionWidePermissionDenied } from "./vertexErrorClassifier";
import { maybeAutoDisableBannedAccount } from "./autoDisableBannedAccount";
import { shouldIsolateProbeFailures } from "@/shared/utils/probeOrigin";
import { resolveModelLockoutSettings } from "@/lib/resilience/modelLockoutSettings";
import { clearConnectionErrorIfUnchanged } from "@/lib/db/providers";
import * as log from "../utils/logger";
import { isTerminalConnectionStatus } from "./authQuotaPolicy";
import { parseFutureDateMs, getCachedQuotaResetAt } from "./authQuotaPolicy";
import { ANTIGRAVITY_FAMILY_INFERRED_BASE_COOLDOWN_MS } from "./authQuotaPolicy";

// ─── Anti-Thundering Herd: per-connection mutex for markAccountUnavailable ───
// Prevents multiple concurrent requests from marking the same connection
// unavailable in parallel, which was the root cause of cascading 502 lockouts.
const markMutexes = new Map<string, Promise<void>>();

// ─── Shared types ────────────────────────────────────────────────────────
interface RecoverableConnectionState {
  connectionId: string;
  testStatus?: string | null;
  lastError?: string | null;
  rateLimitedUntil?: string | null;
  errorCode?: string | number | null;
  lastErrorType?: string | null;
  lastErrorSource?: string | null;
}

export function isAgentrouterConnectionQuotaScope(
  provider: string | null | undefined,
  fallbackResult: {
    ruleScope?: "model" | "provider" | "connection";
    reason?: string;
    permanent?: boolean;
    creditsExhausted?: boolean;
  }
): boolean {
  return (
    honorsRuleLockScope(provider) &&
    fallbackResult.ruleScope === "connection" &&
    fallbackResult.reason === RateLimitReason.QUOTA_EXHAUSTED &&
    !fallbackResult.permanent &&
    !fallbackResult.creditsExhausted
  );
}

async function resolveDailyResetForProvider(
  provider: string | null
): Promise<{ timezone?: unknown; hour?: unknown } | null> {
  if (!provider) return null;
  try {
    const nodes = await getCachedProviderNodes();
    const node = nodes.find((candidate) => {
      if (!candidate) return false;
      return candidate.id === provider || candidate.prefix === provider;
    });
    if (!node) return null;
    return {
      timezone: node.dailyQuotaResetTimezone,
      hour: node.dailyQuotaResetHour,
    };
  } catch {
    return null;
  }
}

/**
 * #10880 — cools down every connection sharing the failing connection's last
 * known egress IP. Best-effort and side-effect-safe by design:
 * - The failing connection C is NOT written here: the branch marks it BEFORE
 *   calling this helper (mirror of the connection-scoped agentrouter branch)
 *   — the branch returns right after, so the generic path below is never
 *   reached and opencode (passthroughModels) would otherwise get a per-model
 *   lockModel instead of a connection cooldown.
 * - Any DB failure is caught and logged — markAccountUnavailable must never
 *   fail because of the egress lookup or the sibling writes.
 * - Siblings are re-read fresh and only written when NOT terminal (T06: a
 *   banned/credits_exhausted sibling is never downgraded by an IP-level
 *   signal) and not already in cooldown.
 * - No mutex per sibling (markMutexes is per-connection): concurrent 429s may
 *   double-write, idempotent via updateProviderConnection.
 */
async function applyEgressIpLockout(
  connectionId: string,
  provider: string,
  cooldownMs: number,
  reason: string
): Promise<void> {
  try {
    const since = new Date(Date.now() - EGRESS_IP_LOOKUP_WINDOW_MS).toISOString();
    const recent = getRecentEgressIpForConnection(connectionId, since);
    if (!recent) {
      log.info(
        "AUTH",
        `Egress lock: no known egress IP for ${provider}:${connectionId.slice(0, 8)} — skipped`
      );
      return;
    }
    const db = getDbInstance();
    // Siblings are scoped to the allowlisted provider family: the egress IP
    // budget is per provider (the opencode free tier is IP-bucketed, not
    // account-bucketed — see #9611), so a 429 from one provider must never
    // cool an unrelated provider sharing the same host IP (the default
    // no-proxy deployment egresses everything through one IP).
    //
    // The family is BOUND from the same allowlist the branch gate reads
    // (egressBucketedLockProviders() / isEgressBucketedLockScope) — never
    // re-spelled as a SQL literal: a duplicated list would not follow a
    // widening of the allowlist, leaving the opt-in half applied (the gate
    // would fire for the new provider while its siblings stayed invisible).
    const family = egressBucketedLockProviders();
    const familyPlaceholders = family.map(() => "?").join(",");
    const siblingIds = db
      .prepare(
        `SELECT DISTINCT connection_id FROM proxy_logs
         WHERE egress_ip = ? AND timestamp >= ? AND connection_id != ?
         AND provider IN (${familyPlaceholders})`
      )
      .all(recent.egressIp, since, connectionId, ...family)
      .map((row: { connection_id: string }) => row.connection_id);
    const now = Date.now();
    let cooledCount = 0;
    for (const id of siblingIds) {
      // Fresh camelCase re-read per sibling (never trust a stale snapshot) —
      // reuse the house getter so terminal/cooldown checks see the same shape
      // the rotation uses (pattern agentrouter test).
      const sibling = toProviderConnection(await getProviderConnectionById(id));
      if (!sibling.id) continue;
      if (isTerminalConnectionStatus(sibling)) continue; // T06
      // cooldownUntilMs (not a raw new Date()) because rate_limited_until can
      // hold a numeric-epoch string (e.g. the Antigravity full-quota path) —
      // see #3954; NaN (no/invalid value) never exceeds `now`.
      const existingUntil = cooldownUntilMs(sibling.rateLimitedUntil);
      if (existingUntil > now) continue; // already cooling — never shorten
      await updateProviderConnection(id, {
        lastErrorType: reason || RateLimitReason.QUOTA_EXHAUSTED,
        lastError: `Shared egress IP quota exhausted (${provider})`,
        lastErrorAt: new Date().toISOString(),
        errorCode: 429,
        rateLimitedUntil: getUnavailableUntil(cooldownMs),
        testStatus: "unavailable",
      });
      cooledCount += 1;
    }
    log.info(
      "AUTH",
      `Egress-bucketed cooldown: ${provider} ip=${recent.egressIp} connection=${connectionId.slice(0, 8)} cooled ${cooledCount} sibling(s) for ${Math.ceil(cooldownMs / 1000)}s`
    );
  } catch (err) {
    log.warn("AUTH", `Egress-bucketed lock skipped after DB error: ${(err as Error).message}`);
  }
}

/** Build the options for markAccountUnavailable on the chat exhaustion path.
 * Single place that forwards the request id so no chat sender can forget it:
 * every chat caller passes its in-scope id through here. */
export function buildExhaustionOptions(
  correlationId: string | null,
  rest: {
    persistUnavailableState?: boolean;
    /** Caller is the combo engine — it records its own model-level lockouts. */
    isCombo?: boolean;
    headers?: Headers | Record<string, string> | null;
  } = {}
): {
  persistUnavailableState?: boolean;
  isCombo?: boolean;
  headers?: Headers | Record<string, string> | null;
  correlationId: string | null;
} {
  return { ...rest, correlationId };
}

/** Persist exponential-backoff state for an unavailable provider connection. */
export async function markAccountUnavailable(
  connectionId: string,
  status: number,
  errorText: string,
  provider: string | null = null,
  model: string | null = null,
  providerProfile = null,
  options: {
    persistUnavailableState?: boolean;
    /** Caller is the combo engine — it records its own model-level lockouts. */
    isCombo?: boolean;
    headers?: Headers | Record<string, string> | null;
    correlationId?: string | null;
  } = {}
) {
  const currentMutex = markMutexes.get(connectionId) || Promise.resolve();
  let resolveMutex: (() => void) | undefined;
  markMutexes.set(
    connectionId,
    new Promise((resolve) => {
      resolveMutex = resolve;
    })
  );

  try {
    await currentMutex;

    // STRICT_ZERO_COST: this connection just failed (whatever the reason) —
    // drop any cached "SAFE" free-allowance reading for it immediately rather
    // than waiting out the TTL, so the very next candidate-pool build reads a
    // clean cache miss (UNKNOWN → excluded) instead of a stale SAFE. Cheap,
    // idempotent, and correct to over-invalidate on non-quota failures too —
    // worst case is one extra background refresh.
    if (provider) {
      const { invalidateFreeAccessState } =
        await import("@omniroute/open-sse/services/autoCombo/freeAccessQuota.ts");
      invalidateFreeAccessState(provider, connectionId);
    }

    const resourceBypass = getResource404Bypass(status, errorText, connectionId, log);
    if (resourceBypass) return resourceBypass;

    // Read current connection to get backoffLevel
    const connectionsRaw = await getProviderConnections({ provider });
    const connections = (Array.isArray(connectionsRaw) ? connectionsRaw : [])
      .map(toProviderConnection)
      .filter((connection) => connection.id.length > 0);
    const conn = connections.find((connection) => connection.id === connectionId);
    const backoffLevel = conn?.backoffLevel || 0;

    // T06/T10/T36: terminal statuses should not be overwritten by transient cooldown state.
    if (conn && isTerminalConnectionStatus(conn)) {
      log.info(
        "AUTH",
        `${connectionId.slice(0, 8)} terminal status=${conn.testStatus}, skipping cooldown overwrite`
      );
      return { shouldFallback: true, cooldownMs: 0 };
    }

    // ─── Anti-Thundering Herd Guard ─────────────────────────────────
    // If this connection was ALREADY marked unavailable by a prior concurrent
    // request (within the mutex window), skip re-marking to avoid resetting
    // the cooldown timer or double-incrementing the backoff level.
    // Uses cooldownUntilMs (not a raw `new Date()`) because `rate_limited_until`
    // can hold a numeric-epoch string (e.g. the Antigravity full-quota path) —
    // see #3954.
    const existingCooldownMs = conn?.rateLimitedUntil
      ? cooldownUntilMs(conn.rateLimitedUntil)
      : NaN;
    if (Number.isFinite(existingCooldownMs) && existingCooldownMs > Date.now()) {
      log.info(
        "AUTH",
        `${connectionId.slice(0, 8)} already marked unavailable (until ${conn?.rateLimitedUntil}), skipping duplicate mark`
      );
      return {
        shouldFallback: true,
        cooldownMs: existingCooldownMs - Date.now(),
      };
    }

    // T09: Codex scope-aware lockout guard (codex vs spark independent pools).
    if (provider === "codex" && typeof model === "string" && model.trim().length > 0) {
      const scopeRateLimitedUntil = conn ? getCodexChildCooldown(conn, model) : null;
      if (scopeRateLimitedUntil && new Date(scopeRateLimitedUntil).getTime() > Date.now()) {
        log.info(
          "AUTH",
          `${connectionId.slice(0, 8)} already scope-limited for ${getCodexModelScope(model)} (until ${scopeRateLimitedUntil}), skipping duplicate mark`
        );
        return {
          shouldFallback: true,
          cooldownMs: new Date(scopeRateLimitedUntil).getTime() - Date.now(),
        };
      }
    }

    // #10460: model-unsupported 400 — the PROVIDER does not serve this model, not
    // this account. Cooling down the account and rotating to the next one wastes an
    // upstream call because all accounts share the same model catalog. Return
    // shouldFallback: false so the error propagates to the combo layer, which already
    // has isModelScoped400() (combo.ts:1827) to advance to the next combo target.
    // Uses isProviderModelUnsupported400() — the SAME disambiguation
    // (AUTH_CREDENTIAL_ERROR_PATTERNS exclusion) checkFallbackError's 400 branch
    // applies, narrowed further to exclude the broader/ambiguous
    // MODEL_ACCESS_DENIED_PATTERNS access-/permission-phrased matches (e.g. "does not
    // have permission to access this model"), which can be an ACCOUNT-scoped
    // entitlement gap (PRO vs free tier) rather than a provider-wide unsupported
    // model — those must keep rotating to other accounts normally.
    if (isProviderModelUnsupported400(status, errorText)) {
      log.info(
        "AUTH",
        `${connectionId.slice(0, 8)} provider_model_unsupported 400 (${provider}/${model ?? "n/a"}) — skipping account cooldown, letting combo advance`
      );
      return { shouldFallback: false, cooldownMs: 0, reason: "provider_model_unsupported" };
    }

    const effectiveProviderProfile =
      providerProfile || (provider ? await getRuntimeProviderProfile(provider) : null);
    // #4530 follow-up: the combo.ts lockout sites forward the admin-configured
    // maxCooldownMs cap to recordModelLockoutFailure, but the markAccountUnavailable
    // lockout sites (per-model quota, grok-web 403, local 404) never did, so the cap
    // fell back to BACKOFF_CONFIG.max here. Resolve it once and pass it at every site.
    const mlSettings = resolveModelLockoutSettings(await getCachedSettings());
    const fallbackResult = checkFallbackError(
      status,
      errorText,
      backoffLevel,
      model,
      provider,
      options.headers ?? null,
      effectiveProviderProfile,
      null,
      null,
      await resolveDailyResetForProvider(provider)
    );

    // T-PROBE: probe-origin failures (model test-all) must never remove the
    // connection from the pool. Record the failure for visibility but leave
    // ALL routing state untouched — cooldowns, terminal status, per-model
    // lockouts (T09 codex-scope, per-model quota, agentrouter #10334) and
    // auto-disable. Only a real request-path failure deactivates (#9817);
    // the opt-in setting probeCanDisable restores the historical behavior.
    if (await shouldIsolateProbeFailures()) {
      await updateProviderConnection(connectionId, {
        // Persist safe wording only after classification has consumed the raw provider text.
        // backoffLevel is deliberately NOT written: a positive backoff
        // triggers the selection-time auto-decay (resetConnectionBackoff,
        // auth.ts getProviderCredentials) which wipes lastError back to
        // NULL on the next attempt — silently destroying the probe record.
        // The backoff is also routing state a probe must not touch (#9817).
        lastError: sanitizeErrorMessage(errorText) || "Provider request failed",
        lastErrorType: fallbackResult.reason || null,
        errorCode: status,
        lastErrorAt: new Date().toISOString(),
      });
      log.warn(
        "AUTH",
        `[T-PROBE] ${connectionId.slice(0, 8)} ${provider ?? ""} failure ${status} recorded — connection stays in the pool`
      );
      return { shouldFallback: true, cooldownMs: 0 };
    }

    // Read passthroughModels from connection config (user-configured per-model quota)
    const connProviderSpecificData = (conn?.providerSpecificData as Record<string, unknown>) || {};
    if (provider && conn) {
      rehydrateAlibabaFreeDrainedModelLocks(provider, connectionId, connProviderSpecificData);
    }
    const connectionPassthroughModels = connProviderSpecificData.passthroughModels as
      boolean | undefined;
    // #2997: per-connection opt-out of the TRANSIENT connection cooldown. When set,
    // a recoverable failure records lastError/backoff but does NOT cool the
    // connection, so getProviderCredentials keeps selecting it. Terminal states
    // (banned/expired/credits_exhausted) are unaffected — they are resolved below
    // via resolveTerminalConnectionStatus() and still take the connection out.
    // NOTE: this first cut scopes the opt-out to the CONNECTION-level cooldown only;
    // per-model lockout branches (per-model quota 403/404, codex scope) are left
    // as-is — extending disableCooling to model lockout is a follow-up.
    const disableCooling = connProviderSpecificData.disableCooling === true;

    const isPerModelQuotaProvider = hasPerModelQuota(provider, model, connectionPassthroughModels);

    // #10334 — connection-scope branch: the matched provider rule declared scope
    // "connection" for account-wide quota exhaustion (agentrouter "额度不足";
    // exclusive in practice — no opencode-family rule matches 403 today).
    // agentrouter is
    // a passthroughModels provider (isPerModelQuotaProvider === true), so without
    // this branch the next `if` would treat it like any other passthrough 429 and
    // lock a SINGLE model — leaving combo routing to burn one upstream call per
    // remaining model of the same exhausted account. Must run BEFORE that block.
    // Deliberately ignores persistUnavailableState/isCombo: for combo the caller
    // downgrades persistUnavailableState to false, and the generic path further
    // below would then lock per MODEL instead of cooling the connection — exactly
    // what this scope must override. NEVER sets a terminal status: this is a
    // renewing quota window, not "credits_exhausted"/"banned"/"expired".
    //
    // The "never terminal" invariant above is NOT structurally guaranteed by
    // ruleScope === "connection" alone — see isAgentrouterConnectionQuotaScope's
    // doc comment for why (a future permanent-state rule could pair scope
    // "connection" with a non-quota reason). That predicate is the actual guard.
    const ruleScopeIsConnection = isAgentrouterConnectionQuotaScope(provider, fallbackResult);
    // #2997's disableCooling opt-out is respected here (`!disableCooling` below):
    // a connection with disableCooling=true skips this branch entirely and falls
    // into the per-model-quota block further down, which locks the model for up
    // to ~30min (mlSettings.maxCooldownMs) instead of cooling the connection for
    // the rule's shorter transient window. That is a deliberate, if counter-
    // intuitive, consequence of #2997's scope (opt-out was designed only for the
    // CONNECTION-level cooldown, never extended to model lockout) — "opting out
    // of cooldown" ends up producing a LONGER effective block for this one rule.
    // Not addressed here; flagged for a future #2997 follow-up if it proves to be
    // a real operator complaint.
    //
    // HONORS note: since the opencode family joined HONORS, an opencode-family
    // 429 carrying upstream quota headers (x-ratelimit-remaining-*) also lands
    // here with ruleScope "connection" — before the #10880 egress branch below,
    // so sibling cooling is skipped on that path. Latent today: the only
    // request-path caller forwarding headers is chat.ts:2383 (chat completions),
    // and opencode upstreams rarely send those headers on 429 (the observed
    // envelope is the headers-less "monthly usage limit" body, which keeps
    // flowing to the egress block with ruleScope undefined).
    if (ruleScopeIsConnection && provider && !disableCooling) {
      const connectionCooldownMs =
        fallbackResult.cooldownMs > 0 ? fallbackResult.cooldownMs : COOLDOWN_MS.rateLimit;
      await updateProviderConnection(connectionId, {
        lastErrorType: fallbackResult.reason || RateLimitReason.QUOTA_EXHAUSTED,
        lastError: `Account quota exhausted (${provider})`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
        backoffLevel: fallbackResult.newBackoffLevel ?? backoffLevel,
        rateLimitedUntil: getUnavailableUntil(connectionCooldownMs),
        testStatus: "unavailable",
      });
      log.info(
        "AUTH",
        `Connection-scoped cooldown for ${provider}:${connectionId.slice(0, 8)} — ${status} ${fallbackResult.reason} ${Math.ceil(connectionCooldownMs / 1000)}s (rule scope=connection, overrides per-model lockout)`
      );
      return { shouldFallback: true, cooldownMs: connectionCooldownMs };
    }

    // #10880 — egress-bucketed providers: the upstream quota is per EGRESS IP,
    // not per account (the opencode free tier is IP-bucketed, not
    // account-bucketed — see #9611). When such a provider confirms a status
    // 429 classified quota_exhausted OR rate_limit_exceeded, every
    // allowlisted-family connection egressing through the same IP shares the
    // exhausted budget — cool them all down BEFORE they are tried, so the
    // rotation does not burn one guaranteed-failed upstream call per sibling
    // (same N-1 shape as #10460/#10525). Must run AFTER the agentrouter branch
    // (that one owns connection-scoped rules) and BEFORE the per-model block.
    // NEVER sets a terminal status: a renewing quota window, not
    // credits_exhausted/banned/expired. Best-effort: if the connection's last
    // known egress IP cannot be resolved (cold cache), behavior is unchanged.
    //
    // The status===429 gate keeps the documented "a 429 classified…" scope:
    // a 402/403 (status_402/status_403 → quota_exhausted) or a 400/500 with
    // quota/rate-limit text is an ACCOUNT-scoped signal and must not cool the
    // IP family.
    //
    // Deliberately ignores persistUnavailableState/isCombo, exactly like the
    // agentrouter branch above and for the same reason: for combo the caller
    // downgrades persistUnavailableState to false, and the generic path below
    // would then lock per MODEL instead of cooling the connection — which says
    // nothing about the exhausted IP, so the combo rotation would keep burning
    // one guaranteed-failed call per sibling. A per-model lockout is not a
    // weaker form of this scope, it is the wrong unit.
    //
    // RATE_LIMIT_EXCEEDED is deliberately included: markAccountUnavailable
    // never passes headers/structuredError to checkFallbackError and opencode
    // is not in FULL_TEXT_RULE_PROVIDERS, so the opencode-specific rules
    // (body reset hint / x-ratelimit-remaining-requests) never match on this
    // path — the real opencode 429 ("monthly usage limit reached") is
    // intercepted by the subscription-quota text fallback
    // (quotaTextCooldowns.ts, quota_exhausted 1h); allowlisted siblings with
    // quota-text-free envelopes (e.g. "rate limit reached") land on
    // status_429 -> rate_limit_exceeded. For an allowlisted provider an
    // IP-bucketed rate limit is the same signal as an exhausted quota.
    const egressBucketed = isEgressBucketedLockScope(provider);
    if (
      status === 429 &&
      egressBucketed &&
      (fallbackResult.reason === RateLimitReason.QUOTA_EXHAUSTED ||
        fallbackResult.reason === RateLimitReason.RATE_LIMIT_EXCEEDED) &&
      !fallbackResult.permanent &&
      !fallbackResult.creditsExhausted &&
      !disableCooling
    ) {
      const connectionCooldownMs =
        fallbackResult.cooldownMs > 0 ? fallbackResult.cooldownMs : COOLDOWN_MS.rateLimit;
      // CRITICAL: mark the failing connection C HERE, mirroring the
      // connection-scoped agentrouter branch just above. The branch returns
      // right after, so neither the per-model quota block below (opencode is
      // passthroughModels:true — it would call recordModelLockoutFailure
      // instead) nor the generic persistence path at the end of the function
      // is ever reached. Without this write, C stays "active" → retried next
      // episode (1 wasted call/episode) and backoffLevel/lastError never set.
      await updateProviderConnection(connectionId, {
        lastErrorType: fallbackResult.reason || RateLimitReason.QUOTA_EXHAUSTED,
        lastError: `Shared egress IP quota exhausted (${provider})`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
        backoffLevel: fallbackResult.newBackoffLevel ?? backoffLevel,
        rateLimitedUntil: getUnavailableUntil(connectionCooldownMs),
        testStatus: "unavailable",
      });
      await applyEgressIpLockout(
        connectionId,
        provider!,
        connectionCooldownMs,
        fallbackResult.reason
      );
      return { shouldFallback: true, cooldownMs: connectionCooldownMs };
    }

    const isNvidiaModelGone = provider === "nvidia" && status === 410;
    const modelLockoutOptions = { maxCooldownMs: effectiveProviderProfile?.maxCooldownMs };
    // Same persisted reason the agentrouter 403 model-scope branch hard-codes
    // ("forbidden"): the lock key is the getModelLockKey tuple shared with the
    // combo path, and the declared 1h (same order as that combo lock) is
    // operator-clamped by recordModelLockoutFailure to mlSettings.maxCooldownMs
    // (~30min default) — the verbatim 1h never escapes operator control.
    // Narrow scope: status === 400 only (never a 403/429 rule), adjacent to
    // :2843's per-model-quota status set (which excludes 400) — malformed 400s
    // carry no ruleScope and fall through unchanged.
    if (model && provider && status === 400 && fallbackResult.ruleScope === "model") {
      // Single source of truth: the rule's own cooldownMs (surfaced on
      // fallbackResult by the 400 pre-check in checkFallbackError). The literal
      // is only the fallback for a rule that declares no cooldown — editing
      // the rule's cooldownMs takes effect without touching this call site.
      const ruleCooldownMs =
        typeof fallbackResult.cooldownMs === "number" && fallbackResult.cooldownMs > 0
          ? fallbackResult.cooldownMs
          : 3_600_000;
      const lockout = recordModelLockoutFailure(
        provider,
        connectionId,
        model,
        "model_capacity",
        400,
        ruleCooldownMs,
        effectiveProviderProfile,
        { exactCooldownMs: ruleCooldownMs, maxCooldownMs: mlSettings.maxCooldownMs }
      );
      updateProviderConnection(connectionId, {
        lastErrorType: "model_capacity",
        lastError: `Model ${model} model_capacity`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch(() => {});
      log.info(
        "AUTH",
        `Model-only lockout for ${provider}:${model} — ${status} model_capacity ${Math.ceil(lockout.cooldownMs / 1000)}s (rule scope=model, connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: lockout.cooldownMs };
    }
    if (
      isPerModelQuotaProvider &&
      provider &&
      provider !== "codex" &&
      model &&
      (status === 404 || isNvidiaModelGone || status === 429 || status >= 500)
    ) {
      const reason =
        status === 404 || isNvidiaModelGone
          ? "not_found"
          : status === 429 && fallbackResult.reason === RateLimitReason.QUOTA_EXHAUSTED
            ? "quota_exhausted"
            : status === 429
              ? "rate_limited"
              : "server_error";

      // #5976: a bare 500 is intermittent and NOT model-specific — skip
      // lockout/cooldown ONLY for the exact 500 (the contract its own tests pin:
      // combo-provider-cooldown-sibling.test.ts — "Gemini 503 should NOT skip
      // cooldown"). 502/503/504 keep the pre-#6216 model-lockout path: cooldownMs
      // 0 hot-loops the failing upstream (broke resilience-http-e2e on the PR).
      if (status === 500) {
        updateProviderConnection(connectionId, {
          lastErrorType: reason,
          lastError: `Model ${model} ${reason}`,
          lastErrorAt: new Date().toISOString(),
          errorCode: status,
        }).catch(() => {});
        log.info(
          "AUTH",
          `Server error for ${provider}:${model} — ${status} ${reason} (no model lockout, connection stays active for sibling models)`,
          {
            ...(options.correlationId ? { correlationId: options.correlationId } : {}),
          }
        );
        return { shouldFallback: true, cooldownMs: 0 };
      }

      const usesExactAntigravityLock = provider === "antigravity";
      const quotaScope = usesExactAntigravityLock
        ? "model"
        : getQuotaScopeLabelForProvider(provider, model);
      const antigravityFamilyInferredBaseCooldownMs =
        !usesExactAntigravityLock &&
        provider === "antigravity" &&
        quotaScope === "family" &&
        status === 429
          ? ANTIGRAVITY_FAMILY_INFERRED_BASE_COOLDOWN_MS
          : null;
      const lockout = recordModelLockoutFailure(
        provider,
        connectionId,
        model,
        reason,
        status,
        status === 404 || isNvidiaModelGone
          ? (effectiveProviderProfile?.baseCooldownMs ?? COOLDOWN_MS.notFoundLocal)
          : (antigravityFamilyInferredBaseCooldownMs ??
              fallbackResult.baseCooldownMs ??
              effectiveProviderProfile?.baseCooldownMs ??
              0),
        effectiveProviderProfile,
        {
          ...modelLockoutOptions,
          exactCooldownMs:
            fallbackResult.usedUpstreamRetryHint === true
              ? fallbackResult.cooldownMs
              : (fallbackResult.quotaResetHintMs ?? null),
          maxCooldownMs: mlSettings.maxCooldownMs,
          scope: usesExactAntigravityLock ? "exact" : undefined,
          // Only a transport header or google.rpc.RetryInfo can bypass maxCooldownMs.
          // Prose and generic JSON hints remain exact but operator-capped.
          exactCooldownIsUpstreamReset: retryHintBypassesMaxCooldownMs(
            fallbackResult.retryHintSource
          ),
        }
      );
      // Update last error for observability (without changing terminal status)
      updateProviderConnection(connectionId, {
        lastErrorType: reason,
        lastError: `Model ${model} ${reason}`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch(() => {});
      log.info(
        "AUTH",
        `Model-only lockout for ${provider}:${model} — ${status} ${reason} ${Math.ceil(lockout.cooldownMs / 1000)}s (failureCount=${lockout.failureCount}, connection stays active)`
      );
      persistAntigravityFamilyCooldownIfQuota({
        provider,
        connectionId,
        model,
        cooldownMs: lockout.cooldownMs,
        reason,
      });
      return { shouldFallback: true, cooldownMs: lockout.cooldownMs };
    }
    const result = fallbackResult;
    if (isSharedWalletCredits402(provider, status, errorText)) {
      result.creditsExhausted = true;
      result.reason = result.reason || RateLimitReason.QUOTA_EXHAUSTED;
      result.shouldFallback = true;
    }
    const { shouldFallback, cooldownMs: rawCooldownMs, newBackoffLevel, reason } = result;
    if (!shouldFallback) return { shouldFallback: false, cooldownMs: 0 };
    const providerErrorType = classifyProviderError(status, errorText, provider);

    if (
      isAlibabaModelStudioProvider(provider) &&
      status === 403 &&
      model &&
      isAlibabaFreeQuotaExhaustedError(errorText)
    ) {
      const billingMode = getAlibabaBillingMode(connProviderSpecificData);
      if (billingMode === "free") {
        const persistedProviderSpecificData = mergeAlibabaFreeDrainedModels(
          connProviderSpecificData,
          model
        );
        await updateProviderConnection(connectionId, {
          providerSpecificData: persistedProviderSpecificData,
          lastErrorType: "free_quota_exhausted",
          lastError: `Model ${model} free quota exhausted`,
          lastErrorAt: new Date().toISOString(),
          errorCode: status,
        });
        rehydrateAlibabaFreeDrainedModelLocks(
          provider!,
          connectionId,
          persistedProviderSpecificData
        );
        recordModelLockoutFailure(
          provider!,
          connectionId,
          model!,
          "free_quota_exhausted",
          status,
          0,
          effectiveProviderProfile,
          {
            exactCooldownMs: ALIBABA_FREE_DRAINED_LOCK_MS,
            maxCooldownMs: ALIBABA_FREE_DRAINED_LOCK_MS,
          }
        );
        log.info(
          "AUTH",
          `Alibaba free-tier drain for ${provider}:${model} — model permanently removed from routing (billingMode=free)`
        );
        return { shouldFallback: true, cooldownMs: 0 };
      }
    }

    if (provider && resolveProviderId(provider) === "grok-web" && status === 403 && model) {
      const lockout = recordModelLockoutFailure(
        provider,
        connectionId,
        model,
        "forbidden",
        status,
        effectiveProviderProfile?.baseCooldownMs ?? COOLDOWN_MS.serviceUnavailable,
        effectiveProviderProfile,
        { maxCooldownMs: mlSettings.maxCooldownMs }
      );
      updateProviderConnection(connectionId, {
        lastErrorType: "forbidden",
        lastError: `Mode ${model} forbidden for this Grok account`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch(() => {});
      log.info(
        "AUTH",
        `Mode-only lockout for ${provider}:${model} — 403 forbidden ${Math.ceil(lockout.cooldownMs / 1000)}s (connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: lockout.cooldownMs };
    }

    let terminalStatus = resolveTerminalConnectionStatus(
      status,
      result as { permanent?: boolean; creditsExhausted?: boolean },
      providerErrorType,
      provider,
      isPerModelQuotaProvider,
      errorText
    );
    // A still-valid access token after a successful refresh is not "expired".
    // A follow-up 401 (timeout, hop, race) must cooldown, not park the account.
    const tokenExpiryMs = Date.parse(String(conn?.tokenExpiresAt || conn?.expiresAt || ""));
    if (
      terminalStatus === "expired" &&
      Number.isFinite(tokenExpiryMs) &&
      tokenExpiryMs > Date.now() + 60_000
    ) {
      terminalStatus = null;
    }
    const cachedQuotaResetAt =
      providerErrorType === PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED ||
      reason === RateLimitReason.QUOTA_EXHAUSTED
        ? getCachedQuotaResetAt(connectionId)
        : null;
    const cachedQuotaResetMs = parseFutureDateMs(cachedQuotaResetAt);
    const cooldownMs = terminalStatus
      ? 0
      : cachedQuotaResetMs
        ? cachedQuotaResetMs - Date.now()
        : rawCooldownMs;

    // ── #3027 / #12242 (402 variant): per-model subscription (403) or
    // per-model billing (402) error on a passthrough/gateway provider →
    // model-only lockout, connection stays active. A 402 here is a specific
    // model needing credit, not a dead credential — sibling (e.g. free)
    // models on the same connection remain usable and must not be knocked
    // out. Deliberately excludes single-credential providers, where a 402
    // genuinely does mean the key is out of credit (see #5239 / #10616) —
    // isPerModelQuotaProvider is false there, so this branch never fires and
    // the connection-wide credits_exhausted path above still applies.
    if (
      isPerModelQuotaProvider &&
      (status === 403 || status === 402) &&
      provider &&
      model &&
      !terminalStatus &&
      !isSharedWalletCredits402(provider, status, errorText) &&
      !(provider === "vertex" && isVertexConnectionWidePermissionDenied(errorText))
    ) {
      const lockoutReason = status === 402 ? "credits" : "forbidden";
      const lockout = recordModelLockoutFailure(
        provider,
        connectionId,
        model,
        lockoutReason,
        status,
        fallbackResult.baseCooldownMs ??
          effectiveProviderProfile?.baseCooldownMs ??
          COOLDOWN_MS.serviceUnavailable,
        effectiveProviderProfile,
        {
          ...modelLockoutOptions,
          exactCooldownMs:
            fallbackResult.usedUpstreamRetryHint === true ? fallbackResult.cooldownMs : null,
          maxCooldownMs: mlSettings.maxCooldownMs,
        }
      );
      updateProviderConnection(connectionId, {
        lastErrorType: lockoutReason,
        lastError:
          status === 402
            ? `Model ${model} out of credits (per-model billing)`
            : `Model ${model} forbidden (per-model access/subscription)`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch(() => {});
      log.info(
        "AUTH",
        `Model-only lockout for ${provider}:${model} — ${status} ${lockoutReason} ${Math.ceil(lockout.cooldownMs / 1000)}s (per-model quota provider, connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: lockout.cooldownMs };
    }

    // ── 404 model-only lockout: connection stays active ──
    // For local providers (detected by URL), a 404 means the specific model
    // doesn't exist or isn't available for this account — it should NOT lock
    // out the entire connection.
    const connBaseUrl = (conn?.providerSpecificData as Record<string, unknown>)?.baseUrl as
      string | undefined;

    if (isLocalProvider(connBaseUrl) && status === 404 && provider && model) {
      const lockout = recordModelLockoutFailure(
        provider,
        connectionId,
        model,
        "not_found",
        status,
        status === 404
          ? (effectiveProviderProfile?.baseCooldownMs ?? COOLDOWN_MS.notFoundLocal)
          : COOLDOWN_MS.notFoundLocal,
        effectiveProviderProfile,
        { maxCooldownMs: mlSettings.maxCooldownMs }
      );
      updateProviderConnection(connectionId, {
        lastErrorType: "not_found",
        lastError: `Model ${model} not_found`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch(() => {});
      log.info(
        "AUTH",
        `Model-only lockout for ${provider}:${model} — 404 not_found ${Math.ceil(lockout.cooldownMs / 1000)}s (failureCount=${lockout.failureCount}, connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: lockout.cooldownMs };
    }
    const errorMsg =
      sanitizeErrorMessage(describeUpstreamFailure(errorText)) || "Provider request failed";

    // T09: Codex per-scope lockout (do not block the whole account globally).
    if (
      provider === "codex" &&
      status === 429 &&
      typeof model === "string" &&
      model.trim().length > 0 &&
      conn
    ) {
      const scope = getCodexModelScope(model);
      const scopeRateLimitedUntil =
        getCodexChildCooldown(conn, model) || getUnavailableUntil(cooldownMs);
      const scopeCooldownMs = Math.max(new Date(scopeRateLimitedUntil).getTime() - Date.now(), 0);

      await persistCodexChildCooldown({
        connectionId,
        model,
        rateLimitedUntil: scopeRateLimitedUntil,
      });

      if (scopeCooldownMs > 0) {
        lockModel(provider, connectionId, model, reason || "unknown", scopeCooldownMs);
      }

      if (status && errorMsg) {
        console.error(`❌ ${provider} [${status}] (${scope}): ${errorMsg}`);
      }

      return { shouldFallback: true, cooldownMs: scopeCooldownMs };
    }

    // A Codex quota response without a model cannot be assigned to either virtual child.
    // Preserve failover without inventing a third parent-level quota/cooldown state.
    if (provider === "codex" && status === 429) {
      return { shouldFallback: true, cooldownMs };
    }

    const baseUpdate = {
      lastError: errorMsg,
      lastErrorType: providerErrorType,
      errorCode: status,
      lastErrorAt: new Date().toISOString(),
      backoffLevel: newBackoffLevel ?? backoffLevel,
    };
    const persistUnavailableState = options.persistUnavailableState !== false;

    if (!persistUnavailableState) {
      // Combo-managed transient failure (e.g. 429): keep the connection clean in
      // the DB, but record an in-memory model lockout so credential selection
      // skips this exact provider+connection+model while it cools down — other
      // models on the same connection stay usable.
      if (
        provider &&
        model &&
        cooldownMs > 0 &&
        !isSharedWalletCredits402(provider, status, errorText)
      ) {
        lockModel(provider, connectionId, model, reason || "unknown", cooldownMs);
      }
      await updateProviderConnection(connectionId, {
        ...baseUpdate,
      });
    } else if (cooldownMs > 0 && !disableCooling) {
      await updateProviderConnection(connectionId, {
        ...baseUpdate,
        rateLimitedUntil: getUnavailableUntil(cooldownMs),
        testStatus: "unavailable",
      });
    } else {
      await updateProviderConnection(connectionId, {
        ...baseUpdate,
        rateLimitedUntil: null,
        ...(terminalStatus ? { testStatus: terminalStatus } : {}),
      });
    }

    // T-AUTODISABLE: permanent bans disable immediately when the setting allows it.
    await maybeAutoDisableBannedAccount({
      connectionId,
      provider,
      authType: conn?.authType,
      connectionProvider: conn?.provider,
      permanent: Boolean((result as { permanent?: boolean }).permanent),
    });

    if (provider && status && errorMsg) {
      console.error(`❌ ${provider} [${status}]: ${errorMsg}`);
    }

    return { shouldFallback: true, cooldownMs };
  } finally {
    if (resolveMutex) resolveMutex();
    // Cleanup stale mutex entries (avoid memory leak)
    markMutexes.delete(connectionId);
  }
}

/**
 * Clear account error status (only if currently has error)
 * Optimized to avoid unnecessary DB updates
 */
export async function clearAccountError(
  connectionId: string,
  currentConnection: Partial<RecoverableConnectionState>
) {
  // Only update if currently has error status
  const hasError =
    (currentConnection.testStatus && currentConnection.testStatus !== "active") ||
    currentConnection.lastError ||
    currentConnection.rateLimitedUntil ||
    currentConnection.errorCode ||
    currentConnection.lastErrorType ||
    currentConnection.lastErrorSource;

  if (!hasError) return; // Skip if already clean

  await updateProviderConnection(connectionId, {
    testStatus: "active",
    lastError: null,
    lastErrorAt: null,
    lastErrorType: null,
    lastErrorSource: null,
    errorCode: null,
    rateLimitedUntil: null,
    backoffLevel: 0,
  });
  log.info("AUTH", `Account ${connectionId.slice(0, 8)} error cleared`);
}

/**
 * Optional CAS token. When provided, clearConnectionErrorIfUnchanged atomically
 * aborts if another path modified the row after the caller's snapshot.
 * This closes the TOCTOU window; omission preserves unconditional clearing.
 */
export interface RecoveredStateExpectation {
  testStatus: string | null;
  lastErrorAt: string | null;
  rateLimitedUntil: string | null;
}
export async function clearRecoveredProviderState(
  credentials: unknown,
  expectedState?: RecoveredStateExpectation
): Promise<{ applied: boolean }> {
  const recoverable = credentials as Partial<RecoverableConnectionState> | null;
  if (typeof recoverable?.connectionId !== "string" || !recoverable.connectionId)
    return { applied: false };
  if (expectedState) {
    const applied = await clearConnectionErrorIfUnchanged(recoverable.connectionId, expectedState);
    if (!applied) {
      log.info(
        "AUTH",
        `Skipped recovery clear for ${recoverable.connectionId.slice(0, 8)} — state changed concurrently (CAS miss)`
      );
      return { applied: false };
    }
    log.info("AUTH", `Account ${recoverable.connectionId.slice(0, 8)} error cleared (CAS)`);
    return { applied: true };
  }
  await clearAccountError(recoverable.connectionId, recoverable);
  return { applied: true };
}
