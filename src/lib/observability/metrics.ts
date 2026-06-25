/**
 * Prometheus-style metrics registry.
 *
 * Exposes Counter / Gauge / Histogram / Summary primitives plus a small
 * set of domain-specific recorders (`recordProviderAttempt`,
 * `recordProviderDuration`, `recordCacheHit/Miss`, `recordQuotaRemaining/Limit`)
 * used by the proxy / relay code paths.
 *
 * The renderer produces Prometheus text exposition format
 * (https://prometheus.io/docs/instrumenting/exposition_formats/) so the
 * output is scrape-compatible out of the box. Default endpoint is
 * `/metrics` (registered via `setProcessMetrics()` which boots the default
 * registry in the bootstrap).
 *
 * Cardinality cap: every label-key has a fixed `MAX_LABEL_VALUES = 64`
 * budget per metric. Once a label value exceeds the cap we drop it (and
 * the metric family the value would have produced) so an attacker
 * crafting unique user IDs cannot blow up Prometheus' index. This is
 * documented as the "known-unbounded-label" mitigation in the OTel
 * cardinality guidance.
 *
 * Concurrency:
 *   - All mutators are synchronous and lock-free (single Map mutation per
 *     call). Hot paths (recordProviderDuration on the proxy span) call
 *     this directly without any queueing or batching.
 *   - The renderer is `O(N*M)` over the metric set but runs only on the
 *     /metrics scrape — not in the hot path.
 */

import { currentTraceId } from "./otel.ts";

/**
 * Hard upper bound on distinct label values per metric per label-key.
 * Past this, new values are dropped (the sample is discarded). Picked
 * to be well below Prometheus' index-collision threshold for typical
 * cardinality analyses (see https://prometheus.io/docs/practices/naming/).
 */
export const MAX_LABEL_VALUES = 64;

/**
 * Histogram bucket layout in seconds. Matches the OTel HTTP server
 * duration semantic-convention defaults so the dashboards written against
 * OTel-vendored histograms Just Work on our proxy spans.
 */
const DEFAULT_DURATION_BUCKETS: readonly number[] = Object.freeze([
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
]);

/* ──────────────── primitive types ──────────────── */

/**
 * A single sample value plus its label set. `value` is a JS number; we
 * use double precision throughout (Prometheus is internally double).
 * `labels` is frozen per sample so render output is deterministic.
 */
export interface MetricSample {
  readonly labels: Readonly<Record<string, string>>;
  readonly value: number;
}

/**
 * Base shape for all metric primitives. Subclasses provide type-specific
 * `record()` methods; the registry only cares about `name`, `help`, and
 * the ability to render into text.
 */
export interface Metric {
  readonly name: string;
  readonly kind: "counter" | "gauge" | "histogram" | "summary";
  readonly help: string;
  /** Stable label keys, in declaration order. Used for render. */
  readonly labelKeys: readonly string[];
  /** Reset internal state — used by tests. */
  reset(): void;
  /** Produce the Prometheus text-format body for this metric. */
  render(): string;
}

/**
 * Counter — monotonically increasing value. Negative `inc()` calls throw
 * (Prometheus counters are unsigned). Use a Gauge if you need deltas.
 */
export class Counter implements Metric {
  readonly kind = "counter" as const;
  readonly samples: Map<string, MetricSample> = new Map();
  /** Per-label-value cap. Exceeding this silently drops new labels. */
  private readonly cardinalityCap: number;
  /** Frozen label key list. */
  readonly labelKeys: readonly string[];
  private dropped = 0;

  constructor(
    readonly name: string,
    readonly help: string,
    labelKeys: readonly string[] = [],
    options: { cardinalityCap?: number } = {}
  ) {
    this.labelKeys = Object.freeze([...labelKeys]);
    this.cardinalityCap = options.cardinalityCap ?? MAX_LABEL_VALUES;
  }

  inc(by: number = 1, labels: Readonly<Record<string, string>> = {}): void {
    if (!Number.isFinite(by)) return;
    if (by < 0) {
      throw new Error(`Counter '${this.name}' cannot decrement; use a Gauge instead`);
    }
    if (by === 0) return;
    const key = labelKey(labels, this.labelKeys);
    const existing = this.samples.get(key);
    if (existing) {
      this.samples.set(key, { labels: existing.labels, value: existing.value + by });
      return;
    }
    if (this.samples.size >= this.cardinalityCap) {
      this.dropped += 1;
      return;
    }
    this.samples.set(key, { labels: Object.freeze({ ...labels }), value: by });
  }

  reset(): void {
    this.samples.clear();
    this.dropped = 0;
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} counter`);
    for (const sample of this.samples.values()) {
      lines.push(formatLine(this.name, sample.labels, sample.value));
    }
    if (this.dropped > 0) {
      lines.push(`# dropped_series_total{name="${this.name}"} ${this.dropped}`);
    }
    return lines.join("\n");
  }
}

/**
 * Gauge — point-in-time value that can go up or down. No monotonicity
 * constraint; `set()` is the primary API, `inc()` / `dec()` provided for
 * convenience.
 */
export class Gauge implements Metric {
  readonly kind = "gauge" as const;
  readonly samples: Map<string, MetricSample> = new Map();
  readonly labelKeys: readonly string[];
  private readonly cardinalityCap: number;
  private dropped = 0;

  constructor(
    readonly name: string,
    readonly help: string,
    labelKeys: readonly string[] = [],
    options: { cardinalityCap?: number } = {}
  ) {
    this.labelKeys = Object.freeze([...labelKeys]);
    this.cardinalityCap = options.cardinalityCap ?? MAX_LABEL_VALUES;
  }

  set(value: number, labels: Readonly<Record<string, string>> = {}): void {
    if (!Number.isFinite(value)) return;
    const key = labelKey(labels, this.labelKeys);
    if (!this.samples.has(key) && this.samples.size >= this.cardinalityCap) {
      this.dropped += 1;
      return;
    }
    this.samples.set(key, { labels: Object.freeze({ ...labels }), value });
  }

  inc(by: number = 1, labels: Readonly<Record<string, string>> = {}): void {
    const key = labelKey(labels, this.labelKeys);
    const existing = this.samples.get(key);
    const base = existing?.value ?? 0;
    this.set(base + by, labels);
  }

  dec(by: number = 1, labels: Readonly<Record<string, string>> = {}): void {
    this.inc(-by, labels);
  }

  reset(): void {
    this.samples.clear();
    this.dropped = 0;
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} gauge`);
    for (const sample of this.samples.values()) {
      lines.push(formatLine(this.name, sample.labels, sample.value));
    }
    if (this.dropped > 0) {
      lines.push(`# dropped_series_total{name="${this.name}"} ${this.dropped}`);
    }
    return lines.join("\n");
  }
}

/**
 * Histogram — cumulative-bucket counter with sum/count. Buckets are
 * declared at construction time; `observe()` finds the bucket via binary
 * search (the bucket list is small enough that linear scan is also fine
 * but binary search reads cleanly).
 */
export class Histogram implements Metric {
  readonly kind = "histogram" as const;
  readonly buckets: readonly number[];
  /** Per-bucket counts per label-set. */
  readonly bucketCounts: Map<string, Map<number, number>> = new Map();
  /** Sum per label-set. */
  readonly sumByLabel: Map<string, number> = new Map();
  /** Count per label-set. */
  readonly countByLabel: Map<string, number> = new Map();
  readonly labelKeys: readonly string[];
  private readonly cardinalityCap: number;
  private dropped = 0;

  constructor(
    readonly name: string,
    readonly help: string,
    labelKeys: readonly string[] = [],
    options: { buckets?: readonly number[]; cardinalityCap?: number } = {}
  ) {
    this.labelKeys = Object.freeze([...labelKeys]);
    // +Inf is implicit — Prometheus renders it automatically.
    const raw = (options.buckets ?? DEFAULT_DURATION_BUCKETS).slice().sort((a, b) => a - b);
    this.buckets = Object.freeze(raw);
    this.cardinalityCap = options.cardinalityCap ?? MAX_LABEL_VALUES;
  }

  observe(value: number, labels: Readonly<Record<string, string>> = {}): void {
    if (!Number.isFinite(value)) return;
    const key = labelKey(labels, this.labelKeys);
    if (!this.bucketCounts.has(key) && this.bucketCounts.size >= this.cardinalityCap) {
      this.dropped += 1;
      return;
    }
    let counts = this.bucketCounts.get(key);
    if (!counts) {
      counts = new Map();
      this.bucketCounts.set(key, counts);
    }
    // Cumulative bucket update: every bucket >= value gets +1.
    for (const b of this.buckets) {
      if (value <= b) {
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
    }
    // +Inf bucket (total count).
    counts.set(Number.POSITIVE_INFINITY, (counts.get(Number.POSITIVE_INFINITY) ?? 0) + 1);
    this.sumByLabel.set(key, (this.sumByLabel.get(key) ?? 0) + value);
    this.countByLabel.set(key, (this.countByLabel.get(key) ?? 0) + 1);
  }

  reset(): void {
    this.bucketCounts.clear();
    this.sumByLabel.clear();
    this.countByLabel.clear();
    this.dropped = 0;
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);
    for (const [key, counts] of this.bucketCounts.entries()) {
      const labels = parseLabelKey(key, this.labelKeys);
      // Cumulative buckets must be emitted in ascending order.
      let cumulative = 0;
      for (const b of this.buckets) {
        cumulative = counts.get(b) ?? 0;
        lines.push(formatBucketLine(this.name, labels, b, cumulative));
      }
      // +Inf bucket — total count.
      const total = counts.get(Number.POSITIVE_INFINITY) ?? 0;
      lines.push(formatBucketLine(this.name, labels, Number.POSITIVE_INFINITY, total));
      lines.push(formatLine(`${this.name}_sum`, labels, this.sumByLabel.get(key) ?? 0));
      lines.push(formatLine(`${this.name}_count`, labels, this.countByLabel.get(key) ?? 0));
    }
    if (this.dropped > 0) {
      lines.push(`# dropped_series_total{name="${this.name}"} ${this.dropped}`);
    }
    return lines.join("\n");
  }
}

/**
 * Summary — quantiles over a sliding window. We do NOT implement a true
 * t-digest (overkill for the proxy/relay scope); instead we keep the last
 * N observations per label-set and compute simple quantiles on render.
 *
 * Cheap and adequate for the dashboards we expose today. Swap for a real
 * t-digest if we ever need accurate p99.9 over millions of samples.
 */
export class Summary implements Metric {
  readonly kind = "summary" as const;
  /** Ring buffer of observations per label-set. */
  readonly windows: Map<string, number[]> = new Map();
  /** Max observations kept per label-set. */
  readonly maxAge: number;
  readonly labelKeys: readonly string[];
  private readonly cardinalityCap: number;
  private dropped = 0;

  constructor(
    readonly name: string,
    readonly help: string,
    labelKeys: readonly string[] = [],
    options: { maxAge?: number; cardinalityCap?: number } = {}
  ) {
    this.labelKeys = Object.freeze([...labelKeys]);
    this.maxAge = options.maxAge ?? 1024;
    this.cardinalityCap = options.cardinalityCap ?? MAX_LABEL_VALUES;
  }

  observe(value: number, labels: Readonly<Record<string, string>> = {}): void {
    if (!Number.isFinite(value)) return;
    const key = labelKey(labels, this.labelKeys);
    if (!this.windows.has(key) && this.windows.size >= this.cardinalityCap) {
      this.dropped += 1;
      return;
    }
    let window = this.windows.get(key);
    if (!window) {
      window = [];
      this.windows.set(key, window);
    }
    window.push(value);
    if (window.length > this.maxAge) {
      window.shift();
    }
  }

  reset(): void {
    this.windows.clear();
    this.dropped = 0;
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} summary`);
    for (const [key, window] of this.windows.entries()) {
      const labels = parseLabelKey(key, this.labelKeys);
      const sorted = window.slice().sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      lines.push(formatQuantileLine(this.name, labels, 0.5, quantile(sorted, 0.5)));
      lines.push(formatQuantileLine(this.name, labels, 0.9, quantile(sorted, 0.9)));
      lines.push(formatQuantileLine(this.name, labels, 0.99, quantile(sorted, 0.99)));
      lines.push(formatLine(`${this.name}_sum`, labels, sum));
      lines.push(formatLine(`${this.name}_count`, labels, sorted.length));
    }
    if (this.dropped > 0) {
      lines.push(`# dropped_series_total{name="${this.name}"} ${this.dropped}`);
    }
    return lines.join("\n");
  }
}

/* ──────────────── registry ──────────────── */

/**
 * Metric registry — singleton per process. Holds all instrument instances
 * keyed by name; provides `register()`, `render()`, and `reset()`.
 */
export class MetricsRegistry {
  private readonly metrics: Map<string, Metric> = new Map();

  register(metric: Metric): Metric {
    if (this.metrics.has(metric.name)) {
      return this.metrics.get(metric.name) as Metric;
    }
    this.metrics.set(metric.name, metric);
    return metric;
  }

  get(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  reset(): void {
    for (const m of this.metrics.values()) m.reset();
  }

  /**
   * Render the entire registry into Prometheus text format. Called on
   * /metrics scrape. Result includes the trailing newline Prometheus
   * parsers expect.
   */
  render(): string {
    const parts: string[] = [];
    for (const m of this.metrics.values()) {
      parts.push(m.render());
    }
    return parts.join("\n") + "\n";
  }
}

/**
 * The default process registry. Lazy so importing this module doesn't
 * allocate. Use `metricsRegistry()` to get a stable singleton.
 */
let defaultRegistryInstance: MetricsRegistry | null = null;

export function metricsRegistry(): MetricsRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = new MetricsRegistry();
    primeDefaultRegistry(defaultRegistryInstance);
  }
  return defaultRegistryInstance;
}

/**
 * Pre-register the domain-specific metrics the rest of the codebase
 * records into. Centralizing this here keeps the wiring in one place —
 * if a call site can't find its metric, the bug is in THIS file, not
 * scattered across the codebase.
 */
function primeDefaultRegistry(reg: MetricsRegistry): void {
  // ─── HTTP request metrics (recorded via httpMetricsMiddleware) ───
  reg.register(
    new Counter(
      "http_requests_total",
      "Count of HTTP requests handled by the OmniRoute proxy.",
      ["route", "method", "status"]
    )
  );
  reg.register(
    new Histogram(
      "http_request_duration_seconds",
      "Duration of HTTP requests in seconds.",
      ["route", "method", "status"]
    )
  );

  // ─── Provider call metrics (recordProviderAttempt/Duration) ───
  reg.register(
    new Counter(
      "provider_attempts_total",
      "Count of upstream provider attempts (success/error/timeout).",
      ["provider", "model", "outcome"]
    )
  );
  reg.register(
    new Histogram(
      "provider_call_duration_seconds",
      "Duration of upstream provider calls in seconds.",
      ["provider", "model"]
    )
  );

  // ─── Cache metrics ───
  reg.register(
    new Counter(
      "cache_hits_total",
      "Count of cache lookups that returned a hit.",
      ["layer"]
    )
  );
  reg.register(
    new Counter(
      "cache_misses_total",
      "Count of cache lookups that returned a miss.",
      ["layer"]
    )
  );

  // ─── Quota metrics ───
  reg.register(
    new Gauge(
      "quota_remaining",
      "Quota remaining for a tenant (units depend on tenant config).",
      ["tenant"]
    )
  );
  reg.register(
    new Gauge(
      "quota_limit",
      "Quota limit for a tenant (units depend on tenant config).",
      ["tenant"]
    )
  );

  // ─── Process metrics (set by setProcessMetrics) ───
  reg.register(new Gauge("process_uptime_seconds", "Process uptime in seconds."));
  reg.register(
    new Gauge("process_memory_rss_bytes", "Resident set size in bytes (Node process.memoryUsage().rss).")
  );
  reg.register(
    new Gauge("process_memory_heap_bytes", "V8 heap used in bytes (Node process.memoryUsage().heapUsed).")
  );
  reg.register(new Gauge("process_event_loop_lag_seconds", "Approximate event-loop lag in seconds."));
}

/* ──────────────── domain-specific recorders ──────────────── */

/**
 * Record one HTTP request. Called from the proxy / Next.js middleware.
 *
 * @param opts.route    — request route (e.g. "/v1/chat/completions")
 * @param opts.method   — HTTP method (e.g. "POST")
 * @param opts.status   — HTTP status (number or string)
 * @param opts.durationSeconds — wall-clock duration in seconds
 */
export function httpMetricsMiddleware(opts: {
  route: string;
  method: string;
  status: number | string;
  durationSeconds: number;
}): void {
  const reg = metricsRegistry();
  const counter = reg.get("http_requests_total") as Counter | undefined;
  const hist = reg.get("http_request_duration_seconds") as Histogram | undefined;
  const labels = { route: opts.route, method: opts.method, status: String(opts.status) };
  counter?.inc(1, labels);
  hist?.observe(opts.durationSeconds, labels);
}

/**
 * Record one provider attempt outcome.
 *
 * `outcome` is one of "success", "error", "timeout", "rate_limited".
 * The histogram variant (recordProviderDuration) is the timing axis;
 * this counter is the outcome axis. Use both for proper SLO math.
 */
export function recordProviderAttempt(opts: {
  provider: string;
  model: string;
  outcome: "success" | "error" | "timeout" | "rate_limited";
  durationSeconds?: number;
}): void {
  const reg = metricsRegistry();
  const counter = reg.get("provider_attempts_total") as Counter | undefined;
  counter?.inc(1, { provider: opts.provider, model: opts.model, outcome: opts.outcome });
  if (opts.durationSeconds !== undefined) {
    recordProviderDuration({ provider: opts.provider, model: opts.model, durationSeconds: opts.durationSeconds });
  }
}

/**
 * Record the wall-clock duration of a provider call. The histogram is
 * uncoupled from outcome so callers that don't care about success/failure
 * can still time their calls.
 */
export function recordProviderDuration(opts: {
  provider: string;
  model: string;
  durationSeconds: number;
}): void {
  const reg = metricsRegistry();
  const hist = reg.get("provider_call_duration_seconds") as Histogram | undefined;
  hist?.observe(opts.durationSeconds, { provider: opts.provider, model: opts.model });
}

/**
 * Record a cache hit. `layer` is the cache layer (e.g. "prompt",
 * "embedding", "response"); see `isKnownCacheLayer()` for the known set.
 */
export function recordCacheHit(layer: string): void {
  const reg = metricsRegistry();
  const counter = reg.get("cache_hits_total") as Counter | undefined;
  counter?.inc(1, { layer });
}

/**
 * Record a cache miss. See {@link recordCacheHit}.
 */
export function recordCacheMiss(layer: string): void {
  const reg = metricsRegistry();
  const counter = reg.get("cache_misses_total") as Counter | undefined;
  counter?.inc(1, { layer });
}

/**
 * Update the gauge for a tenant's remaining quota. Idempotent — last write
 * wins.
 */
export function recordQuotaRemaining(tenant: string, remaining: number): void {
  const reg = metricsRegistry();
  const gauge = reg.get("quota_remaining") as Gauge | undefined;
  gauge?.set(remaining, { tenant });
}

/**
 * Update the gauge for a tenant's quota limit. Idempotent — last write
 * wins.
 */
export function recordQuotaLimit(tenant: string, limit: number): void {
  const reg = metricsRegistry();
  const gauge = reg.get("quota_limit") as Gauge | undefined;
  gauge?.set(limit, { tenant });
}

/**
 * Refresh the process_* gauges with current values. Called periodically
 * by the bootstrap so Prometheus sees fresh values even when no HTTP
 * traffic is flowing (so we don't ship a "process_down" alert on idle).
 */
export function setProcessMetrics(): void {
  const reg = metricsRegistry();
  const uptime = reg.get("process_uptime_seconds") as Gauge | undefined;
  const rss = reg.get("process_memory_rss_bytes") as Gauge | undefined;
  const heap = reg.get("process_memory_heap_bytes") as Gauge | undefined;
  const lag = reg.get("process_event_loop_lag_seconds") as Gauge | undefined;
  uptime?.set(process.uptime());
  const mem = process.memoryUsage();
  rss?.set(mem.rss);
  heap?.set(mem.heapUsed);
  // Event-loop lag is best-effort: we sample the time it took for setImmediate
  // to fire after scheduling. On most calls this is <1ms; we use it as a
  // coarse health signal, not a precise measurement.
  const lagStart = Date.now();
  setImmediate(() => {
    const lagSeconds = Math.max(0, (Date.now() - lagStart) / 1000);
    lag?.set(lagSeconds);
  });
}

/* ──────────────── formatting helpers ──────────────── */

/**
 * Stable string key for a label set, computed in the order of the metric's
 * declared label keys. Missing labels become empty strings. We use `\x1f`
 * (unit separator) as the delimiter to avoid collisions with legitimate
 * label content.
 */
function labelKey(
  labels: Readonly<Record<string, string>>,
  declaredKeys: readonly string[]
): string {
  if (declaredKeys.length === 0) return "";
  const parts: string[] = [];
  for (const k of declaredKeys) {
    parts.push(labels[k] ?? "");
  }
  return parts.join("\x1f");
}

function parseLabelKey(key: string, declaredKeys: readonly string[]): Record<string, string> {
  if (declaredKeys.length === 0 || key === "") return {};
  const parts = key.split("\x1f");
  const out: Record<string, string> = {};
  for (let i = 0; i < declaredKeys.length; i++) {
    out[declaredKeys[i] as string] = parts[i] ?? "";
  }
  return out;
}

function formatLine(name: string, labels: Readonly<Record<string, string>>, value: number): string {
  return `${name}${renderLabelString(labels)} ${formatValue(value)}`;
}

function formatBucketLine(
  name: string,
  labels: Readonly<Record<string, string>>,
  upperBound: number,
  count: number
): string {
  const isInf = !Number.isFinite(upperBound);
  const le = isInf ? "+Inf" : formatValue(upperBound);
  const lbl = renderLabelString({ ...labels, le });
  return `${name}_bucket${lbl} ${count}`;
}

function formatQuantileLine(
  name: string,
  labels: Readonly<Record<string, string>>,
  q: number,
  value: number
): string {
  return `${name}${renderLabelString({ ...labels, quantile: String(q) })} ${formatValue(value)}`;
}

function renderLabelString(labels: Readonly<Record<string, string>>): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) return "";
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(`${k}="${escapeLabel(labels[k] ?? "")}"`);
  }
  return `{${parts.join(",")}}`;
}

function escapeLabel(v: string): string {
  // Per Prometheus spec: escape \, \n, and ".
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) {
    if (Number.isNaN(v)) return "NaN";
    return v > 0 ? "+Inf" : "-Inf";
  }
  // Avoid scientific notation for small/large numbers per Prometheus
  // text format guidance; use plain decimals.
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toFixed(0);
  return v.toString();
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sorted[base] as number;
  const upper = sorted[base + 1];
  if (upper === undefined) return lower;
  return lower + rest * (upper - lower);
}

/* ──────────────── trace correlation helper ──────────────── */

/**
 * Return the current traceId (if a span is active) or "0". Used by
 * external callers that want to correlate metric samples with the active
 * trace without importing the otel module directly. Kept in metrics.ts
 * because the only consumer is the render path.
 */
export function metricTraceId(): string {
  try {
    return currentTraceId();
  } catch {
    return "0";
  }
}