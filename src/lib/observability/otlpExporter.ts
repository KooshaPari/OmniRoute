/**
 * OTLP/HTTP JSON exporter — ships spans to a collector over fetch with
 * gzip compression and retry-with-backoff.
 *
 * Implements the OTLP/HTTP JSON over HTTP 1.1 spec:
 *   POST {endpoint}/v1/traces  Content-Type: application/json  (gzip body)
 *
 * Batches spans in a single queue with a fixed-size flush trigger so we
 * don't spam the collector on the proxy hot path. Failures retry with
 * exponential backoff up to {@link MAX_RETRIES}; exhausted batches are
 * dropped (telemetry must NEVER break the caller).
 *
 * We deliberately do NOT depend on @opentelemetry/exporter-trace-otlp-http.
 * The OTel exporter pulls in ~600KB of transitive deps, has its own
 * batching and retry policy, and is overkill for our single-process
 * collector target. Manual implementation gives us explicit control over
 * gzip thresholds and retry budgets — both of which matter in our hot
 * path.
 *
 * Spec reference:
 *   https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 *   https://opentelemetry.io/docs/specs/otlp/#http-request
 */

import type { Resource, Span, SpanEvent } from "./spanTypes.ts";

/**
 * Tunables for the exporter. All fields optional — sensible defaults
 * handle the common "ship to localhost:4318" case.
 */
export interface OtlpExporterOptions {
  /** Base OTLP/HTTP endpoint, e.g. "http://localhost:4318". */
  readonly endpoint?: string;
  /** Custom fetch impl — used by tests to mock the network. */
  readonly fetchImpl?: typeof fetch;
  /** Flush threshold: export once this many spans are queued. */
  readonly batchSize?: number;
  /** Flush interval in ms (also triggers on this cadence). */
  readonly flushIntervalMs?: number;
  /** Max retry attempts per batch. */
  readonly maxRetries?: number;
  /** Initial backoff delay in ms (doubled on each retry). */
  readonly initialBackoffMs?: number;
  /** Gzip body when larger than this many bytes; 0 = always gzip. */
  readonly gzipThreshold?: number;
  /** AbortSignal for the export call (e.g. shutdown). */
  readonly signal?: AbortSignal;
  /** Extra headers to attach (auth tokens, collector routing, …). */
  readonly headers?: Readonly<Record<string, string>>;
}

const DEFAULT_ENDPOINT = "http://localhost:4318";
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 250;
const DEFAULT_GZIP_THRESHOLD = 1024;

/**
 * Per-OTLP/HTTP, the request URL is `<endpoint>/v1/traces` (or
 * `<endpoint>/` if the user supplied the trailing path). We accept either
 * form and normalize.
 */
function buildTracesUrl(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/traces")) return trimmed;
  return `${trimmed}/v1/traces`;
}

/**
 * Internal queue + flush state. Single instance per OtlpExporter.
 */
interface ExporterState {
  queue: Span[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

/**
 * The OTLP/HTTP JSON exporter. Construct one per process and pass its
 * `exportSpans` to `setExporter()` (otel.ts). Use {@link OtlpExporter}
 * as the all-in-one wrapper.
 */
export class OtlpExporter {
  private readonly endpoint: string;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly gzipThreshold: number;
  private readonly baseHeaders: Record<string, string>;
  private readonly state: ExporterState;
  private readonly resource: Resource;

  constructor(resource: Resource, opts: OtlpExporterOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.url = buildTracesUrl(this.endpoint);
    this.fetchImpl = opts.fetchImpl ?? (globalThis as { fetch?: typeof fetch }).fetch ?? fetch;
    this.batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = opts.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialBackoffMs = opts.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.gzipThreshold = opts.gzipThreshold ?? DEFAULT_GZIP_THRESHOLD;
    this.baseHeaders = {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    };
    this.resource = resource;
    this.state = { queue: [], flushTimer: null, closed: false };
  }

  /**
   * Sink compatible with `setExporter` — appends to the queue and
   * triggers a flush if the batch threshold is reached.
   */
  exportSpans = async (spans: readonly Span[]): Promise<void> => {
    if (this.state.closed) return;
    if (spans.length === 0) return;
    this.state.queue.push(...spans);
    if (this.state.queue.length >= this.batchSize) {
      await this.flush();
    } else if (this.state.flushTimer === null) {
      this.scheduleFlush();
    }
  };

  /**
   * Drain the queue and POST to the collector. Safe to call
   * concurrently — the second caller observes an empty queue and returns
   * immediately.
   */
  async flush(): Promise<void> {
    if (this.state.flushTimer !== null) {
      clearTimeout(this.state.flushTimer);
      this.state.flushTimer = null;
    }
    if (this.state.queue.length === 0) return;
    const batch = this.state.queue;
    this.state.queue = [];
    const body = serializeSpans(this.resource, batch);
    await this.sendWithRetry(body);
  }

  /**
   * Tear down the exporter: cancel pending timer and flush remaining
   * spans synchronously (best-effort).
   */
  async shutdown(): Promise<void> {
    this.state.closed = true;
    if (this.state.flushTimer !== null) {
      clearTimeout(this.state.flushTimer);
      this.state.flushTimer = null;
    }
    if (this.state.queue.length === 0) return;
    const batch = this.state.queue;
    this.state.queue = [];
    const body = serializeSpans(this.resource, batch);
    try {
      await this.send(body);
    } catch {
      /* shutdown must not throw */
    }
  }

  /* ──────────────── internals ──────────────── */

  private scheduleFlush(): void {
    this.state.flushTimer = setTimeout(() => {
      this.state.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
    if (typeof this.state.flushTimer === "object" && this.state.flushTimer !== null) {
      // Node timer objects expose `unref()` so the flush timer doesn't
      // hold the event loop open at shutdown. Cast through unknown to
      // avoid hard-coupling to the Node-specific type.
      (this.state.flushTimer as { unref?: () => void }).unref?.();
    }
  }

  private async sendWithRetry(body: Uint8Array): Promise<void> {
    let attempt = 0;
    let delay = this.initialBackoffMs;
    // Loop bounded by maxRetries; explicit check + break is clearer than
    // a counted `for` here because the body can throw transiently.
    while (true) {
      try {
        await this.send(body);
        return;
      } catch (err) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          // Give up silently — log is the caller's problem.
          return;
        }
        // Honor AbortSignal / closed state on retry.
        if (this.state.closed) return;
        await sleep(delay);
        delay = Math.min(delay * 2, 5_000);
        // Reference err so it isn't dropped silently when debugging.
        if (err === undefined) {
          return;
        }
      }
    }
  }

  private async send(body: Uint8Array): Promise<void> {
    const headers: Record<string, string> = { ...this.baseHeaders };
    let payload: BodyInit = body;
    if (body.length >= this.gzipThreshold) {
      const gz = await gzip(body);
      payload = gz;
      headers["Content-Encoding"] = "gzip";
    }
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers,
      body: payload,
    });
    if (!res.ok) {
      // Drain the response body to release the socket. We deliberately
      // don't include the body in the thrown error to avoid huge error
      // messages from a misconfigured collector.
      try {
        await res.arrayBuffer();
      } catch {
        /* body drain failures are non-fatal */
      }
      throw new Error(`OTLP export failed: HTTP ${res.status}`);
    }
  }
}

/**
 * Serialize a batch of spans into the OTLP/HTTP JSON envelope:
 *   { resourceSpans: [{ resource: {...}, scopeSpans: [{ scope: {...},
 *     spans: [...] }] }] }
 *
 * We collapse every span into a single scope because we don't yet have a
 * scope-per-tracer abstraction. The collector is fine with this — it
 * just produces a single instrumentation scope per resource.
 */
export function serializeSpans(resource: Resource, spans: readonly Span[]): Uint8Array {
  const envelope = {
    resourceSpans: [
      {
        resource: {
          attributes: resourceToAttributes(resource),
        },
        scopeSpans: [
          {
            scope: {
              name: "@omniroute/observability",
              version: "1.0.0",
            },
            spans: spans.map(spanToOtlp),
          },
        ],
      },
    ],
  };
  const json = JSON.stringify(envelope);
  return new TextEncoder().encode(json);
}

/**
 * Convert a Resource into the OTLP attribute array shape. Boolean / number
 * attribute types are NOT produced (OTel only supports string in resource
 * attributes per spec; typed values go on the span attributes).
 */
function resourceToAttributes(resource: Resource): Array<{ key: string; value: { stringValue: string } }> {
  const out: Array<{ key: string; value: { stringValue: string } }> = [
    { key: "service.name", value: { stringValue: resource.serviceName } },
    { key: "service.version", value: { stringValue: resource.serviceVersion } },
    {
      key: "deployment.environment",
      value: { stringValue: resource.deploymentEnvironment },
    },
    { key: "process.pid", value: { stringValue: String(resource.processPid) } },
    {
      key: "process.runtime.name",
      value: { stringValue: resource.processRuntimeName },
    },
    {
      key: "process.runtime.version",
      value: { stringValue: resource.processRuntimeVersion },
    },
    { key: "host.name", value: { stringValue: resource.hostName } },
  ];
  for (const [k, v] of Object.entries(resource.attributes)) {
    out.push({ key: k, value: { stringValue: v } });
  }
  return out;
}

/**
 * Convert an internal Span into the OTLP span shape. Names match the OTel
 * proto JSON field names so collectors can deserialize without custom
 * decoding logic.
 */
function spanToOtlp(span: Span): Record<string, unknown> {
  const attributes = spanAttributesToOtlp(span.attributes);
  const events = span.events.map(spanEventToOtlp);
  const status = { code: statusCodeToOtlp(span.status), message: span.statusMessage || undefined };
  return {
    traceId: span.context.traceId,
    spanId: span.context.spanId,
    parentSpanId: span.parentSpanContext?.spanId ?? undefined,
    name: span.name,
    kind: spanKindToOtlp(span.kind),
    startTimeUnixNano: msToUnixNano(span.startTime),
    endTimeUnixNano: span.endTime === null ? undefined : msToUnixNano(span.endTime),
    attributes,
    events,
    status,
    flags: span.context.traceFlags,
    traceState: undefined,
    links: [],
  };
}

function spanAttributesToOtlp(
  attrs: Readonly<Record<string, string | number | boolean>>
): Array<{ key: string; value: Record<string, unknown> }> {
  const out: Array<{ key: string; value: Record<string, unknown> }> = [];
  for (const [k, v] of Object.entries(attrs)) {
    out.push({ key: k, value: attributeValue(v) });
  }
  return out;
}

function attributeValue(v: string | number | boolean): Record<string, unknown> {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { boolValue: v };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { stringValue: String(v) };
    // Integer vs double detection per OTLP — integers are encoded as a
    // separate value so consumers can downcast.
    if (Number.isInteger(v) && Math.abs(v) < 2 ** 53) return { intValue: String(v) };
    return { doubleValue: v };
  }
  // Unreachable; keep the type system honest.
  return { stringValue: String(v) };
}

function spanEventToOtlp(event: SpanEvent): Record<string, unknown> {
  return {
    timeUnixNano: msToUnixNano(event.time),
    name: event.name,
    attributes: spanAttributesToOtlp(event.attributes),
  };
}

function spanKindToOtlp(kind: Span["kind"]): number {
  switch (kind) {
    case "INTERNAL":
      return 1;
    case "SERVER":
      return 2;
    case "CLIENT":
      return 3;
    case "PRODUCER":
      return 4;
    case "CONSUMER":
      return 5;
    default:
      return 0;
  }
}

function statusCodeToOtlp(status: Span["status"]): number {
  switch (status) {
    case "OK":
      return 1;
    case "ERROR":
      return 2;
    case "UNSET":
    default:
      return 0;
  }
}

function msToUnixNano(ms: number): string {
  // OTel uses unsigned 64-bit nanoseconds. JS numbers can't represent the
  // full range but our timestamps are recent enough that they're safe.
  return String(BigInt(ms) * 1_000_000n);
}

/**
 * Tiny gzip helper. Wraps the CompressionStream API (Node ≥ 18, all
 * modern browsers). We avoid pulling in `pako` for one operation; the
 * platform API is sufficient.
 */
async function gzip(input: Uint8Array): Promise<Uint8Array> {
  const cs = new (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  void (async () => {
    try {
      await reader.read().then(async function pump({ value, done }): Promise<void> {
        if (done) return;
        if (value) chunks.push(value);
        await pump(await reader.read());
      });
    } catch {
      /* pump is best-effort */
    }
  })();
  await writer.write(input);
  await writer.close();
  // Drain the rest of the readable stream synchronously by awaiting one
  // final read. Done this way (vs. async pump) to keep the API linear
  // for callers.
  const final = await reader.read();
  if (!final.done && final.value) chunks.push(final.value);
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}