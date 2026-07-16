/**
 * Bifrost route outcome metrics (open-sse scoped).
 *
 * Provides a bounded, in-memory collector of per-provider/model outcomes
 * for Bifrost upstream attempts. It stores up to `MAX_KEY_CAPACITY` keys
 * and up to `MAX_SAMPLES_PER_KEY` samples per key with deterministic LRU
 * eviction.
 */

const MAX_KEY_CAPACITY = 512;
const MAX_SAMPLES_PER_KEY = 64;
const DEFAULT_MIN_SAMPLES_FOR_RELIABILITY = 4;

export interface BifrostRouteOutcomeInput {
  provider: string;
  model: string;
  latencyMs: number;
  status?: number | null;
  /** Optional error instance/message when a transport failure occurs. */
  error?: unknown;
  /** Optional explicit success override when status is unavailable. */
  ok?: boolean;
  ttftMs?: number;
  outputTokens?: number;
  generationDurationMs?: number;
  /** Test override for deterministic assertions. */
  timestampMs?: number;
}

export interface BifrostRouteOutcomeStats {
  provider: string;
  model: string;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgTtftMs: number | null;
  avgTokensPerSecond: number | null;
  lastStatus: number | null;
  lastError: string | null;
  updatedAtMs: number;
}

export interface BifrostRouteProjectedOutcome {
  provider: string;
  model: string;
  e2eLatencyMs: number;
  avgTtftMs: number | null;
  avgTokensPerSecond: number | null;
  health: number | undefined;
  failureRate: number;
  stability: number | undefined;
  sampleCount: number;
  updatedAtMs: number;
}

export interface BifrostRouteProjectionOptions {
  minimumSamplesForReliability?: number;
}

type MetricProjectionInput = BifrostRouteOutcomeStats | null | undefined;

interface OutcomeSample {
  timestampMs: number;
  status: number | null;
  latencyMs: number;
  ok: boolean;
  error: string | null;
  ttftMs: number | null;
  outputTokens: number | null;
  generationDurationMs: number | null;
}

interface OutcomeRing {
  provider: string;
  model: string;
  samples: Array<OutcomeSample | null>;
  writeIndex: number;
  updatedAtMs: number;
}

const metricsMap = new Map<string, OutcomeRing>();

const DEFAULT_PROVIDER = "unknown-provider";
const DEFAULT_MODEL = "unknown-model";

function normalizeKey(provider: string, model: string): string {
  return `${provider}\u0000${model}`;
}

function normalizeError(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function safeProviderModel(value: string, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

function getOrderedSamples(state: OutcomeRing): OutcomeSample[] {
  const ordered: OutcomeSample[] = [];
  for (const sample of state.samples) {
    if (sample) ordered.push(sample);
  }
  ordered.sort((a, b) => a.timestampMs - b.timestampMs);
  return ordered;
}

function buildStats(state: OutcomeRing): BifrostRouteOutcomeStats {
  const ordered = getOrderedSamples(state);
  let successCount = 0;
  let failureCount = 0;
  let latencySum = 0;
  const latencies: number[] = [];
  let ttftSum = 0;
  let validTtftSamples = 0;
  let outputTokenSum = 0;
  let generationDurationMsSum = 0;
  let validTpsSamples = 0;

  for (const sample of ordered) {
    if (sample.ok) successCount += 1;
    else failureCount += 1;
    latencySum += sample.latencyMs;
    latencies.push(sample.latencyMs);
    if (sample.ttftMs !== null) {
      ttftSum += sample.ttftMs;
      validTtftSamples += 1;
    }
    if (
      sample.ttftMs !== null &&
      sample.outputTokens !== null &&
      sample.generationDurationMs !== null
    ) {
      outputTokenSum += sample.outputTokens;
      generationDurationMsSum += sample.generationDurationMs;
      validTpsSamples += 1;
    }
  }

  const sampleCount = ordered.length;
  const avgLatencyMs = sampleCount > 0 ? Math.round(latencySum / sampleCount) : 0;
  const sample = ordered.at(-1);
  const avgTtftMs = validTtftSamples > 0 ? ttftSum / validTtftSamples : null;
  const avgTokensPerSecond =
    validTpsSamples > 0 && generationDurationMsSum > 0
      ? (outputTokenSum / generationDurationMsSum) * 1000
      : null;

  return {
    provider: state.provider,
    model: state.model,
    sampleCount,
    successCount,
    failureCount,
    successRate: sampleCount > 0 ? successCount / sampleCount : 0,
    avgLatencyMs,
    p95LatencyMs: computeP95(latencies),
    avgTtftMs,
    avgTokensPerSecond,
    lastStatus: sample?.status ?? null,
    lastError: sample?.error ?? null,
    updatedAtMs: state.updatedAtMs,
  };
}

function getOrCreateState(provider: string, model: string): OutcomeRing {
  const key = normalizeKey(provider, model);
  const existing = metricsMap.get(key);
  if (existing) {
    // Move key to most-recent position for LRU semantics.
    metricsMap.delete(key);
    metricsMap.set(key, existing);
    return existing;
  }

  const created: OutcomeRing = {
    provider,
    model,
    samples: [],
    writeIndex: 0,
    updatedAtMs: Date.now(),
  };

  metricsMap.set(key, created);
  while (metricsMap.size > MAX_KEY_CAPACITY) {
    const oldest = metricsMap.keys().next().value;
    if (oldest === undefined) break;
    metricsMap.delete(oldest);
  }

  return created;
}

function writeSample(state: OutcomeRing, sample: OutcomeSample): void {
  if (state.samples.length < MAX_SAMPLES_PER_KEY) {
    state.samples.push(sample);
  } else {
    state.samples[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % MAX_SAMPLES_PER_KEY;
  }
  state.updatedAtMs = sample.timestampMs;
}

function normalizeStatus(status: number | null | undefined): number | null {
  if (typeof status !== "number" || !Number.isFinite(status)) return null;
  return Math.max(0, Math.trunc(status));
}

function ensureMs(value: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizePositiveMs(value: number | undefined, fallback: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
  return normalized;
}

function normalizeNonNegativeCount(
  value: number | undefined,
  fallback: number | null
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (!Number.isFinite(normalized) || normalized < 0) return fallback;
  return normalized;
}

function nowMs(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeMinimumSamples(value: number | undefined): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : DEFAULT_MIN_SAMPLES_FOR_RELIABILITY;
  return Math.max(1, parsed);
}

function computeStabilityFromLatency(avgLatencyMs: number, p95LatencyMs: number): number | undefined {
  if (!Number.isFinite(avgLatencyMs) || !Number.isFinite(p95LatencyMs)) return undefined;
  if (avgLatencyMs <= 0) return undefined;
  if (p95LatencyMs < 0) return undefined;

  const dispersion = Math.abs(p95LatencyMs - avgLatencyMs) / avgLatencyMs;
  return clamp01(1 - dispersion);
}

function computeFailureRate(successRate: number): number {
  if (!Number.isFinite(successRate)) return 0;
  return clamp01(1 - successRate);
}

function isValidStats(stats: MetricProjectionInput): stats is BifrostRouteOutcomeStats {
  if (!stats) return false;
  if (typeof stats.provider !== "string" || typeof stats.model !== "string") return false;
  if (!Number.isFinite(stats.sampleCount) || stats.sampleCount < 0) return false;
  if (!Number.isFinite(stats.updatedAtMs) || stats.updatedAtMs < 0) return false;
  if (!Number.isFinite(stats.successRate)) return false;
  if (!Number.isFinite(stats.avgLatencyMs) || !Number.isFinite(stats.p95LatencyMs)) return false;
  if (stats.avgTtftMs !== null && !Number.isFinite(stats.avgTtftMs)) return false;
  if (stats.avgTokensPerSecond !== null && !Number.isFinite(stats.avgTokensPerSecond)) return false;
  return true;
}

export function projectBifrostRouteMetrics(
  stats: BifrostRouteOutcomeStats,
  options: BifrostRouteProjectionOptions = {}
): BifrostRouteProjectedOutcome | null {
  if (!isValidStats(stats)) return null;

  const sampleCount = stats.sampleCount;
  const e2eLatencyMs = stats.sampleCount > 0 && Number.isFinite(stats.p95LatencyMs)
    ? stats.p95LatencyMs
    : stats.avgLatencyMs;
  const successRate = clamp01(stats.successRate);
  const failureRate = computeFailureRate(successRate);

  const minimumSamples = normalizeMinimumSamples(options.minimumSamplesForReliability);
  if (sampleCount < minimumSamples) {
    return {
      provider: stats.provider,
      model: stats.model,
      e2eLatencyMs,
      avgTtftMs: stats.avgTtftMs,
      avgTokensPerSecond: stats.avgTokensPerSecond,
      health: undefined,
      failureRate,
      stability: undefined,
      sampleCount,
      updatedAtMs: stats.updatedAtMs,
    };
  }

  return {
    provider: stats.provider,
    model: stats.model,
    e2eLatencyMs,
    avgTtftMs: stats.avgTtftMs,
    avgTokensPerSecond: stats.avgTokensPerSecond,
    health: successRate,
    failureRate,
    stability: computeStabilityFromLatency(stats.avgLatencyMs, stats.p95LatencyMs),
    sampleCount,
    updatedAtMs: stats.updatedAtMs,
  };
}

export function recordBifrostRouteOutcome(input: BifrostRouteOutcomeInput): void {
  const provider = safeProviderModel(input.provider, DEFAULT_PROVIDER);
  const model = safeProviderModel(input.model, DEFAULT_MODEL);
  const status = normalizeStatus(input.status);
  const latencyMs = ensureMs(input.latencyMs, 0);
  const ok = typeof input.ok === "boolean"
    ? input.ok
    : status !== null
      ? status >= 200 && status < 300
      : false;

  const sample: OutcomeSample = {
    timestampMs: ensureMs(input.timestampMs, nowMs()),
    status,
    latencyMs,
    ok,
    error: !ok ? normalizeError(input.error) : null,
    ttftMs: normalizePositiveMs(input.ttftMs, null),
    outputTokens: normalizeNonNegativeCount(input.outputTokens, null),
    generationDurationMs: normalizePositiveMs(input.generationDurationMs, null),
  };

  const state = getOrCreateState(provider, model);
  writeSample(state, sample);
  state.updatedAtMs = sample.timestampMs;
}

export function getBifrostRouteMetrics(
  provider: string,
  model: string,
): BifrostRouteOutcomeStats | null {
  const key = normalizeKey(
    safeProviderModel(provider, DEFAULT_PROVIDER),
    safeProviderModel(model, DEFAULT_MODEL),
  );
  const state = metricsMap.get(key);
  if (!state) return null;
  return buildStats(state);
}

export function getProjectedBifrostRouteMetrics(
  provider: string,
  model: string,
  options: BifrostRouteProjectionOptions = {}
): BifrostRouteProjectedOutcome | null {
  const stats = getBifrostRouteMetrics(provider, model);
  return projectBifrostRouteMetrics(stats, options);
}

export function getAllProjectedBifrostRouteMetrics(
  options: BifrostRouteProjectionOptions = {}
): BifrostRouteProjectedOutcome[] {
  const all: BifrostRouteProjectedOutcome[] = [];
  for (const stats of getAllBifrostRouteMetrics()) {
    const projected = projectBifrostRouteMetrics(stats, options);
    if (projected !== null) {
      all.push(projected);
    }
  }
  return all;
}

export function getAllBifrostRouteMetrics(): BifrostRouteOutcomeStats[] {
  const all: BifrostRouteOutcomeStats[] = [];
  for (const state of metricsMap.values()) {
    all.push(buildStats(state));
  }
  return all;
}

export function resetBifrostRouteMetricsForTest(): void {
  metricsMap.clear();
}
