/**
 * bifrostRouteMetrics.ts — DB domain module for Bifrost route metric samples.
 *
 * Persists bounded raw request samples for provider/model route projection math.
 * Data is intentionally minimal and replay-safe so startup hydration remains
 * deterministic and fast.
 *
 * - `MAX_KEY_CAPACITY` tracks how many provider/model keys are retained.
 * - `MAX_SAMPLES_PER_KEY` tracks per-key sample history.
 */

import { createHash } from "node:crypto";
import { getDbInstance } from "./core";

export const BIFROST_ROUTE_METRICS_MAX_KEY_CAPACITY = 512;
export const BIFROST_ROUTE_METRICS_MAX_SAMPLES_PER_KEY = 64;

export interface BifrostRouteMetricSample {
  provider: string;
  model: string;
  timestampMs: number;
  status: number | null;
  latencyMs: number;
  ok: boolean;
  error: string | null;
  ttftMs: number | null;
  outputTokens: number | null;
  generationDurationMs: number | null;
}

export interface BifrostRouteMetricKeySamples {
  provider: string;
  model: string;
  samples: BifrostRouteMetricSample[];
}

export interface BifrostRouteMetricKeySamplesWithUpdatedAt
  extends BifrostRouteMetricKeySamples {
  updatedAtMs: number;
}

interface BifrostRouteMetricPersistOptions {
  maxKeys?: number;
  maxSamplesPerKey?: number;
}

interface BifrostRouteMetricSampleRow extends BifrostRouteMetricSample {
  sampleId: string;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function normalizeLatency(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

function normalizeNullablePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

function normalizeOutcome(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function normalizeKeys(value: string): string {
  return normalizeString(value);
}

function normalizeMs(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function normalizeTimestamp(value: unknown): number | null {
  const normalized = normalizeMs(value, -1);
  return normalized >= 0 ? normalized : null;
}

function normalizeMax(value: number | undefined, fallback: number): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, parsed);
}

function hasTable(db: ReturnType<typeof getDbInstance>, tableName: string): boolean {
  try {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName) as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

function parseSampleRow(row: Record<string, unknown>): BifrostRouteMetricSample | null {
  const provider = normalizeString(row.provider);
  const model = normalizeString(row.model);
  const timestampMs = normalizeTimestamp(row.timestampMs ?? row.timestamp_ms);
  const status = normalizeStatus(row.status);
  const latencyMs = normalizeLatency(row.latencyMs ?? row.latency_ms);
  const ok = normalizeOutcome(row.ok);
  const error = normalizeString(row.error);
  const ttftMs = normalizeNullablePositiveInt(row.ttftMs ?? row.ttft_ms);
  const outputTokens = normalizeNullablePositiveInt(row.outputTokens ?? row.output_tokens);
  const generationDurationMs = normalizeNullablePositiveInt(
    row.generationDurationMs ?? row.generation_duration_ms
  );

  if (
    !provider ||
    !model ||
    timestampMs === null ||
    latencyMs === null
  ) {
    return null;
  }

  return {
    provider,
    model,
    timestampMs,
    status,
    latencyMs,
    ok,
    error: error.length > 0 ? error : null,
    ttftMs,
    outputTokens,
    generationDurationMs,
  };
}

function clampSamples(
  samples: BifrostRouteMetricSample[],
  maxSamples: number
): BifrostRouteMetricSample[] {
  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  return maxSamples <= 0 ? [] : sorted.slice(-maxSamples);
}

function normalizeLoadPersistedRows(rows: Record<string, unknown>[]): BifrostRouteMetricKeySamplesWithUpdatedAt[] {
  const groupedSamples = new Map<string, BifrostRouteMetricSample[]>();
  const keyOrder: string[] = [];

  for (const row of rows) {
    const sample = parseSampleRow(row);
    if (!sample) continue;
    const key = `${sample.provider}\u0000${sample.model}`;
    const existing = groupedSamples.get(key);
    if (!existing) keyOrder.push(key);
    const current = existing ?? [];
    current.push(sample);
    if (!existing) groupedSamples.set(key, current);
  }

  const output: BifrostRouteMetricKeySamplesWithUpdatedAt[] = [];
  const seen = new Set<string>();
  for (const key of keyOrder) {
    if (seen.has(key)) continue;
    seen.add(key);
    const samples = groupedSamples.get(key);
    if (!samples) continue;
    const last = samples.at(-1);
    if (!last) continue;
    const [provider, model] = key.split("\u0000");
    if (!provider || !model) continue;
    output.push({
      provider,
      model,
      samples,
      updatedAtMs: last.timestampMs,
    });
  }

  return output;
}

function pruneExcessSamplesPerKey(
  db: ReturnType<typeof getDbInstance>,
  maxSamplesPerKey: number
): number {
  if (maxSamplesPerKey <= 0) return 0;

  const pruneResult = db
    .prepare(
      `
      DELETE FROM bifrost_route_metrics
       WHERE id IN (
         SELECT id FROM (
           SELECT
             id,
             ROW_NUMBER() OVER (
               PARTITION BY provider, model
               ORDER BY timestamp_ms DESC, id DESC
             ) AS row_number
           FROM bifrost_route_metrics
         )
         WHERE row_number > ?
       )
      `
    )
    .run(maxSamplesPerKey) as { changes?: number };

  return pruneResult.changes ?? 0;
}

function pruneExcessKeys(
  db: ReturnType<typeof getDbInstance>,
  maxKeys: number
): number {
  if (maxKeys <= 0) return 0;

  const pruneResult = db
    .prepare(
      `
      DELETE FROM bifrost_route_metrics
       WHERE (provider, model) IN (
         SELECT provider, model
           FROM (
             SELECT
               provider,
               model,
               ROW_NUMBER() OVER (
                 ORDER BY MAX(timestamp_ms) DESC, provider, model
               ) AS key_rank
             FROM bifrost_route_metrics
             GROUP BY provider, model
           )
          WHERE key_rank > ?
       )
      `
    )
    .run(maxKeys) as { changes?: number };

  return pruneResult.changes ?? 0;
}

function makeSampleId(sample: BifrostRouteMetricSample): string {
  const canonical = JSON.stringify({
    provider: sample.provider,
    model: sample.model,
    status: sample.status,
    timestampMs: sample.timestampMs,
    latencyMs: sample.latencyMs,
    ok: sample.ok,
    error: sample.error,
    ttftMs: sample.ttftMs,
    outputTokens: sample.outputTokens,
    generationDurationMs: sample.generationDurationMs,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function normalizeSampleForDb(sample: BifrostRouteMetricSample): BifrostRouteMetricSampleRow | null {
  const mapped: BifrostRouteMetricSample = {
    provider: normalizeKeys(sample.provider),
    model: normalizeKeys(sample.model),
    timestampMs: sample.timestampMs,
    status: normalizeStatus(sample.status),
    latencyMs: normalizeLatency(sample.latencyMs),
    ok: sample.ok === true,
    error: normalizeString(sample.error),
    ttftMs: normalizeNullablePositiveInt(sample.ttftMs),
    outputTokens: normalizeNullablePositiveInt(sample.outputTokens),
    generationDurationMs: normalizeNullablePositiveInt(sample.generationDurationMs),
  };

  if (!mapped.provider || !mapped.model) return null;
  if (!Number.isFinite(mapped.timestampMs) || mapped.timestampMs < 0) return null;
  if (mapped.latencyMs === null) return null;

  return {
    ...mapped,
    error: mapped.error.length > 0 ? mapped.error : null,
    sampleId: makeSampleId(mapped),
  };
}

function filterValidRows(
  rows: BifrostRouteMetricKeySamples[],
  maxSamplesPerKey: number
): BifrostRouteMetricKeySamples[] {
  const grouped = new Map<string, BifrostRouteMetricKeySamples>();

  for (const row of rows) {
    const provider = normalizeKeys(row?.provider);
    const model = normalizeKeys(row?.model);
    if (!provider || !model) continue;

    const samples = clampSamples(
      (row.samples ?? [])
      .map((sample) => normalizeSampleForDb(sample as BifrostRouteMetricSample))
      .filter((sample): sample is BifrostRouteMetricSampleRow => sample !== null)
      .map((sample) => ({
        provider,
        model,
        timestampMs: sample.timestampMs,
        status: sample.status,
        latencyMs: sample.latencyMs,
        ok: sample.ok,
        error: sample.error,
        ttftMs: sample.ttftMs,
        outputTokens: sample.outputTokens,
        generationDurationMs: sample.generationDurationMs,
      }))
      .filter((sample) => sample.provider === provider && sample.model === model),
      maxSamplesPerKey
    );

    if (samples.length === 0) continue;

    grouped.set(`${provider}\u0000${model}`, {
      provider,
      model,
      samples,
    });
  }

  return Array.from(grouped.values());
}

function persistSampleRows(
  db: ReturnType<typeof getDbInstance>,
  groupedRows: BifrostRouteMetricKeySamples[],
  maxSamplesPerKey: number,
  maxKeys: number
): void {
  const insertStmt = db.prepare(
    `
    INSERT INTO bifrost_route_metrics
      (provider, model, sample_id, timestamp_ms, status, latency_ms, ok, error,
       ttft_ms, output_tokens, generation_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sample_id) DO NOTHING
    `
  );

  const tx = db.transaction(() => {
    for (const item of groupedRows) {
      for (const sample of clampSamples(item.samples, maxSamplesPerKey)) {
        const sampleId = makeSampleId(sample);
        insertStmt.run(
          sample.provider,
          sample.model,
          sampleId,
          sample.timestampMs,
          sample.status,
          sample.latencyMs,
          sample.ok ? 1 : 0,
          sample.error,
          sample.ttftMs,
          sample.outputTokens,
          sample.generationDurationMs
        );
      }
    }

    pruneExcessSamplesPerKey(db, maxSamplesPerKey);
    pruneExcessKeys(db, maxKeys);
  });

  tx();
}

/**
 * Load bounded persisted route metrics, oldest key-first for deterministic LRU repair.
 *
 * Rows are grouped by provider/model and capped per key and by key count. This
 * returns the exact data shape required by in-memory scoring code.
 */
export function loadBifrostRouteMetricSamples(
  options: BifrostRouteMetricPersistOptions = {}
): BifrostRouteMetricKeySamplesWithUpdatedAt[] {
  const maxKeys = normalizeMax(options.maxKeys, BIFROST_ROUTE_METRICS_MAX_KEY_CAPACITY);
  const maxSamplesPerKey = normalizeMax(
    options.maxSamplesPerKey,
    BIFROST_ROUTE_METRICS_MAX_SAMPLES_PER_KEY
  );

  try {
    const db = getDbInstance();
    if (!hasTable(db, "bifrost_route_metrics")) return [];
    const rows = db
      .prepare(
        `
        SELECT provider, model, timestamp_ms, status, latency_ms, ok, error,
               ttft_ms, output_tokens, generation_duration_ms
          FROM bifrost_route_metrics
         ORDER BY provider, model, timestamp_ms ASC
      `
      )
      .all() as Record<string, unknown>[];

    const grouped = normalizeLoadPersistedRows(rows);
    const bounded = grouped.map((entry) => ({
      ...entry,
      samples: clampSamples(entry.samples, maxSamplesPerKey),
    }));
    bounded.sort((a, b) => a.updatedAtMs - b.updatedAtMs);
    if (bounded.length <= maxKeys) return bounded;
    const dropped = bounded.length - maxKeys;
    const kept = bounded.slice(dropped);
    return kept;
  } catch {
    return [];
  }
}

/**
 * Merge bounded in-memory samples into persisted history using append-upsert.
 */
export function persistBifrostRouteMetricSamples(
  rows: BifrostRouteMetricKeySamples[],
  options: BifrostRouteMetricPersistOptions = {}
): void {
  const maxKeys = normalizeMax(options.maxKeys, BIFROST_ROUTE_METRICS_MAX_KEY_CAPACITY);
  const maxSamplesPerKey = normalizeMax(
    options.maxSamplesPerKey,
    BIFROST_ROUTE_METRICS_MAX_SAMPLES_PER_KEY
  );

  if (!Array.isArray(rows) || rows.length === 0) return;

  const grouped = filterValidRows(rows, maxSamplesPerKey);

  if (grouped.length === 0) return;

  const db = getDbInstance();
  const dbReady = hasTable(db, "bifrost_route_metrics");
  if (!dbReady) return;

  persistSampleRows(
    db,
    grouped,
    maxSamplesPerKey,
    maxKeys
  );
}
