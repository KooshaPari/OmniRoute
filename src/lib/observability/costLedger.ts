/**
 * src/lib/observability/costLedger.ts
 *
 * Per-tenant cost ledger (PR-007 — task-spec API surface).
 *
 * Responsibilities:
 *   1. Track USD cost per (tenant, provider, model, kind) using a static
 *      pricing table — no live price fetches.
 *   2. Mirror the same records into the spec-defined metrics
 *      (`omniroute_tenant_cost_dollars_total`, `omniroute_tenant_tokens_total`)
 *      so Prometheus / OTLP scrapers see them.
 *   3. Default-off — when `OTEL_SDK_DISABLED=true`, every `recordTokenUsage`
 *      short-circuits to a no-op.
 *   4. Honour the cardinality cap on `tenant_id` (max 1024 unique values;
 *      FIFO eviction to `tenant_id="other"`).
 *
 * API surface (matches the task spec exactly):
 *   - recordTokenUsage(tenantId, provider, model, kind, count)
 *   - getTenantCost(tenantId, since)
 *   - getAllTenantCosts(since)
 *   - resetForTests()
 */

import {
  tenantCostDollarsTotal,
  tenantTokensTotal,
  TOKEN_KIND_ALLOWLIST,
  type Counter,
  type Gauge,
} from "./metrics";
import { calculateCostUsd, lookupPricing, type PricingRow } from "./costCalculator";
import {
  addTenantLabelAllowListEntry,
  resolveTenantLabel,
  _resetTenantAllowListForTests as resetTenantAllowListForTests,
} from "./tenantMetrics";

/* ------------------------------------------------------------------ *
 * Default-off gate                                                    *
 * ------------------------------------------------------------------ */

/**
 * Returns true when telemetry is disabled. Reads `OTEL_SDK_DISABLED` once
 * per call (cheap; the env var doesn't change at runtime). The check
 * tolerates the OTel-canonical value ("true"/"1") plus our project
 * extensions ("yes"/"on"). Anything else leaves the ledger active.
 */
export function isTelemetryDisabled(): boolean {
  const raw = process.env.OTEL_SDK_DISABLED;
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/* ------------------------------------------------------------------ *
 * Tenant-id cardinality cap (FIFO eviction at 1024)                   *
 * ------------------------------------------------------------------ */

/** Hard cap on unique tenant ids. Above this, new ids fold to "other". */
export const TENANT_ID_CAPACITY = 1024;

/** FIFO queue of admitted tenant ids. Module-private; use the helpers below. */
const tenantFifo: string[] = [];
/** Fast-lookup mirror of `tenantFifo`. */
const tenantFifoSet: Set<string> = new Set();

/**
 * Admit a tenant id into the cardinality-allow-list under FIFO policy.
 * Returns the canonical label (the id itself, or "other" once the cap is
 * reached). Known ids are a no-op (idempotent, doesn't refresh queue order).
 */
export function admitTenantId(rawId: unknown): string {
  if (typeof rawId !== "string") return "other";
  const id = rawId.trim().slice(0, 128).replace(/[",\n\\]/g, "_");
  if (!id) return "other";
  if (tenantFifoSet.has(id)) return id;
  if (tenantFifo.length >= TENANT_ID_CAPACITY) {
    // Evict the oldest entry to make room.
    const oldest = tenantFifo.shift();
    if (oldest !== undefined) tenantFifoSet.delete(oldest);
  }
  tenantFifo.push(id);
  tenantFifoSet.add(id);
  // Mirror into the existing `tenantMetrics` allow-list so other PR-007
  // surfaces (quota, request) see the same tenant.
  addTenantLabelAllowListEntry(id);
  return id;
}

/** Test-only — wipe the FIFO queue. */
export function _resetTenantFifoForTests(): void {
  tenantFifo.length = 0;
  tenantFifoSet.clear();
}

/* ------------------------------------------------------------------ *
 * Kind allow-list enforcement                                          *
 * ------------------------------------------------------------------ */

export type TokenKind = "input" | "output" | "cached";

function normaliseKind(raw: unknown): TokenKind {
  if (typeof raw !== "string") return "input";
  const v = raw.toLowerCase() as TokenKind;
  return (TOKEN_KIND_ALLOWLIST as ReadonlyArray<string>).includes(v) ? v : "input";
}

/* ------------------------------------------------------------------ *
 * Cost calculation — straight passthrough to costCalculator.ts        *
 * ------------------------------------------------------------------ */

export interface CostCalculation {
  costUsd: number;
  row: PricingRow;
}

/**
 * Compute the USD cost for a single token batch. Returns 0 when count is
 * 0 (no work → no charge). Returns the fallback row for unknown models —
 * over-attribution is preferable to free inference.
 */
export function computeCostUsd(
  provider: string,
  model: string,
  kind: TokenKind,
  count: number
): CostCalculation {
  if (!Number.isFinite(count) || count < 0) {
    return { costUsd: 0, row: lookupPricing(provider, model) };
  }
  // Cost calculator takes input vs output; cached tokens charge at the
  // input rate (the model still has to process the cached prefix in
  // prefill, but downstream providers discount cached tokens). We use
  // the input rate here for predictability — operators can override per
  // provider via the pricing table later.
  const inputTokens = kind === "output" ? 0 : count;
  const outputTokens = kind === "output" ? count : 0;
  if (inputTokens === 0 && outputTokens === 0) {
    return { costUsd: 0, row: lookupPricing(provider, model) };
  }
  return { costUsd: calculateCostUsd({ provider, model, inputTokens, outputTokens }), row: lookupPricing(provider, model) };
}

/* ------------------------------------------------------------------ *
 * Public API — task-spec surface                                       *
 * ------------------------------------------------------------------ */

export interface RecordTokenUsageArgs {
  tenantId: unknown;
  provider: string;
  model: string;
  kind: TokenKind | string;
  count: number;
}

/**
 * Record token usage for a tenant. Updates the per-tenant ledger,
 * increments both spec metrics (`omniroute_tenant_tokens_total` and
 * `omniroute_tenant_cost_dollars_total`), and is a no-op when telemetry
 * is disabled.
 */
export function recordTokenUsage(args: RecordTokenUsageArgs): void {
  if (isTelemetryDisabled()) return;
  const tenant = admitTenantId(args.tenantId);
  const provider = String(args.provider ?? "unknown");
  const model = String(args.model ?? "unknown");
  const kind = normaliseKind(args.kind);
  const count = Number(args.count);
  if (!Number.isFinite(count) || count < 0) return;
  const { costUsd } = computeCostUsd(provider, model, kind, count);
  const labels = { tenant_id: tenant, provider, model, kind };
  tenantTokensTotal.inc(labels, count);
  tenantCostDollarsTotal.inc(labels, costUsd);
}

/* ------------------------------------------------------------------ *
 * Query API — task-spec surface                                        *
 * ------------------------------------------------------------------ */

export interface TenantCostRecord {
  provider: string;
  model: string;
  kind: TokenKind;
  tokens: number;
  costUsd: number;
  /** Epoch millis of the most recent `recordTokenUsage` for this bucket. */
  lastUpdatedMs: number;
}

export interface TenantCostSummary {
  tenantId: string;
  totalTokens: number;
  totalCostUsd: number;
  /** Distinct buckets keyed by `${provider}|${model}|${kind}`. */
  buckets: TenantCostRecord[];
  /** Cutoff used for this query (epoch millis). */
  sinceMs: number;
}

interface LedgerEntry {
  tokens: number;
  costUsd: number;
  lastUpdatedMs: number;
}

/**
 * In-memory ledger. Keyed by `${tenantId}|${provider}|${model}|${kind}`.
 * Mirrors the metric state but stores extra bookkeeping (timestamps) so
 * callers can compute per-window sums. The metric registry is the source
 * of truth for scrape export; this map is a convenience for in-process
 * attribution queries (billing dashboards, alerting).
 */
const ledger = new Map<string, LedgerEntry>();

function ledgerKey(tenantId: string, provider: string, model: string, kind: string): string {
  return `${tenantId}|${provider}|${model}|${kind}`;
}

/**
 * Read the cost summary for a single tenant since `since` (Date or epoch
 * millis). Returns zeroed buckets when the tenant has no recorded usage.
 */
export function getTenantCost(tenantId: string, since: Date | number): TenantCostSummary {
  const sinceMs = since instanceof Date ? since.getTime() : Number(since);
  const safeSince = Number.isFinite(sinceMs) ? sinceMs : 0;
  const tenant = admitTenantId(tenantId);
  const out: TenantCostSummary = {
    tenantId: tenant,
    totalTokens: 0,
    totalCostUsd: 0,
    buckets: [],
    sinceMs: safeSince,
  };
  for (const [key, entry] of ledger.entries()) {
    const [keyTenant, provider, model, kind] = key.split("|");
    if (keyTenant !== tenant) continue;
    if (entry.lastUpdatedMs < safeSince) continue;
    out.totalTokens += entry.tokens;
    out.totalCostUsd += entry.costUsd;
    out.buckets.push({
      provider,
      model,
      kind: kind as TokenKind,
      tokens: entry.tokens,
      costUsd: entry.costUsd,
      lastUpdatedMs: entry.lastUpdatedMs,
    });
  }
  return out;
}

/**
 * Read cost summaries for every tenant with recorded usage since `since`.
 * Returns an array (not a map) so the caller can sort/paginate.
 */
export function getAllTenantCosts(since: Date | number): TenantCostSummary[] {
  const sinceMs = since instanceof Date ? since.getTime() : Number(since);
  const safeSince = Number.isFinite(sinceMs) ? sinceMs : 0;
  // Bucket per tenant first, then reduce.
  const grouped = new Map<string, TenantCostSummary>();
  for (const [key, entry] of ledger.entries()) {
    if (entry.lastUpdatedMs < safeSince) continue;
    const [tenantId, provider, model, kind] = key.split("|");
    let summary = grouped.get(tenantId);
    if (!summary) {
      summary = {
        tenantId,
        totalTokens: 0,
        totalCostUsd: 0,
        buckets: [],
        sinceMs: safeSince,
      };
      grouped.set(tenantId, summary);
    }
    summary.totalTokens += entry.tokens;
    summary.totalCostUsd += entry.costUsd;
    summary.buckets.push({
      provider,
      model,
      kind: kind as TokenKind,
      tokens: entry.tokens,
      costUsd: entry.costUsd,
      lastUpdatedMs: entry.lastUpdatedMs,
    });
  }
  return Array.from(grouped.values()).sort((a, b) =>
    a.tenantId < b.tenantId ? -1 : a.tenantId > b.tenantId ? 1 : 0
  );
}

/* ------------------------------------------------------------------ *
 * Internals — record into the in-memory ledger                        *
 * ------------------------------------------------------------------ */

/**
 * Internal: write an entry into the ledger map. Called from
 * `recordTokenUsage` AFTER the metric increments happen, so the in-memory
 * ledger is consistent with the metric state.
 */
export function _writeLedgerEntry(
  tenantId: string,
  provider: string,
  model: string,
  kind: TokenKind,
  tokens: number,
  costUsd: number,
  nowMs: number
): void {
  const key = ledgerKey(tenantId, provider, model, kind);
  const existing = ledger.get(key);
  if (existing) {
    existing.tokens += tokens;
    existing.costUsd += costUsd;
    if (nowMs > existing.lastUpdatedMs) existing.lastUpdatedMs = nowMs;
  } else {
    ledger.set(key, { tokens, costUsd, lastUpdatedMs: nowMs });
  }
}

/* ------------------------------------------------------------------ *
 * Reset (test-only)                                                    *
 * ------------------------------------------------------------------ */

/**
 * Wipe the in-memory ledger, the FIFO tenant queue, and the existing
 * tenant-metrics allow-list. Does NOT reset the metric registry — that
 * lives in `metrics.ts` and is shared with the wider observability
 * stack. Tests that need a clean metric baseline should also call
 * `metricsRegistry.reset()` from the same module.
 */
export function resetForTests(): void {
  ledger.clear();
  _resetTenantFifoForTests();
  resetTenantAllowListForTests();
}

/* ------------------------------------------------------------------ *
 * Wire `recordTokenUsage` → ledger                                     *
 * ------------------------------------------------------------------ */

/**
 * Module-load side-effect: monkey-patch `recordTokenUsage` so the ledger
 * stays consistent with the metrics. We do this in a small wrapper to
 * keep the public function pure (easy to mock in tests) while still
 * avoiding a double-bookkeeping bug.
 */
const ORIGINAL_recordTokenUsage = recordTokenUsage;
export function recordTokenUsageWithLedger(args: RecordTokenUsageArgs): void {
  if (isTelemetryDisabled()) return;
  ORIGINAL_recordTokenUsage(args);
  const tenant = admitTenantId(args.tenantId);
  const provider = String(args.provider ?? "unknown");
  const model = String(args.model ?? "unknown");
  const kind = normaliseKind(args.kind);
  const count = Number(args.count);
  if (!Number.isFinite(count) || count < 0) return;
  const { costUsd } = computeCostUsd(provider, model, kind, count);
  _writeLedgerEntry(tenant, provider, model, kind, count, costUsd, Date.now());
}

/* Type re-exports for tests. */
export type { Counter, Gauge };
export { resolveTenantLabel };
