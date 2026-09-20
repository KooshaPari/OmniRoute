/**
 * authQuota.ts — Quota limit policy evaluation and P2C connection scoring.
 *
 * Extracted from auth.ts (F-01 decomposition). Pure-computation helpers for
 * quota window normalization, headroom calculation, and power-of-two-choices
 * connection scoring. No DB writes; reads from in-memory quota caches.
 *
 * Public API:
 *   resolveQuotaLimitPolicy(provider, providerSpecificData)
 *   evaluateQuotaLimitPolicy(provider, connection, requestedModel?)
 */

import { toNumber } from "@/shared/utils/numeric";
import { isClaudeExtraUsageAllowed } from "@/lib/providers/claudeExtraUsage";
import {
  DEFAULT_QUOTA_THRESHOLD_PERCENT,
  getQuotaCache,
  getQuotaWindowStatus,
  isQuotaExhaustedForRequest,
} from "@/domain/quotaCache";
import { cooldownUntilMs } from "@omniroute/open-sse/services/accountFallback.ts";
import {
  getCodexQuotaWindowFilterForModel,
  toCodexBaseQuotaWindowName,
  toCodexScopedQuotaWindowName,
} from "@omniroute/open-sse/config/codexQuotaScopes.ts";
import { formatQuotaUsageReason } from "@omniroute/open-sse/services/quotaWindowLabel.ts";
import { isFreeModel } from "@/shared/utils/freeModels";
import {
  type ProviderConnectionView,
} from "@/lib/db/providers/lazyConnectionView";

// ── Internal types ───────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_QUOTA_THRESHOLD_PERCENT = 1;
const MAX_QUOTA_THRESHOLD_PERCENT = 100;
const NON_RETRYABLE_MODEL_LOCKOUT_REASONS = new Set(["not_found", "not_found_local"]);

// ── Pure helper functions ────────────────────────────────────────────────────

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}
function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function toBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
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

interface QuotaLimitPolicy {
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

function normalizeQuotaThreshold(
  value: unknown,
  fallback = DEFAULT_QUOTA_THRESHOLD_PERCENT
): number {
  const parsed = toNumber(value, fallback);
  return Math.min(MAX_QUOTA_THRESHOLD_PERCENT, Math.max(MIN_QUOTA_THRESHOLD_PERCENT, parsed));
}
function normalizeWindowName(windowName: unknown): string | null {
  if (typeof windowName !== "string") return null;
  const normalized = windowName.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
export function uniqueWindows(windows: string[]): string[] {
  return [...new Set(windows)];
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
function applyCodexWindowPolicy(rawWindows: string[], providerSpecificData: JsonRecord): string[] {
  const codexPolicy = getCodexLimitPolicy(providerSpecificData);
  const normalizedRaw = rawWindows.map(normalizeCodexWindowName).filter(Boolean) as string[];

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
function normalizeStatus(value: string | null): string {
  return (value || "").trim().toLowerCase();
}
export function isTerminalConnectionStatus(connection: ProviderConnectionView): boolean {
  const status = normalizeStatus(connection.testStatus);
  return status === "credits_exhausted" || status === "banned" || status === "expired";
}
export function isTerminalConnectionStatusForModel(
  connection: ProviderConnectionView,
  provider: string,
  requestedModel: string | null
): boolean {
  if (!isTerminalConnectionStatus(connection)) return false;
  if (
    provider === "openrouter" &&
    normalizeStatus(connection.testStatus) === "credits_exhausted" &&
    requestedModel &&
    isFreeModel("openrouter", { id: requestedModel })
  ) {
    return false;
  }
  return true;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function resolveQuotaLimitPolicy(
  provider: string,
  providerSpecificData: JsonRecord
): QuotaLimitPolicy {
  const rawPolicy = asRecord(providerSpecificData.limitPolicy);
  const rawWindows = Array.isArray(rawPolicy.windows) ? rawPolicy.windows : [];
  const windows = rawWindows.map(normalizeWindowName).filter(Boolean) as string[];

  if (provider === "codex") {
    const defaultWindows = applyCodexWindowPolicy(rawWindows, providerSpecificData);
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
  connection: ProviderConnectionView,
  requestedModel: string | null = null
): { blocked: boolean; reasons: string[]; resetAt: string | null } {
  if (isClaudeExtraUsageAllowed(provider, connection.providerSpecificData)) {
    return { blocked: false, reasons: [], resetAt: null };
  }
  const policy = resolveQuotaLimitPolicy(provider, connection.providerSpecificData);
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

// ── Quota date helpers ───────────────────────────────────────────────────────

export function parseFutureDateMs(value: string | null): number | null {
  if (!value) return null;
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

export function isRetryableModelLockoutReason(reason: unknown): boolean {
  return typeof reason === "string" && reason.length > 0
    ? !NON_RETRYABLE_MODEL_LOCKOUT_REASONS.has(reason)
    : false;
}

// ── Quota headroom helpers ───────────────────────────────────────────────────

function pushClampedPercentage(percentages: number[], value: number): void {
  if (Number.isFinite(value)) {
    percentages.push(Math.max(0, Math.min(100, value)));
  }
}
function isResetAtInPast(resetAt: string | null): boolean {
  if (!resetAt) return false;
  const resetMs = new Date(resetAt).getTime();
  return Number.isFinite(resetMs) && resetMs <= Date.now();
}
function collectPolicyQuotaHeadroomPercentages(
  provider: string,
  connection: ProviderConnectionView,
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
function collectCachedQuotaHeadroomPercentages(
  provider: string,
  connection: ProviderConnectionView,
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
  connection: ProviderConnectionView,
  requestedModel: string | null = null
): number | null {
  const policy = resolveQuotaLimitPolicy(provider, connection.providerSpecificData);
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

// ── P2C connection scoring ───────────────────────────────────────────────────

export function getConnectionErrorPenalty(connection: ProviderConnectionView): number {
  const errorType = normalizeStatus(connection.lastErrorType);
  const errorSource = normalizeStatus(connection.lastErrorSource);
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
export function getConnectionRecencyPenalty(connection: ProviderConnectionView): number {
  if (!connection.lastUsedAt) return 0;
  const ageMs = Date.now() - new Date(connection.lastUsedAt).getTime();
  if (!Number.isFinite(ageMs)) return 0;
  if (ageMs < 15_000) return 3;
  if (ageMs < 60_000) return 2;
  if (ageMs < 5 * 60_000) return 1;
  return 0;
}
export function getP2CConnectionScore(
  provider: string,
  connection: ProviderConnectionView,
  requestedModel: string | null = null,
  quotaResults?: Map<string, { blocked: boolean; exhausted: boolean }>
): { score: number; quotaHeadroomPercent: number | null } {
  let quotaBlocked: boolean;
  let quotaExhausted: boolean;

  if (connection.id && quotaResults?.has(connection.id)) {
    const cached = quotaResults.get(connection.id)!;
    quotaBlocked = cached.blocked;
    quotaExhausted = cached.exhausted;
  } else {
    quotaBlocked = evaluateQuotaLimitPolicy(provider, connection, requestedModel).blocked;
    quotaExhausted = isQuotaExhaustedForRequest(
      connection.id,
      provider,
      requestedModel,
      connection.providerSpecificData
    );
  }

  const quotaHeadroomPercent = getConnectionQuotaHeadroomPercent(
    provider,
    connection,
    requestedModel
  );

  let quotaPenalty = 0;
  if (quotaHeadroomPercent !== null) {
    quotaPenalty += Math.round((100 - quotaHeadroomPercent) / 8);
    if (quotaHeadroomPercent <= 10) quotaPenalty += 10;
    else if (quotaHeadroomPercent <= 25) quotaPenalty += 4;
  } else if (!quotaBlocked && !quotaExhausted) {
    quotaPenalty += 4;
  }

  const score =
    (quotaExhausted ? 200 : 0) +
    (quotaBlocked ? 80 : 0) +
    getConnectionErrorPenalty(connection) +
    Math.min(40, (connection.backoffLevel || 0) * 8) +
    quotaPenalty +
    Math.min(12, (connection.consecutiveUseCount || 0) * 2) +
    getConnectionRecencyPenalty(connection) +
    Math.min(6, Math.max(0, connection.priority || 0) - 1);

  return { score, quotaHeadroomPercent };
}

export function compareP2CConnections(
  provider: string,
  a: ProviderConnectionView,
  b: ProviderConnectionView,
  requestedModel: string | null = null,
  quotaResults?: Map<string, { blocked: boolean; exhausted: boolean }>
): number {
  const aScore = getP2CConnectionScore(provider, a, requestedModel, quotaResults);
  const bScore = getP2CConnectionScore(provider, b, requestedModel, quotaResults);
  if (aScore.score !== bScore.score) {
    return aScore.score - bScore.score;
  }

  const aHeadroom = aScore.quotaHeadroomPercent ?? -1;
  const bHeadroom = bScore.quotaHeadroomPercent ?? -1;
  if (aHeadroom !== bHeadroom) {
    return bHeadroom - aHeadroom;
  }

  if ((a.priority || 999) !== (b.priority || 999)) {
    return (a.priority || 999) - (b.priority || 999);
  }

  return a.id.localeCompare(b.id);
}
