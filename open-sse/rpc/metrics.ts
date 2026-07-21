/**
 * Prometheus-shaped counters and a /metrics text-exposition endpoint for
 * dispatch tier decisions. Wired to the same audit-log sink so the production
 * observability stack (Prometheus + Grafana / Loki / vendor exporters) gets
 * the same data as the SOC2 / FedRAMP audit trail.
 *
 * Counter naming follows the OpenMetrics convention:
 *   dispatch_tier_decisions_total{old_tier,new_tier,reason,actor,edge} = N
 *   dispatch_tier_decisions_seconds_sum{...} = total seconds spent
 *
 * The /metrics endpoint produces the standard text-exposition format
 * consumable by `promtool check metrics` and `prometheus.io/docs/instrumenting/exposition_formats/`.
 *
 * @see ADR-032 § "B. Prometheus histogram"
 * @see PLAN.md § 2.5.7 (B work item)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { TierChangeReason } from "./tierResolver";
import { trace, metrics as otelMetrics, type Counter, type Histogram } from "@opentelemetry/api";

type Tier = "T1" | "T2" | "T3";

interface DecisionsByLabel {
  count: number;
  totalMs: number;
}

type LabelKey = string;

interface TierDecisionMetrics {
  /** Counter: # of tier decisions, bucketed by {old,new,reason,actor,edge}. */
  decisionsByLabel: Map<LabelKey, DecisionsByLabel>;
  /** Latency histogram per (edge, newTier). Buckets: 1,10,100,1000,10000 µs. */
  observeMs: Map<LabelKey, { buckets: number[]; count: number; sum: number }>;
}

let metrics: TierDecisionMetrics | null = null;

// --- OTel Meter API bridge ---
// Lazily-created OTel counter so dispatch_tier_decisions_total is visible
// to any OTel-compatible collector (Prometheus, Grafana Agent, etc.) even
// when the in-process Prometheus scrape endpoint is also running.
let otelDecisionCounter: Counter | null = null;
let otelDecisionDurationHistogram: Histogram | null = null;

function ensureOtelCounter(): Counter | null {
  if (otelDecisionCounter) return otelDecisionCounter;
  try {
    const meter = otelMetrics.getMeter("omniroute.dispatch", "1.0.0");
    otelDecisionCounter = meter.createCounter("dispatch_tier_decisions_total", {
      description: "Number of dispatch edge tier-change decisions.",
    });
    otelDecisionDurationHistogram = meter.createHistogram(
      "dispatch_tier_decision_duration_us",
      {
        description: "Latency of dispatch edge resolution (microseconds).",
        unit: "us",
      },
    );
  } catch {
    // OTel SDK not initialised — return null; callers skip OTel recording.
  }
  return otelDecisionCounter;
}

function ensureMetrics(): TierDecisionMetrics {
  if (!metrics) {
    metrics = {
      decisionsByLabel: new Map(),
      observeMs: new Map(),
    };
  }
  return metrics;
}

function labelKey(parts: Record<string, string>): string {
  return Object.entries(parts)
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

const LATENCY_BUCKETS_US = [1, 10, 100, 1000, 10000];

/**
 * Record a tier-decision event for Prometheus scraping. Non-blocking; never
 * throws. Mirrors `emitTierChangeAudit` but goes to the metrics sink.
 */
export function recordTierDecision(params: {
  edge: string;
  oldTier: Tier | null;
  newTier: Tier;
  reason: TierChangeReason;
  actor: string;
  elapsedMs?: number;
}): void {
  try {
    const m = ensureMetrics();
    const key = labelKey({
      edge: params.edge,
      old_tier: params.oldTier ?? "none",
      new_tier: params.newTier,
      reason: params.reason,
      actor: params.actor,
    });
    const entry = m.decisionsByLabel.get(key) ?? { count: 0, totalMs: 0 };
    entry.count += 1;
    entry.totalMs += params.elapsedMs ?? 0;
    m.decisionsByLabel.set(key, entry);

    // --- OTel Meter API bridge ---
    try {
      const counter = ensureOtelCounter();
      if (counter) {
        counter.add(1, {
          edge: params.edge,
          old_tier: params.oldTier ?? "none",
          new_tier: params.newTier,
          reason: params.reason,
          actor: params.actor,
        });
      }
    } catch {
      // Never block — OTel is best-effort.
    }

    if (typeof params.elapsedMs === "number") {
      const obsKey = labelKey({ edge: params.edge, new_tier: params.newTier });
      const h = m.observeMs.get(obsKey) ?? { buckets: new Array(LATENCY_BUCKETS_US.length).fill(0), count: 0, sum: 0 };
      h.count += 1;
      h.sum += params.elapsedMs;
      const us = params.elapsedMs * 1000;
      for (let i = 0; i < LATENCY_BUCKETS_US.length; i++) {
        if (us <= LATENCY_BUCKETS_US[i]) h.buckets[i] += 1;
      }
      // +Inf bucket = total count.
      m.observeMs.set(obsKey, h);

      // --- OTel Meter API bridge (duration histogram) ---
      try {
        if (otelDecisionDurationHistogram) {
          otelDecisionDurationHistogram.record(params.elapsedMs * 1000, {
            edge: params.edge,
            new_tier: params.newTier,
          });
        }
      } catch {
        // Never block — OTel is best-effort.
      }
    }
  } catch {
    // Never block — metrics are best-effort.
  }
}

/**
 * Record a reconcile sweep duration observation. Non-blocking; never throws.
 * Called by `reconciler.ts::reconcileAllEdges` after every tick.
 *
 * Accepts either:
 *   - the swept-edge count (legacy): `recordReconcileSweep(42)`
 *   - a richer object (used by tests + OTel bridge):
 *     `recordReconcileSweep({ actor: "reconciler", durationMs: 2.4, sweptCount: 42 })`
 *
 * The richer-object form lets the bridge record an explicit duration sample
 * even on the first tick of a fresh process (when the wall-clock gap is zero).
 */
type ReconcileSweepInput =
  | number
  | { actor?: string; durationMs: number; sweptCount?: number };

export function recordReconcileSweep(input: ReconcileSweepInput): void {
  const swept = typeof input === "number" ? input : input.sweptCount ?? 0;
  const now = Date.now();
  const elapsedMs =
    typeof input === "number"
      ? now - dispatchReconcileLastTick
      : input.durationMs;
  dispatchReconcileLastTick = now;
  dispatchReconcileSweptGauge = swept;

  // Record into the metrics sink as a "reconcile.sweep" edge decision.
  const m = ensureMetrics();
  const obsKey = labelKey({ edge: "reconcile.sweep", new_tier: "T1" });
  const h = m.observeMs.get(obsKey) ?? { buckets: new Array(LATENCY_BUCKETS_US.length).fill(0), count: 0, sum: 0 };
  h.count += 1;
  h.sum += elapsedMs;
  const us = elapsedMs * 1000;
  for (let i = 0; i < LATENCY_BUCKETS_US.length; i++) {
    if (us <= LATENCY_BUCKETS_US[i]) h.buckets[i] += 1;
  }
  m.observeMs.set(obsKey, h);
  dispatchReconcileLastDurationMs = elapsedMs;
  dispatchReconcileLastActor = typeof input === "number" ? "reconciler" : input.actor ?? "reconciler";
}

/** Internal: last reconcile-tick timestamp for duration calculations. */
let dispatchReconcileLastTick = Date.now();

/** Internal gauge: highest edge count swept on the last reconcile tick. */
let dispatchReconcileSweptGauge = 0;

/** Internal: last duration observed (ms). */
let dispatchReconcileLastDurationMs = 0;

/** Internal: actor for the last reconcile observation. */
let dispatchReconcileLastActor = "reconciler";

/**
 * Per-edge current-tier gauge. Used by `renderPrometheusText` and by the OTel
 * bridge to expose `dispatch_current_tier{edge_name="..."}`.
 */
const currentTierByEdge: Map<string, Tier> = new Map();

export function setCurrentTier(edge: string, tier: Tier): void {
  currentTierByEdge.set(edge, tier);
}

export function getCurrentTier(edge: string): Tier | undefined {
  return currentTierByEdge.get(edge);
}

export function listCurrentTiers(): ReadonlyArray<{ edge: string; tier: Tier }> {
  return Array.from(currentTierByEdge.entries()).map(([edge, tier]) => ({ edge, tier }));
}

/**
 * Aggregated snapshot of every metric the OTel bridge needs to push.
 * Counters, gauges, and histograms each get a dedicated entry; labels are
 * the exact `key=value` pairs Prometheus/OTel would expect.
 */
export interface MetricSnapshot {
  name: string;
  help?: string;
  type: "counter" | "gauge" | "histogram";
  labels?: Array<{ name: string; value: string }>;
  value?: number;
  count?: number;
  buckets?: Array<{ le: number; count: number }>;
}

function snapshotLabelPair(
  parts: Record<string, string>,
): Array<{ name: string; value: string }> {
  return Object.entries(parts).map(([name, value]) => ({ name, value }));
}

export function listMetricSnapshots(): MetricSnapshot[] {
  const m = ensureMetrics();
  const out: MetricSnapshot[] = [];
  for (const [key, value] of m.decisionsByLabel.entries()) {
    const labels = snapshotLabelPair(
      Object.fromEntries(key.split("|").map((kv) => kv.split("=", 2)) as Array<[string, string]>),
    );
    out.push({
      name: "dispatch_tier_decisions_total",
      help: "Number of dispatch edge tier-change decisions.",
      type: "counter",
      labels,
      value: value.count,
    });
  }
  for (const [edge, tier] of currentTierByEdge.entries()) {
    out.push({
      name: "dispatch_current_tier",
      help: "Current tier per dispatch edge (1=T1, 2=T2, 3=T3).",
      type: "gauge",
      labels: [{ name: "edge", value: edge }],
      value: tier === "T1" ? 1 : tier === "T2" ? 2 : 3,
    });
  }
  for (const [key, value] of m.observeMs.entries()) {
    const labels = snapshotLabelPair(
      Object.fromEntries(key.split("|").map((kv) => kv.split("=", 2)) as Array<[string, string]>),
    );
    out.push({
      name: "dispatch_tier_decision_duration_us",
      help: "Latency buckets per dispatch edge resolution.",
      type: "histogram",
      labels,
      count: value.count,
      value: value.sum,
      buckets: value.buckets.map((c, i) => ({ le: LATENCY_BUCKETS_US[i], count: c })),
    });
  }
  return out;
}

/**
 * Reset the metrics sink. Test-only.
 */
export function __resetMetricsForTests(): void {
  metrics = null;
  currentTierByEdge.clear();
  dispatchReconcileLastTick = Date.now();
  dispatchReconcileLastDurationMs = 0;
  dispatchReconcileSweptGauge = 0;
  otelDecisionCounter = null;
  otelDecisionDurationHistogram = null;
}

/**
 * Render the metrics in Prometheus text-exposition format. Strips label
 * newlines for safety.
 */
export function renderPrometheusText(): string {
  const m = ensureMetrics();
  const lines: string[] = [];
  // # HELP / # TYPE
  lines.push("# HELP dispatch_tier_decisions_total Number of dispatch edge tier-change decisions.");
  lines.push("# TYPE dispatch_tier_decisions_total counter");
  for (const [key, value] of m.decisionsByLabel.entries()) {
    const labels = key
      .split("|")
      .map((kv) => {
        const [k, v] = kv.split("=", 2);
        return `${k}="${escapeLabelValue(v)}"`;
      })
      .join(",");
    lines.push(`dispatch_tier_decisions_total{${labels}} ${value.count}`);
  }

  lines.push("# HELP dispatch_tier_decision_seconds Sum of seconds spent in tier decisions.");
  lines.push("# TYPE dispatch_tier_decision_seconds counter");
  for (const [key, value] of m.decisionsByLabel.entries()) {
    const labels = key
      .split("|")
      .map((kv) => {
        const [k, v] = kv.split("=", 2);
        return `${k}="${escapeLabelValue(v)}"`;
      })
      .join(",");
    lines.push(`dispatch_tier_decision_seconds_total{${labels}} ${(value.totalMs / 1000).toFixed(6)}`);
  }

  lines.push("# HELP dispatch_tier_decision_duration_us Latency buckets per edge/new_tier.");
  lines.push("# TYPE dispatch_tier_decision_duration_us histogram");
  for (const [key, value] of m.observeMs.entries()) {
    const labels = key
      .split("|")
      .map((kv) => {
        const [k, v] = kv.split("=", 2);
        return `${k}="${escapeLabelValue(v)}"`;
      })
      .join(",");
    for (let i = 0; i < LATENCY_BUCKETS_US.length; i++) {
      const bucketLabel = `${labels},le="${LATENCY_BUCKETS_US[i]}"`;
      lines.push(`dispatch_tier_decision_duration_us_bucket{${bucketLabel}} ${value.buckets[i]}`);
    }
    lines.push(`dispatch_tier_decision_duration_us_bucket{${labels},le="+Inf"} ${value.count}`);
    lines.push(`dispatch_tier_decision_duration_us_sum{${labels}} ${(value.sum * 1000).toFixed(3)}`);
    lines.push(`dispatch_tier_decision_duration_us_count{${labels}} ${value.count}`);
  }

  return lines.join("\n") + "\n";
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/**
 * Start an HTTP server that serves `/metrics` text-exposition. Returns
 * `null` if the port is busy (so callers can fall through to a metrics
 * gateway instead of failing boot).
 *
 * Listens on `127.0.0.1:<port>` by default. Override via
 * `OMNIROUTE_METRICS_HOST` and `OMNIROUTE_METRICS_PORT`.
 */
export async function startMetricsEndpoint(): Promise<{
  port: number;
  close(): Promise<void>;
} | null> {
  const host = process.env.OMNIROUTE_METRICS_HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.OMNIROUTE_METRICS_PORT ?? "9095", 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return null;
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("method not allowed\n");
      return;
    }
    if (req.url && req.url.startsWith("/healthz")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok\n");
      return;
    }
    if (req.url && req.url.startsWith("/metrics")) {
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(renderPrometheusText());
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found\n");
  });

  return await new Promise((resolve) => {
    let settled = false;
    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      // EADDRINUSE: another process is serving metrics on this port. Treat
      // as graceful; the caller can shut down the second server.
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        resolve(null);
      } else {
        resolve(null);
      }
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      if (settled) return;
      settled = true;
      server.off("error", onError);
      resolve({
        port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
