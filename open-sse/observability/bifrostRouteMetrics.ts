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

export interface BifrostRouteOutcomeInput {
  provider: string;
  model: string;
  latencyMs: number;
  status?: number | null;
  /** Optional error instance/message when a transport failure occurs. */
  error?: unknown;
  /** Optional explicit success override when status is unavailable. */
  ok?: boolean;
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
  lastStatus: number | null;
  lastError: string | null;
  updatedAtMs: number;
}

interface OutcomeSample {
  timestampMs: number;
  status: number | null;
  latencyMs: number;
  ok: boolean;
  error: string | null;
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

  for (const sample of ordered) {
    if (sample.ok) successCount += 1;
    else failureCount += 1;
    latencySum += sample.latencyMs;
    latencies.push(sample.latencyMs);
  }

  const sampleCount = ordered.length;
  const avgLatencyMs = sampleCount > 0 ? Math.round(latencySum / sampleCount) : 0;
  const sample = ordered.at(-1);

  return {
    provider: state.provider,
    model: state.model,
    sampleCount,
    successCount,
    failureCount,
    successRate: sampleCount > 0 ? successCount / sampleCount : 0,
    avgLatencyMs,
    p95LatencyMs: computeP95(latencies),
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

function nowMs(): number {
  return Date.now();
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
