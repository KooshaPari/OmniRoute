/**
 * OTel-compatible Prometheus exporter bridge (ADR-032 / Option A).
 *
 * Polls the in-process `dispatch` metrics sink on a fixed interval and
 * pushes the snapshot to an OTLP HTTP endpoint. Mirrors the `/metrics`
 * text scrape that `metricsRoute.ts` already exposes, but in push-mode for
 * environments without a Prometheus scraper.
 *
 * Config (env):
 *   OMNIROUTE_OTLP_ENDPOINT          target URL, e.g. "http://otel-collector:4318/v1/metrics"
 *   OMNIROUTE_OTLP_PUSH_INTERVAL_MS  push interval (default: 10000)
 *   OMNIROUTE_OTLP_PUSH_TIMEOUT_MS   per-push HTTP timeout (default: 5000)
 *   OMNIROUTE_OTLP_RESOURCE_ATTRIBUTES  JSON object merged as resource attributes
 *                                       e.g. '{"service.name":"omniroute","deployment.environment":"prod"}'
 *
 * Push body shape (OTLP/HTTP "metrics" ExportMetricsServiceRequest):
 *   {
 *     "resourceMetrics": [{
 *       "resource": { "attributes": [{ "key": "service.name", "value": { "stringValue": "omniroute" } }] },
 *       "scopeMetrics": [{
 *         "scope": { "name": "omniroute.dispatch" },
 *         "metrics": [
 *           { "name": "dispatch_tier_decisions_total",
 *             "sum": { "dataPoints": [{ "asInt": "12", "attributes": [...] }] } },
 *           { "name": "dispatch_current_tier", "gauge": ... },
 *           { "name": "dispatch_tier_decisions_duration_seconds",
 *             "histogram": { "dataPoints": [{ "count": "1", "sum": 0.001, "bucketCounts": [...], "explicitBounds": [...] }] } }
 *         ]
 *       }]
 *     }]
 *   }
 *
 * When the endpoint is unset, the bridge is a no-op (`getOtelPushStatus` returns
 * `{ enabled: false }`). This keeps the boot path zero-cost for deployments
 * that use the scrape endpoint instead.
 */

import { renderPrometheusText, listMetricSnapshots, type MetricSnapshot } from "./metrics.ts";
import type { Counter, Meter } from "@opentelemetry/api";

export interface OtelPushConfig {
  endpoint: string;
  intervalMs: number;
  timeoutMs: number;
  resourceAttributes: Record<string, string>;
}

export interface OtelPushStatus {
  enabled: boolean;
  endpoint: string | null;
  lastPushAt: number | null;
  lastPushOk: boolean;
  lastError: string | null;
  pushesSent: number;
  pushesFailed: number;
}

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5_000;

function loadConfig(): OtelPushConfig | null {
  const endpoint = process.env.OMNIROUTE_OTLP_ENDPOINT;
  if (!endpoint) return null;
  const intervalMs = Number.parseInt(process.env.OMNIROUTE_OTLP_PUSH_INTERVAL_MS ?? "", 10) || DEFAULT_INTERVAL_MS;
  const timeoutMs = Number.parseInt(process.env.OMNIROUTE_OTLP_PUSH_TIMEOUT_MS ?? "", 10) || DEFAULT_TIMEOUT_MS;
  let resourceAttributes: Record<string, string> = { "service.name": "omniroute" };
  if (process.env.OMNIROUTE_OTLP_RESOURCE_ATTRIBUTES) {
    try {
      const parsed = JSON.parse(process.env.OMNIROUTE_OTLP_RESOURCE_ATTRIBUTES);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        resourceAttributes = { ...resourceAttributes, ...(parsed as Record<string, string>) };
      }
    } catch {
      // Bad JSON — fall back to defaults.
    }
  }
  return { endpoint, intervalMs, timeoutMs, resourceAttributes };
}

const state: OtelPushStatus = {
  enabled: false,
  endpoint: null,
  lastPushAt: null,
  lastPushOk: false,
  lastError: null,
  pushesSent: 0,
  pushesFailed: 0,
};

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Convert an in-process metric snapshot to an OTLP metric wire-format entry.
 *   - Counter  → `sum` (monotonic, no aggregationTemporality set here)
 *   - Gauge    → `gauge`
 *   - Histogram → `histogram` with bucket counts + bounds
 */
function toOtelMetric(snap: MetricSnapshot): Record<string, unknown> {
  const base = { name: snap.name, description: snap.help ?? "" };
  const attributes = (snap.labels ?? []).map((label) => ({
    key: label.name,
    value: { stringValue: String(label.value) },
  }));
  const dataPoints = [
    {
      attributes,
      // OTLP wire uses string-encoded integers for sum/gauge counts.
      asInt: typeof snap.value === "number" ? String(Math.trunc(snap.value)) : "0",
    },
  ];
  if (snap.type === "counter") {
    return { ...base, sum: { aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE", dataPoints } };
  }
  if (snap.type === "histogram") {
    return {
      ...base,
      histogram: {
        aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
        dataPoints: [
          {
            attributes,
            count: String(snap.count ?? 0),
            sum: typeof snap.value === "number" ? snap.value : 0,
            bucketCounts: (snap.buckets ?? []).map((b) => String(b.count)),
            explicitBounds: (snap.buckets ?? []).map((b) => b.le),
          },
        ],
      },
    };
  }
  return { ...base, gauge: { dataPoints } };
}

function buildOtelRequest(config: OtelPushConfig, snapshots: MetricSnapshot[]): Record<string, unknown> {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: Object.entries(config.resourceAttributes).map(([key, value]) => ({
            key,
            value: { stringValue: value },
          })),
        },
        scopeMetrics: [
          {
            scope: { name: "omniroute.dispatch", version: "1.0.0" },
            metrics: snapshots.map(toOtelMetric),
          },
        ],
      },
    ],
  };
}

async function pushOnce(config: OtelPushConfig, snapshots: MetricSnapshot[]): Promise<void> {
  const body = JSON.stringify(buildOtelRequest(config, snapshots));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`OTLP push returned HTTP ${res.status}: ${await res.text()}`);
    }
    state.lastPushAt = Date.now();
    state.lastPushOk = true;
    state.lastError = null;
    state.pushesSent += 1;
  } catch (error) {
    state.lastPushAt = Date.now();
    state.lastPushOk = false;
    state.lastError = error instanceof Error ? error.message : String(error);
    state.pushesFailed += 1;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Start the OTLP push loop. Idempotent — safe to call from `src/server-init.ts`.
 * No-op when `OMNIROUTE_OTLP_ENDPOINT` is unset.
 */
export function startOtelPush(): void {
  if (intervalHandle) return;
  const config = loadConfig();
  if (!config) return;
  state.enabled = true;
  state.endpoint = config.endpoint;
  // Fire once on boot so dashboards have data immediately.
  void pushOnce(config, listMetricSnapshots()).catch(() => {
    /* state already updated; next tick will retry */
  });
  intervalHandle = setInterval(() => {
    void pushOnce(config, listMetricSnapshots()).catch(() => {
      /* state already updated; next tick will retry */
    });
  }, config.intervalMs);
  if (typeof intervalHandle === "object" && intervalHandle !== null && "unref" in intervalHandle) {
    (intervalHandle as { unref: () => void }).unref();
  }
}

export function stopOtelPush(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  state.enabled = false;
}

export function getOtelPushStatus(): OtelPushStatus {
  return { ...state };
}

/**
 * Test-only: reset push state. Production code never calls this.
 */
export function __resetOtelPushForTests(): void {
  stopOtelPush();
  state.endpoint = null;
  state.lastPushAt = null;
  state.lastPushOk = false;
  state.lastError = null;
  state.pushesSent = 0;
  state.pushesFailed = 0;
}

/**
 * Manual one-shot push (bypasses the interval). Used by the CLI / smoke
 * tests; safe to call even when no endpoint is configured (returns
 * `null` for parity with the metrics renderer).
 */
export async function pushMetricsNow(): Promise<OtelPushStatus | null> {
  const config = loadConfig();
  if (!config) return null;
  await pushOnce(config, listMetricSnapshots());
  return getOtelPushStatus();
}

/**
 * Build the OTLP request body from the current in-process snapshots without
 * pushing. Useful for offline tooling and golden-file regression tests.
 */
export function buildOtelRequestFromConfig(config: OtelPushConfig): Record<string, unknown> {
  return buildOtelRequest(config, listMetricSnapshots());
}

// Re-export the Prometheus text renderer for the `metrics` route which serves
// the same data via the pull model. Both transports can run side-by-side.
export { renderPrometheusText };
