/**
 * src/lib/observability/quotaGauges.ts
 *
 * Per-tenant quota gauge layer (PR-007 — task-spec API surface).
 *
 * Tracks three gauges per (tenant, kind):
 *   - omniroute_quota_remaining          (raw count remaining)
 *   - omniroute_quota_limit              (raw configured cap)
 *   - omniroute_quota_utilization_ratio  (computed = 1 - remaining/limit)
 *
 * Cardinality:
 *   - `tenant_id` is bounded by the FIFO allow-list in `costLedger.ts`
 *     (max 1024 distinct values).
 *   - `kind` is allow-listed to the four documented values
 *     (`requests_per_minute`, `requests_per_day`, `tokens_per_day`,
 *     `spend_per_day_usd`); anything else is coerced to "other".
 *
 * Default-off: when `OTEL_SDK_DISABLED=true`, every setter short-circuits.
 *
 * API surface (matches the task spec exactly):
 *   - setQuotaRemaining(tenantId, kind, remaining)
 *   - setQuotaLimit(tenantId, kind, limit)
 *   - getQuotaSnapshot(tenantId)
 */

import {
  quotaRemainingGauge,
  quotaLimitGauge,
  quotaUtilizationGauge,
  QUOTA_KIND_ALLOWLIST,
} from "./metrics";
import { admitTenantId, isTelemetryDisabled } from "./costLedger";

/* ------------------------------------------------------------------ *
 * Kind allow-list                                                      *
 * ------------------------------------------------------------------ */

export type QuotaKind =
  | "requests_per_minute"
  | "requests_per_day"
  | "tokens_per_day"
  | "spend_per_day_usd";

function normaliseKind(raw: unknown): QuotaKind | "other" {
  if (typeof raw !== "string") return "other";
  return (QUOTA_KIND_ALLOWLIST as ReadonlyArray<string>).includes(raw) ? (raw as QuotaKind) : "other";
}

/* ------------------------------------------------------------------ *
 * Snapshot state — in-memory mirror of the gauge values                *
 * ------------------------------------------------------------------ */

interface QuotaState {
  /** Remaining quota (last value set via `setQuotaRemaining`). */
  remaining: number | undefined;
  /** Configured limit (last value set via `setQuotaLimit`). */
  limit: number | undefined;
  /** Per-kind override map. */
  byKind: Map<QuotaKind | "other", { remaining?: number; limit?: number }>;
}

const snapshots = new Map<string, QuotaState>();

function snapshotFor(tenantId: string): QuotaState {
  let state = snapshots.get(tenantId);
  if (!state) {
    state = { remaining: undefined, limit: undefined, byKind: new Map() };
    snapshots.set(tenantId, state);
  }
  return state;
}

/* ------------------------------------------------------------------ *
 * Setters — task-spec surface                                          *
 * ------------------------------------------------------------------ */

/**
 * Set the remaining quota for a (tenant, kind) pair. Updates the gauge
 * AND the per-kind snapshot. No-op when telemetry is disabled.
 */
export function setQuotaRemaining(tenantId: unknown, kind: unknown, remaining: number): void {
  if (isTelemetryDisabled()) return;
  const tenant = admitTenantId(tenantId);
  const k = normaliseKind(kind);
  const value = Number(remaining);
  if (!Number.isFinite(value)) return;
  quotaRemainingGauge.set({ tenant_id: tenant, kind: k }, value);
  const state = snapshotFor(tenant);
  state.remaining = value;
  const byKind = state.byKind.get(k) ?? {};
  byKind.remaining = value;
  state.byKind.set(k, byKind);
  recomputeUtilisation(tenant, k);
}

/**
 * Set the configured quota limit for a (tenant, kind) pair. Updates the
 * gauge AND the per-kind snapshot. No-op when telemetry is disabled.
 */
export function setQuotaLimit(tenantId: unknown, kind: unknown, limit: number): void {
  if (isTelemetryDisabled()) return;
  const tenant = admitTenantId(tenantId);
  const k = normaliseKind(kind);
  const value = Number(limit);
  if (!Number.isFinite(value)) return;
  quotaLimitGauge.set({ tenant_id: tenant, kind: k }, value);
  const state = snapshotFor(tenant);
  state.limit = value;
  const byKind = state.byKind.get(k) ?? {};
  byKind.limit = value;
  state.byKind.set(k, byKind);
  recomputeUtilisation(tenant, k);
}

/**
 * Recompute the utilisation gauge from (limit, remaining). Idempotent —
 * safe to call from both setters.
 */
function recomputeUtilisation(tenant: string, kind: QuotaKind | "other"): void {
  const state = snapshots.get(tenant);
  if (!state) return;
  const byKind = state.byKind.get(kind);
  if (!byKind) return;
  if (typeof byKind.limit !== "number" || byKind.limit <= 0) {
    // Match tenantMetrics.ts behaviour: 0 limit → utilisation = 0 (never
    // +Infinity, which would explode dashboards).
    quotaUtilizationGauge.set({ tenant_id: tenant, kind }, 0);
    return;
  }
  const used = (typeof byKind.remaining === "number" ? byKind.limit - byKind.remaining : 0);
  const ratio = used / byKind.limit;
  quotaUtilizationGauge.set({ tenant_id: tenant, kind }, ratio);
}

/* ------------------------------------------------------------------ *
 * Snapshot — task-spec surface                                         *
 * ------------------------------------------------------------------ */

export interface QuotaKindSnapshot {
  kind: QuotaKind | "other";
  remaining: number | undefined;
  limit: number | undefined;
  /** `1 - remaining/limit`, or 0 if limit is 0/missing. */
  utilizationRatio: number;
}

export interface QuotaSnapshot {
  tenantId: string;
  /** Flat "remaining"/"limit" pair from the most recent setters (across all kinds). */
  remaining: number | undefined;
  limit: number | undefined;
  /** Per-kind breakdown. */
  kinds: QuotaKindSnapshot[];
}

/**
 * Read a snapshot of the current quota state for a single tenant.
 * Returns an empty snapshot (no kinds) when the tenant has no recorded
 * quota.
 */
export function getQuotaSnapshot(tenantId: unknown): QuotaSnapshot {
  const tenant = admitTenantId(tenantId);
  const state = snapshots.get(tenant);
  if (!state) {
    return { tenantId: tenant, remaining: undefined, limit: undefined, kinds: [] };
  }
  const kinds: QuotaKindSnapshot[] = [];
  // Stable order — emit the four spec kinds first in declared order, then
  // any "other" bucket.
  for (const k of QUOTA_KIND_ALLOWLIST) {
    const byKind = state.byKind.get(k as QuotaKind);
    if (!byKind) continue;
    const ratio = computeRatio(byKind.limit, byKind.remaining);
    kinds.push({ kind: k as QuotaKind, remaining: byKind.remaining, limit: byKind.limit, utilizationRatio: ratio });
  }
  if (state.byKind.has("other")) {
    const byKind = state.byKind.get("other")!;
    const ratio = computeRatio(byKind.limit, byKind.remaining);
    kinds.push({ kind: "other", remaining: byKind.remaining, limit: byKind.limit, utilizationRatio: ratio });
  }
  return {
    tenantId: tenant,
    remaining: state.remaining,
    limit: state.limit,
    kinds,
  };
}

function computeRatio(limit: number | undefined, remaining: number | undefined): number {
  if (typeof limit !== "number" || limit <= 0) return 0;
  if (typeof remaining !== "number") return 0;
  const used = limit - remaining;
  return used / limit;
}

/* ------------------------------------------------------------------ *
 * Reset (test-only)                                                    *
 * ------------------------------------------------------------------ */

/**
 * Wipe every snapshot. Does NOT reset the underlying metric registry —
 * the gauges hold their last value until overwritten. Tests that need a
 * fully clean state should also call `metricsRegistry.reset()`.
 */
export function resetForTests(): void {
  snapshots.clear();
}
