/**
 * db/trafficShadow.ts — Traffic-shadow persistence layer (B6 of v8.1 Bifrost).
 *
 * Public API:
 *   - recordShadowOutcome(outcome)    — best-effort insert of one comparison row
 *   - summarizeShadowSince(sinceIso)  — aggregates p50/p95/p99 + error rate
 *   - getCurrentRampConfig()          — read the singleton config row
 *   - setRampPhase(phase, opts)       — operator override (move to a new phase)
 *   - setBifrostServePctOverride(pct) — operator override (0-100 or null)
 *   - setShadowPaused(paused)         — operator pause switch
 *   - resetShadowRamp(now)            — restart the 14-day schedule
 *
 * Best-effort contract: recordShadowOutcome is called from the hot
 * dispatch path. A DB write failure must not break the user-visible
 * response — the dispatcher catches and logs (see
 * open-sse/services/trafficShadow.ts).
 *
 * Reference: ADR-031 § Decision Review, PLAN.md § 2.5.2 (B6),
 * src/shared/constants/shadowRamp.ts.
 */

import { getDbInstance } from "./core";
import {
  resolveActiveShadowPhase,
  type ShadowRampPhase,
  type ShadowRampPhaseName,
} from "@/shared/constants/shadowRamp";

interface StatementLike<TRow = unknown> {
  all: (...params: unknown[]) => TRow[];
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => { changes: number };
}

interface DbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
}

function getDb(): DbLike {
  return getDbInstance() as unknown as DbLike;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Inputs for recordShadowOutcome. All latency / cost / status fields are
 * nullable because either path may have failed. The dispatcher must always
 * supply `servedPath` and `divergenceScore`; everything else reflects what
 * actually happened on each path.
 */
export interface ShadowOutcome {
  virtualKeyId?: string | null;
  provider: string;
  model: string;
  phase: ShadowRampPhaseName;
  legacyLatencyMs: number | null;
  legacyCostUsd: number | null;
  legacyStatus: number | null;
  bifrostLatencyMs: number | null;
  bifrostCostUsd: number | null;
  bifrostStatus: number | null;
  divergenceScore: number;
  servedPath: "legacy" | "bifrost";
  notes?: string;
}

/**
 * Aggregated summary of shadow comparisons since a given timestamp,
 * optionally filtered to a single served path. Returned by
 * summarizeShadowSince and used by the operator dashboard + B6.4
 * decision-review report.
 */
export interface ShadowSummary {
  sinceIso: string;
  count: number;
  legacy: {
    count: number;
    errorCount: number;
    errorRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    meanCostUsd: number | null;
  };
  bifrost: {
    count: number;
    errorCount: number;
    errorRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    meanCostUsd: number | null;
  };
  /**
   * Cost delta (bifrost - legacy) in USD, averaged per-request. Negative
   * means Bifrost is cheaper on average. The B6.4 decision-review policy
   * treats "p99 cost lower" as a serving preference when paired with
   * "50%+ faster".
   */
  meanCostDeltaUsd: number | null;
  /**
   * Latency delta (bifrost - legacy) in ms, averaged per-request.
   * Negative means Bifrost is faster on average.
   */
  meanLatencyDeltaMs: number | null;
  /**
   * Served-path breakdown: how many requests were served by each path.
   */
  servedLegacy: number;
  servedBifrost: number;
}

export interface ShadowRampConfig {
  currentPhase: ShadowRampPhaseName;
  rampStartedAt: string;
  bifrostServePctOverride: number | null;
  paused: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert one shadow comparison row. Best-effort: callers in the hot
 * dispatch path catch and swallow errors. Errors are re-thrown here so
 * unit tests can assert on them; the dispatcher wraps the call.
 */
export function recordShadowOutcome(outcome: ShadowOutcome): { id: number } {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO traffic_shadow_log
        (virtual_key_id, provider, model, phase,
         legacy_latency_ms, legacy_cost_usd, legacy_status,
         bifrost_latency_ms, bifrost_cost_usd, bifrost_status,
         divergence_score, served_path, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      outcome.virtualKeyId ?? null,
      outcome.provider,
      outcome.model,
      outcome.phase,
      outcome.legacyLatencyMs,
      outcome.legacyCostUsd,
      outcome.legacyStatus,
      outcome.bifrostLatencyMs,
      outcome.bifrostCostUsd,
      outcome.bifrostStatus,
      outcome.divergenceScore,
      outcome.servedPath,
      outcome.notes ?? null
    );
  return { id: Number(result.changes) >= 0 ? result.changes : 0 };
}

/**
 * Compute aggregate stats for the comparison log since a given ISO timestamp.
 * The implementation is pure SQL (percentile approximation via row-number
 * windows) so it works under sql.js and better-sqlite3 alike — there is no
 * dependency on native percentile functions.
 */

/**
 * Read the singleton shadow config row. Always returns a row — migration
 * 105 inserts the default (id=1) on first apply.
 */
export function getCurrentRampConfig(): ShadowRampConfig {
  const db = getDb();
  const row = db
    .prepare<{
      current_phase: string;
      ramp_started_at: string;
      bifrost_serve_pct_override: number | null;
      paused: number;
      updated_at: string;
    }>(
      `SELECT current_phase, ramp_started_at, bifrost_serve_pct_override, paused, updated_at
         FROM traffic_shadow_config WHERE id = 1`
    )
    .get();
  if (!row) {
    // Defensive: migration should have inserted id=1. Return a sensible default.
    return {
      currentPhase: "observe-only",
      rampStartedAt: new Date().toISOString(),
      bifrostServePctOverride: null,
      paused: false,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    currentPhase: row.current_phase as ShadowRampPhaseName,
    rampStartedAt: row.ramp_started_at,
    bifrostServePctOverride: row.bifrost_serve_pct_override,
    paused: row.paused === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Resolve the active phase: read the DB row, then evaluate the phase
 * schedule against the stored `ramp_started_at`. If the operator has set
 * a `bifrost_serve_pct_override`, the returned phase object has that
 * override applied (so the dispatcher uses the operator's pct directly).
 *
 * If `paused=1`, returns the observe-only phase (0%) regardless of the
 * schedule — the operator can kill Bifrost traffic instantly.
 */
export function getActivePhaseFromDb(now: Date = new Date()): ShadowRampPhase {
  const config = getCurrentRampConfig();
  if (config.paused) {
    return { name: "observe-only", bifrostServePct: 0, durationDays: 0 };
  }
  const phase = resolveActiveShadowPhase(config.rampStartedAt, now);
  if (config.bifrostServePctOverride !== null) {
    return {
      ...phase,
      bifrostServePct: Math.max(0, Math.min(100, config.bifrostServePctOverride)),
    };
  }
  return phase;
}

// ---------------------------------------------------------------------------
// Operator overrides
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
