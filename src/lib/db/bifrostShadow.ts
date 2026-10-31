/**
 * bifrostShadow.ts — DB domain module for the Bifrost traffic-shadow log.
 *
 * Backs the `bifrost_shadow_events` table (migration 101). Records per-request
 * comparisons between the legacy chatCore path and the parallel Bifrost path
 * during the B6.1 traffic-shadow phase of the v8.1 Bifrost rollout.
 *
 * Cache contract:
 *   - `recordBifrostShadowEvent(event)` — append one comparison row.
 *   - `getBifrostShadowEvents({since, limit})` — operator query for the dashboard.
 *   - `purgeBifrostShadowEvents(olderThan)` — housekeeping; returns row count.
 *   - `getBifrostShadowStats({since})` — aggregate (count, error_rate, p50/p99
 *     latency, agreement_rate).
 *
 * B6.1 is strictly observe-only: the chatCore response is always returned to
 * the user. The shadow call is best-effort; a recordBifrostShadowEvent failure
 * must not affect the user-visible response. Callers in the hot dispatch path
 * are expected to wrap with try/catch — see open-sse/executors/bifrostShadow.ts.
 *
 * See: docs/adr/0031-bifrost-tier1-router.md
 *      PLAN.md § 2.5.2 (B6.1)
 *      open-sse/executors/bifrostShadow.ts
 *      src/lib/db/migrations/101_bifrost_shadow.sql
 */

import { getDbInstance } from "./core";

// ──────────────── Types ────────────────

export type BifrostShadowStatus = "ok" | "error" | "timeout" | "skipped";

export const BIFROST_SHADOW_STATUSES: readonly BifrostShadowStatus[] = [
  "ok",
  "error",
  "timeout",
  "skipped",
] as const;

export interface BifrostShadowEvent {
  eventId: string;
  chatcoreRequestId: string | null;
  provider: string;
  model: string;
  bifrostStatus: BifrostShadowStatus;
  bifrostLatencyMs: number | null;
  chatcoreLatencyMs: number | null;
  agreementScore: number | null;
  bifrostTokensIn: number | null;
  bifrostTokensOut: number | null;
  chatcoreTokensIn: number | null;
  chatcoreTokensOut: number | null;
  bifrostCostUsd: number | null;
  chatcoreCostUsd: number | null;
  createdAt: string;
}

/** Public input — `eventId` is auto-generated if absent. */
export interface BifrostShadowEventInput {
  eventId?: string;
  chatcoreRequestId?: string | null;
  provider: string;
  model: string;
  bifrostStatus: BifrostShadowStatus;
  bifrostLatencyMs?: number | null;
  chatcoreLatencyMs?: number | null;
  agreementScore?: number | null;
  bifrostTokensIn?: number | null;
  bifrostTokensOut?: number | null;
  chatcoreTokensIn?: number | null;
  chatcoreTokensOut?: number | null;
  bifrostCostUsd?: number | null;
  chatcoreCostUsd?: number | null;
  createdAt?: string;
}

export interface BifrostShadowStats {
  sinceIso: string;
  count: number;
  okCount: number;
  errorCount: number;
  timeoutCount: number;
  skippedCount: number;
  /** error+timeout divided by total non-skipped. 0..1. */
  errorRate: number;
  /** Median Bifrost latency in ms. null if no successful rows. */
  bifrostP50LatencyMs: number | null;
  /** 99th percentile Bifrost latency in ms. null if <100 rows. */
  bifrostP99LatencyMs: number | null;
  /** Median chatCore latency in ms. null if no rows. */
  chatcoreP50LatencyMs: number | null;
  /** 99th percentile chatCore latency in ms. null if <100 rows. */
  chatcoreP99LatencyMs: number | null;
  /** Mean of agreement_score across rows where it's not null. 0..1. */
  meanAgreementScore: number | null;
}

export interface GetBifrostShadowEventsOptions {
  /** ISO timestamp inclusive lower bound. Undefined = no lower bound. */
  since?: string;
  /** Max rows to return. Default 100. Cap at 5,000. */
  limit?: number;
  /** Filter by provider. Undefined = no filter. */
  provider?: string;
  /** Filter by status. Undefined = no filter. */
  bifrostStatus?: BifrostShadowStatus;
}

// ──────────────── Helpers ────────────────

function isValidStatus(status: string): status is BifrostShadowStatus {
  return status === "ok" || status === "error" || status === "timeout" || status === "skipped";
}

// ──────────────── CRUD ────────────────

/**
 * Append one shadow comparison row. The dispatcher wraps this in try/catch;
 * see open-sse/executors/bifrostShadow.ts. Throws on invalid input so unit
 * tests can assert on bad-data paths.
 */
export function recordBifrostShadowEvent(input: BifrostShadowEventInput): {
  eventId: string;
} {
  if (!input || typeof input !== "object") {
    throw new Error("bifrostShadow.recordBifrostShadowEvent: input is required");
  }
  if (!input.provider || typeof input.provider !== "string") {
    throw new Error("bifrostShadow.recordBifrostShadowEvent: provider is required");
  }
  if (!input.model || typeof input.model !== "string") {
    throw new Error("bifrostShadow.recordBifrostShadowEvent: model is required");
  }
  if (!isValidStatus(input.bifrostStatus)) {
    throw new Error(
      `bifrostShadow.recordBifrostShadowEvent: bifrostStatus must be one of ${BIFROST_SHADOW_STATUSES.join(", ")} (got ${String(input.bifrostStatus)})`
    );
  }

  const eventId =
    typeof input.eventId === "string" && input.eventId.length > 0
      ? input.eventId
      : `bse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const agreement =
    typeof input.agreementScore === "number" && Number.isFinite(input.agreementScore)
      ? Math.max(0, Math.min(1, input.agreementScore))
      : null;

  const db = getDbInstance();
  db.prepare(
    `INSERT INTO bifrost_shadow_events
       (event_id, chatcore_request_id, provider, model, bifrost_status,
        bifrost_latency_ms, chatcore_latency_ms, agreement_score,
        bifrost_tokens_in, bifrost_tokens_out,
        chatcore_tokens_in, chatcore_tokens_out,
        bifrost_cost_usd, chatcore_cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).run(
    eventId,
    input.chatcoreRequestId ?? null,
    input.provider,
    input.model,
    input.bifrostStatus,
    input.bifrostLatencyMs ?? null,
    input.chatcoreLatencyMs ?? null,
    agreement,
    input.bifrostTokensIn ?? null,
    input.bifrostTokensOut ?? null,
    input.chatcoreTokensIn ?? null,
    input.chatcoreTokensOut ?? null,
    input.bifrostCostUsd ?? null,
    input.chatcoreCostUsd ?? null,
    input.createdAt ?? null
  );

  return { eventId };
}

/**
 * Read recent shadow events. Newest-first. Capped at 5,000 rows per query.
 */

/**
 * Delete rows older than the given ISO timestamp. Returns the number of
 * rows removed. Housekeeping: run on a cron (e.g. hourly) to keep the
 * table bounded during the 14-day B6 ramp.
 */

/**
 * Aggregate stats since a given ISO timestamp. Used by the operator
 * dashboard and the B6.1 weekly review. Pure SQL where possible; the
 * percentile computation runs in TypeScript over a sorted slice (cheap,
 * bounded by row count which is purged hourly).
 */
