/**
 * Quota policy types, credential selection options, and quota evaluation helpers.
 *
 * Extracted from auth.ts for modularity. The barrel re-exports from auth.ts
 * preserve all existing import paths.
 */
import {
  DEFAULT_QUOTA_THRESHOLD_PERCENT,
  getQuotaWindowStatus,
  getQuotaCache,
} from "@/domain/quotaCache";
import { toNumber } from "@/shared/utils/numeric";
import {
  toCodexBaseQuotaWindowName,
  toCodexScopedQuotaWindowName,
  getCodexQuotaWindowFilterForModel,
} from "@omniroute/open-sse/config/codexQuotaScopes.ts";
import { formatQuotaUsageReason } from "@omniroute/open-sse/services/quotaWindowLabel.ts";
import { isClaudeExtraUsageAllowed } from "@/lib/providers/claudeExtraUsage";
import { cooldownUntilMs } from "@omniroute/open-sse/services/accountFallback.ts";
import { type CredentialLeaseSelectionContext } from "./exclusiveConnectionLeasePolicy";

// ──────────────────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────────────────

export type JsonRecord = Record<string, unknown>;

export interface CredentialSelectionOptions {
  allowSuppressedConnections?: boolean;
  allowRateLimitedConnections?: boolean;
  bypassQuotaPolicy?: boolean;
  forcedConnectionId?: string | null;
  excludeConnectionIds?: string[] | null;
  sessionKey?: string | null;
  sessionAffinityTtlMs?: number | null;
  reserveOAuthSession?: boolean;
  lease?: CredentialLeaseSelectionContext;
  materializeCredentials?: boolean;
  deferLeaseClaim?: boolean;
  /** Internal: a same-call UNIQUE retry already holds the provider/owner selection lock. */
  _leaseRetryWithLockHeld?: boolean;
  /** Internal: freeze the original policy-valid candidate set across lease race/preflight retry. */
  _leaseCandidateIds?: string[];
}

export type ExclusiveLeaseSelectionResult = {
  exclusiveLease: import("@/lib/db/exclusiveConnectionLeases").ExclusiveConnectionLease;
  connectionId: string;
  provider: string;
};

// ──────────────────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────────────────

export interface QuotaLimitPolicy {
  enabled: boolean;
  thresholdPercent: number;
  windows: string[];
}

interface QuotaCacheView {
  quotas?: Record<
    string,
    {
      remainingPercentage?: number;
      resetAt?: string | null;
    }
  >;
}

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const MIN_QUOTA_THRESHOLD_PERCENT = 1;
const MAX_QUOTA_THRESHOLD_PERCENT = 100;

// ──────────────────────────────────────────────────────────
// Primitive helpers
// ──────────────────────────────────────────────────────────

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function toBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// ──────────────────────────────────────────────────────────
// Window / threshold normalization
// ──────────────────────────────────────────────────────────

export function normalizeQuotaThreshold(
  value: unknown,
  fallback = DEFAULT_QUOTA_THRESHOLD_PERCENT
): number {
  const parsed = toNumber(value, fallback);
  return Math.min(MAX_QUOTA_THRESHOLD_PERCENT, Math.max(MIN_QUOTA_THRESHOLD_PERCENT, parsed));
}

export function normalizeWindowName(windowName: unknown): string | null {
  if (typeof windowName !== "string") return null;
  const normalized = windowName.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function uniqueWindows(windows: string[]): string[] {
  return [...new Set(windows)];
}

export function normalizeStatus(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

// Antigravity Gemini family 429 with no parseable upstream hint: seed the backoff at
// this base. Real upstream Retry-After hints still win -- they flow through
// `exactCooldownMs` (usedUpstreamRetryHint), not this base. (#5222)
export const ANTIGRAVITY_FAMILY_INFERRED_BASE_COOLDOWN_MS = 30_000;

export interface IsTerminalConnectionStatusLike {
  testStatus?: string | null;
}

export function isTerminalConnectionStatus(connection: IsTerminalConnectionStatusLike): boolean {
  const status = normalizeStatus(connection.testStatus ?? null);
  return status === "credits_exhausted" || status === "banned" || status === "expired";
}

// ──────────────────────────────────────────────────────────
// Codex-specific window policy
// ──────────────────────────────────────────────────────────

function getCodexLimitPolicy(providerSpecificData: JsonRecord): {
  use5h: boolean;
  useWeekly: boolean;
} {
  const policy = asRecord(providerSpecificData.codexLimitPolicy);
  return {
    use5h: toBooleanOrDefault(policy.use5h, true),
    useWeekly: toBooleanOrDefault(policy.useWeekly, true),
  };
}

function normalizeCodexWindowName(windowName: unknown): string | null {
  if (typeof windowName !== "string") return null;
  const normalized = windowName.trim().toLowerCase();
  if (normalized === "session (5h)" || normalized === "5h" || normalized === "five_hour") {
    return "session";
  }
  if (normalized === "weekly (7d)" || normalized === "7d" || normalized === "seven_day") {
    return "weekly";
  }
  return toCodexBaseQuotaWindowName(normalized);
}

export function applyCodexWindowPolicy(
  rawWindows: string[],
  providerSpecificData: JsonRecord
): string[] {
  const codexPolicy = getCodexLimitPolicy(providerSpecificData);
  const normalizedRaw = rawWindows.map(normalizeCodexWindowName).filter(Boolean) as string[];

  // Preserve explicitly configured custom windows, but enforce canonical Codex windows
  // from toggles so weekly exhaustion is never skipped when useWeekly=true.
  let windows = [...normalizedRaw];
  windows = windows.filter((windowName) => {
    if (windowName === "session") return codexPolicy.use5h;
    if (windowName === "weekly") return codexPolicy.useWeekly;
    return true;
  });
  if (codexPolicy.use5h) windows.push("session");
  if (codexPolicy.useWeekly) windows.push("weekly");

  return uniqueWindows(windows);
}

// ──────────────────────────────────────────────────────────
// Quota policy resolution + evaluation
// ──────────────────────────────────────────────────────────

export function resolveQuotaLimitPolicy(
  provider: string,
  providerSpecificData: JsonRecord
): QuotaLimitPolicy {
  const rawPolicy = asRecord(providerSpecificData.limitPolicy);
  const rawWindows = Array.isArray(rawPolicy.windows) ? rawPolicy.windows : [];
  const windows = rawWindows.map(normalizeWindowName).filter(Boolean) as string[];

  if (provider === "codex") {
    const defaultWindows = applyCodexWindowPolicy(windows, providerSpecificData);
    const enabled = toBooleanOrDefault(rawPolicy.enabled, defaultWindows.length > 0);

    return {
      enabled,
      thresholdPercent: normalizeQuotaThreshold(rawPolicy.thresholdPercent),
      windows: defaultWindows,
    };
  }

  return {
    enabled: toBooleanOrDefault(rawPolicy.enabled, false),
    thresholdPercent: normalizeQuotaThreshold(rawPolicy.thresholdPercent),
    windows,
  };
}

export function evaluateQuotaLimitPolicy(
  provider: string,
  connection: { id: string; testStatus?: string | null; providerSpecificData?: unknown },
  requestedModel: string | null = null
): { blocked: boolean; reasons: string[]; resetAt: string | null } {
  // Extra-usage switch is opt-in billing, not a pre-dispatch skip. When the
  // operator allows extra usage, 5h/weekly bars must not hide the account.
  if (isClaudeExtraUsageAllowed(provider, connection.providerSpecificData)) {
    return { blocked: false, reasons: [], resetAt: null };
  }
  const policy = resolveQuotaLimitPolicy(provider, connection.providerSpecificData as JsonRecord);
  if (!policy.enabled || policy.windows.length === 0) {
    return { blocked: false, reasons: [], resetAt: null };
  }

  const reasons: string[] = [];
  const resetCandidates: Array<string | null> = [];

  for (const windowName of policy.windows) {
    const effectiveWindowName =
      provider === "codex" ? toCodexScopedQuotaWindowName(windowName, requestedModel) : windowName;
    const status = getQuotaWindowStatus(
      connection.id,
      effectiveWindowName,
      policy.thresholdPercent
    );
    if (!status?.reachedThreshold) continue;
    reasons.push(
      formatQuotaUsageReason(
        {
          key: effectiveWindowName,
          displayName: status.displayName,
          windowSeconds: status.windowSeconds,
        },
        status.usedPercentage
      )
    );
    resetCandidates.push(status.resetAt);
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    resetAt: getEarliestFutureDate(resetCandidates),
  };
}

// ──────────────────────────────────────────────────────────
// Date / cooldown helpers
// ──────────────────────────────────────────────────────────

export function parseFutureDateMs(value: string | null): number | null {
  if (!value) return null;
  // Tolerate numeric-epoch strings (e.g. "1781696905131.0") as well as ISO
  // strings -- the rate_limited_until TEXT column can hold either (#3954).
  const ms = cooldownUntilMs(value);
  if (!Number.isFinite(ms) || ms <= Date.now()) return null;
  return ms;
}

export function getEarliestFutureDate(candidates: Array<string | null>): string | null {
  return (
    candidates
      .map((candidate) => ({
        raw: candidate,
        ms: parseFutureDateMs(candidate),
      }))
      .filter((entry) => entry.ms !== null)
      .sort((a, b) => (a.ms as number) - (b.ms as number))[0]?.raw || null
  );
}

export function getCachedQuotaResetAt(connectionId: string): string | null {
  const entry = getQuotaCache(connectionId);
  if (!entry?.quotas) return null;
  return getEarliestFutureDate(Object.values(entry.quotas).map((quota) => quota.resetAt));
}

// ──────────────────────────────────────────────────────────
// Quota headroom helpers (for P2C scoring)
// ──────────────────────────────────────────────────────────

const NON_RETRYABLE_MODEL_LOCKOUT_REASONS = new Set(["not_found", "not_found_local"]);

export function isRetryableModelLockoutReason(reason: unknown): boolean {
  return typeof reason === "string" && reason.length > 0
    ? !NON_RETRYABLE_MODEL_LOCKOUT_REASONS.has(reason)
    : false;
}

export function pushClampedPercentage(percentages: number[], value: number): void {
  if (Number.isFinite(value)) {
    percentages.push(Math.max(0, Math.min(100, value)));
  }
}

export function isResetAtInPast(resetAt: string | null): boolean {
  if (!resetAt) return false;
  const resetMs = new Date(resetAt).getTime();
  return Number.isFinite(resetMs) && resetMs <= Date.now();
}

export function collectPolicyQuotaHeadroomPercentages(
  provider: string,
  connection: { id: string; providerSpecificData?: unknown },
  policy: QuotaLimitPolicy,
  requestedModel: string | null
): number[] {
  const percentages: number[] = [];
  const seenWindows = new Set<string>();

  for (const windowName of policy.windows) {
    const scopedWindow =
      provider === "codex" ? toCodexScopedQuotaWindowName(windowName, requestedModel) : windowName;
    const normalizedWindow = normalizeWindowName(scopedWindow);
    if (!normalizedWindow || seenWindows.has(normalizedWindow)) continue;
    seenWindows.add(normalizedWindow);

    const status = getQuotaWindowStatus(connection.id, normalizedWindow, policy.thresholdPercent);
    if (status) pushClampedPercentage(percentages, status.remainingPercentage);
  }

  return percentages;
}

export function collectCachedQuotaHeadroomPercentages(
  provider: string,
  connection: { id: string; providerSpecificData?: unknown },
  requestedModel: string | null
): number[] {
  const quotaEntry = getQuotaCache(connection.id) as QuotaCacheView | null;
  const rawQuotas = quotaEntry?.quotas || {};
  const codexWindowFilter =
    provider === "codex" ? getCodexQuotaWindowFilterForModel(requestedModel) : undefined;
  const percentages: number[] = [];

  for (const [quotaName, quota] of Object.entries(rawQuotas)) {
    if (codexWindowFilter && !codexWindowFilter(quotaName)) continue;
    if (!quota || isResetAtInPast(toStringOrNull(quota.resetAt))) continue;
    pushClampedPercentage(percentages, toNumber(quota.remainingPercentage, Number.NaN));
  }

  return percentages;
}

export function getConnectionQuotaHeadroomPercent(
  provider: string,
  connection: { id: string; providerSpecificData?: unknown },
  requestedModel: string | null = null
): number | null {
  const policy = resolveQuotaLimitPolicy(provider, connection.providerSpecificData as JsonRecord);
  const policyPercentages = collectPolicyQuotaHeadroomPercentages(
    provider,
    connection,
    policy,
    requestedModel
  );
  const percentages =
    policyPercentages.length > 0
      ? policyPercentages
      : collectCachedQuotaHeadroomPercentages(provider, connection, requestedModel);

  return percentages.length > 0 ? Math.min(...percentages) : null;
}

// ──────────────────────────────────────────────────────────
// P2C scoring helpers (used by getP2CConnectionScore in auth.ts)
// ──────────────────────────────────────────────────────────

export interface P2CConnectionLike {
  id: string;
  provider?: string | null;
  lastError?: string | null;
  lastErrorType?: string | null;
  lastErrorSource?: string | null;
  errorCode?: string | number | null;
  backoffLevel?: number | null;
  consecutiveUseCount?: number | null;
  priority?: number | null;
  lastUsedAt?: string | null;
  providerSpecificData?: unknown;
}

export function getConnectionErrorPenalty(connection: P2CConnectionLike): number {
  const errorType = normalizeStatus(connection.lastErrorType ?? null);
  const errorSource = normalizeStatus(connection.lastErrorSource ?? null);
  const numericErrorCode = toNumber(connection.errorCode, 0);

  let penalty = 0;
  if (connection.lastError) penalty += 6;

  if (
    errorType === "rate_limited" ||
    errorType === "quota_exhausted" ||
    errorType === "quota" ||
    numericErrorCode === 429
  ) {
    penalty += 24;
  } else if (numericErrorCode === 401 || numericErrorCode === 403 || errorSource === "oauth") {
    penalty += 18;
  } else if (numericErrorCode >= 500) {
    penalty += 10;
  }

  return penalty;
}

export function getConnectionRecencyPenalty(connection: P2CConnectionLike): number {
  if (!connection.lastUsedAt) return 0;
  const ageMs = Date.now() - new Date(connection.lastUsedAt).getTime();
  if (!Number.isFinite(ageMs)) return 0;
  if (ageMs < 15_000) return 3;
  if (ageMs < 60_000) return 2;
  if (ageMs < 5 * 60_000) return 1;
  return 0;
}
