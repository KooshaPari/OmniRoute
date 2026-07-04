/**
 * db/providerHealthHistory.ts — Phase 3 self-healing v2.
 *
 * Append-only log of per-provider health samples that the AnomalyDetector
 * consumes to compute rolling z-scores. Backed by migration
 * `100_provider_health_history.sql`.
 *
 * The log is intentionally append-only: rollups, TTL pruning, and
 * anomaly detection are the consumer's job, not this module's.
 */

import { getDbInstance, rowToCamel } from "./core";
import { createHash } from "crypto";

export interface ProviderHealthSample {
  providerKey: string;
  sampledAt: number; // epoch seconds
  errorRate: number; // 0.0..1.0
  p95LatencyMs: number;
  activeComboCount: number;
  consecutiveFailures: number;
  samplesWindow: number;
}

interface RawSampleRow {
  id: number;
  provider_key: string;
  sampled_at: number;
  error_rate: number;
  p95_latency_ms: number;
  active_combo_count: number;
  consecutive_failures: number;
  samples_window: number;
  telemetry_hash: string;
  created_at: number;
}

const INSERT_SQL = `
  INSERT INTO provider_health_history
    (provider_key, sampled_at, error_rate, p95_latency_ms,
     active_combo_count, consecutive_failures, samples_window, telemetry_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

const RECENT_SQL = `
  SELECT id, provider_key, sampled_at, error_rate, p95_latency_ms,
         active_combo_count, consecutive_failures, samples_window,
         telemetry_hash, created_at
    FROM provider_health_history
   WHERE provider_key = ?
   ORDER BY sampled_at DESC
   LIMIT ?
`;

const PRUNE_BEFORE_SQL = `
  DELETE FROM provider_health_history
   WHERE sampled_at < ?
`;

export function computeTelemetryHash(sample: ProviderHealthSample): string {
  // Deterministic, short, fast non-cryptographic identifier. Take the first 16
  // hex chars of the sha1 of the canonical tuple — 64 bits of entropy is
  // plenty for a telemetry de-dup key.
  const canonical = [
    sample.providerKey,
    String(sample.sampledAt),
    sample.errorRate.toFixed(6),
    sample.p95LatencyMs.toFixed(2),
  ].join("|");
  const full = createHash("sha1").update(canonical).digest("hex");
  return full.slice(0, 16);
}

/**
 * Append a single health sample to the log. Duplicate-by-hash is acceptable
 * here — the AnomalyDetector can de-dup by telemetry_hash if needed.
 */
export function appendHealthSample(sample: ProviderHealthSample): void {
  const db = getDbInstance();
  const telemetryHash = computeTelemetryHash(sample);
  db.prepare(INSERT_SQL).run(
    sample.providerKey,
    sample.sampledAt,
    sample.errorRate,
    sample.p95LatencyMs,
    sample.activeComboCount,
    sample.consecutiveFailures,
    sample.samplesWindow,
    telemetryHash
  );
}

/**
 * Return the most recent `limit` samples for `providerKey`, newest first.
 * Used by AnomalyDetector.buildRollingWindow().
 */
export function recentSamplesFor(
  providerKey: string,
  limit: number
): ProviderHealthSample[] {
  const db = getDbInstance();
  const rows = db
    .prepare<RawSampleRow>(RECENT_SQL)
    .all(providerKey, limit) as RawSampleRow[];
  return rows.map(rowToCamel).map(toProviderHealthSample);
}

/**
 * Delete every sample whose `sampled_at` is older than `cutoffSeconds`.
 * Returns the number of rows removed. SelfHealingManager wires this in as
 * the TTL prune.
 */
export function pruneSamplesBefore(cutoffSeconds: number): number {
  const db = getDbInstance();
  const result = db.prepare(PRUNE_BEFORE_SQL).run(cutoffSeconds);
  return typeof result.changes === "number" ? result.changes : 0;
}

function toProviderHealthSample(row: Record<string, unknown>): ProviderHealthSample {
  return {
    providerKey: String(row.providerKey),
    sampledAt: Number(row.sampledAt),
    errorRate: Number(row.errorRate),
    p95LatencyMs: Number(row.p95LatencyMs),
    activeComboCount: Number(row.activeComboCount),
    consecutiveFailures: Number(row.consecutiveFailures),
    samplesWindow: Number(row.samplesWindow),
  };
}
