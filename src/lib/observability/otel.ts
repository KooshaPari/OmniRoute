/**
 * Active-span stack + tracer API.
 *
 * Implements an OTel-compatible context manager using AsyncLocalStorage so
 * the active span (and therefore traceId/spanId) is automatically carried
 * across `await` boundaries and across the boundary into nested
 * `instrumentXxx()` calls. Consumers do NOT need to thread the span
 * through call signatures — `currentTraceId()` / `currentSpanId()` read it
 * from the storage slot.
 *
 * Stub mode: when `OTEL_SDK_DISABLED=true` (the default), every span
 * allocation is a no-op object that records attributes/events into
 * in-memory Maps but never ships them to an exporter. This is the
 * "default off" posture so the stack costs zero in the steady-state
 * hot path until an operator explicitly opts in via env vars.
 *
 * Concurrency:
 *   - `withSpan` uses AsyncLocalStorage.run() so concurrent in-flight
 *     requests each see their own active span. No mutex needed.
 *   - `startSpan` does NOT push onto the stack — only `withSpan` does, so
 *     parallel sibling spans inside one parent don't trample each other.
 *   - The active span stack is bound to the AsyncLocalStorage frame, not
 *     to a global. Tests that want to inspect "what span is active
 *     outside any withSpan" must do so explicitly.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { detectResource } from "./resource.ts";
import type {
  Resource,
  Span,
  SpanContext,
  SpanEvent,
  SpanOptions,
  SpanStatusCode,
  Tracer,
} from "./spanTypes.ts";

/**
 * W3C `version-format` for trace IDs and span IDs. We enforce these
 * lengths on the generate path so consumers can rely on `traceId.length
 * === 32` and `spanId.length === 16` invariants without per-call checks.
 */
const TRACE_ID_HEX_LENGTH = 32;
const SPAN_ID_HEX_LENGTH = 16;
const TRACE_FLAG_SAMPLED = 0x01;

/**
 * Storage frame carried through AsyncLocalStorage. Holds the active span
 * (if any) and its trace context — both are the SAME span for the common
 * case where the active span IS the trace root; for nested spans we read
 * `activeSpan.context` to recover the trace.
 */
interface Frame {
  readonly activeSpan: Span | null;
}

/**
 * The single AsyncLocalStorage<Frame> that holds the active span per
 * async context. Created lazily so the module is importable in Edge
 * runtime / test environments where AsyncLocalStorage behavior differs.
 */
const storage: AsyncLocalStorage<Frame> = new AsyncLocalStorage<Frame>();

/**
 * Module-level resource (set by `initTelemetry`). All tracers created
 * AFTER `initTelemetry` reference this resource; pre-init calls produce
 * spans with a placeholder resource so the API never throws.
 */
let currentResource: Resource = placeholderResource();

/**
 * Module-level "telemetry enabled" flag. When false, span allocation is a
 * no-op and exporters are skipped. `initTelemetry()` reads this from env.
 */
let enabled = false;

/**
 * Optional exporter callback registered by `initTelemetry`. Spans are
 * dispatched here after `end()` if telemetry is enabled AND the span is
 * sampled. Set via {@link setExporter}.
 */
type ExporterSink = (spans: readonly Span[]) => void | Promise<void>;
let exporterSink: ExporterSink | null = null;

/**
 * Default tracer name used by {@link getTracer} when none is supplied.
 * Kept stable across the codebase so log correlation works without
 * specifying the name explicitly.
 */
const DEFAULT_TRACER_NAME = "@omniroute/observability";
const DEFAULT_TRACER_VERSION = "1.0.0";

/**
 * A symbol used by `withSpan` to identify the spans it pushed so it can
 * pop exactly those on exit. Carried on `Span.__stackToken`.
 */
const STACK_TOKEN = Symbol("otel.withSpan.token");

/* ──────────────── public initialization API ──────────────── */

/**
 * Initialize the OTel stack. Reads `OTEL_SDK_DISABLED`, builds the
 * Resource via the detector, and (optionally) registers an exporter.
 *
 * Safe to call multiple times — the second call refreshes the resource
 * from env (useful in tests that mutate env between cases) but does NOT
 * create a new AsyncLocalStorage instance (Node only supports one per
 * scope).
 *
 * @returns the detected Resource, for callers that want to attach it to
 *          structured logs / boot-time telemetry markers.
 */
export function initTelemetry(opts?: { exporter?: ExporterSink }): Resource {
  enabled = !readBoolEnv("OTEL_SDK_DISABLED");
  currentResource = buildResourceFromEnv();
  if (opts?.exporter) {
    exporterSink = opts.exporter;
  }
  return currentResource;
}

/**
 * Tear down the telemetry stack. Flushes any pending spans synchronously
 * to the registered exporter (best-effort) and resets module-level state.
 * The next call to {@link initTelemetry} re-arms cleanly.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (exporterSink) {
    try {
      await exporterSink([]);
    } catch {
      // exporter errors must never break shutdown — the goal is to release
      // any in-flight resources so the process can exit cleanly.
    }
    exporterSink = null;
  }
  enabled = false;
  currentResource = placeholderResource();
}

/**
 * Register (or replace) the exporter sink. Useful for tests that want to
 * capture spans without spinning up the OTLP exporter. The sink is called
 * synchronously from `end()` for sampled spans, but is awaited
 * asynchronously when shutdown() flushes the buffer.
 */
export function setExporter(sink: ExporterSink | null): void {
  exporterSink = sink;
}

/**
 * Read the current "telemetry enabled" flag. Cheap; safe to call from
 * hot paths. After `initTelemetry()`, this reflects the value of
 * `OTEL_SDK_DISABLED` at boot time.
 */
export function isTelemetryEnabled(): boolean {
  return enabled;
}

/**
 * Return the active Resource. Returned reference is frozen; consumers
 * must NOT mutate it.
 */
export function getResource(): Resource {
  return currentResource;
}

/* ──────────────── tracer API ──────────────── */

/**
 * Return a tracer scoped to a name + version. Tracers are cheap — no
 * allocation, just a small object literal — so callers should call this
 * per package and reuse the reference.
 */
export function getTracer(name: string = DEFAULT_TRACER_NAME, version: string = DEFAULT_TRACER_VERSION): Tracer {
  return Object.freeze({
    name,
    version,
    startSpan: (spanName, spanOpts) => startSpan(spanName, spanOpts),
    withSpan: <T>(spanName: string, fn: (span: Span) => Promise<T> | T, spanOpts?: SpanOptions) =>
      withSpan(spanName, fn, spanOpts),
  });
}

/**
 * Start a new span without pushing it onto the active context. Most
 * callers should prefer {@link withSpan}; this is for advanced use cases
 * where the caller wants to manage span lifecycle explicitly (e.g. ending
 * a span outside the request handler).
 *
 * The new span inherits the parent from the current active frame IF one
 * is set; otherwise the new span is a root. To force a root, pass
 * `opts.parent = null`.
 */
export function startSpan(name: string, opts?: SpanOptions): Span {
  const parent = resolveParent(opts?.parent);
  const ctx = newContext(parent);
  const sampled = opts?.sampled ?? ctx.sampled;
  const startTime = opts?.startTime ?? Date.now();
  const span: Span = {
    name,
    kind: opts?.kind ?? "INTERNAL",
    context: { ...ctx, sampled, isRemote: false },
    parentSpanContext: parent,
    startTime,
    resource: currentResource,
    attributes: { ...(opts?.attributes ?? {}) },
    events: [] as SpanEvent[],
    links: opts?.links ? [...opts.links] : [],
    status: "UNSET",
    statusMessage: "",
    ended: false,
    endTime: null,
    durationSeconds: null,
    exception: null,
    __stackToken: STACK_TOKEN,
  };
  return span;
}

/**
 * Push a new span onto the active context, run `fn`, then end the span
 * regardless of whether `fn` threw. Returns whatever `fn` returned (or
 * rethrows). If telemetry is disabled, runs `fn` with a no-op span so
 * callers get the same shape and the hot path stays branch-free.
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, opts?: SpanOptions): Promise<T> {
  const span = startSpan(name, opts);
  const frame: Frame = { activeSpan: span };
  const run = async (): Promise<T> => {
    try {
      const result = await fn(span);
      if (span.status === "UNSET") {
        span.status = "OK";
      }
      return result;
    } catch (err) {
      recordException(span, err);
      span.status = "ERROR";
      span.statusMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      endSpanInternal(span);
    }
  };
  return storage.run(frame, run) as Promise<T>;
}

/**
 * Read the active span (if any). Returns `null` if called outside any
 * `withSpan` frame.
 */
export function currentSpan(): Span | null {
  const frame = storage.getStore();
  return frame?.activeSpan ?? null;
}

/**
 * Return the traceId of the active span (or a fresh random 32-hex if no
 * span is active). The fallback is intentional — it lets logging
 * contexts that pre-date `withSpan` still emit a deterministic traceId
 * column, which materially helps log correlation in the JSON formatter.
 */
export function currentTraceId(): string {
  const span = currentSpan();
  if (span) return span.context.traceId;
  return generateTraceId();
}

/**
 * Return the spanId of the active span (or a fresh random 16-hex if no
 * span is active). See `currentTraceId()` for rationale.
 */
export function currentSpanId(): string {
  const span = currentSpan();
  if (span) return span.context.spanId;
  return generateSpanId();
}

/* ──────────────── span mutation API ──────────────── */

/**
 * Set a single attribute on a span. Returns the span for chaining. If
 * the span is already ended this is a no-op (the exporter sees a frozen
 * snapshot; late mutations would silently leak).
 */
export function setAttribute(
  span: Span,
  key: string,
  value: string | number | boolean
): Span {
  if (span.ended) return span;
  span.attributes = Object.freeze({ ...span.attributes, [key]: value });
  return span;
}

/**
 * Set many attributes in one call. Equivalent to calling
 * {@link setAttribute} repeatedly but avoids re-freezing the bag once
 * per key (allocation savings matter on hot paths like the proxy span).
 */
export function setAttributes(
  span: Span,
  attrs: Readonly<Record<string, string | number | boolean>>
): Span {
  if (span.ended) return span;
  if (Object.keys(attrs).length === 0) return span;
  span.attributes = Object.freeze({ ...span.attributes, ...attrs });
  return span;
}

/**
 * Record a structured event on the span. Events are appended in insertion
 * order and rendered into the OTLP `events` array on export. Late calls
 * (after `end()`) are dropped.
 */
export function addEvent(
  span: Span,
  name: string,
  attributes?: Readonly<Record<string, string | number | boolean>>,
  time?: number
): Span {
  if (span.ended) return span;
  const event: SpanEvent = Object.freeze({
    name,
    time: time ?? Date.now(),
    attributes: Object.freeze({ ...(attributes ?? {}) }),
  });
  span.events = [...span.events, event];
  return span;
}

/**
 * Attach an exception to a span per OTel conventions
 * (https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-spans/).
 *
 * Records the event `exception` and the attributes `exception.type`,
 * `exception.message`, and (if present) `exception.stacktrace`. We do
 * NOT change the span status here — callers should set status="ERROR"
 * explicitly so the policy lives in the call site (some errors are
 * expected and shouldn't make the span red).
 */
export function recordException(span: Span, err: unknown): Span {
  if (span.ended) return span;
  const type = err instanceof Error ? err.constructor.name : typeof err;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  span.exception = { type, message, stack };
  return addEvent(span, "exception", {
    "exception.type": type,
    "exception.message": message,
    ...(stack ? { "exception.stacktrace": stack } : {}),
  });
}

/**
 * Mark a span as failed with an optional message. Equivalent to
 * `span.status = "ERROR"; span.statusMessage = message`.
 */
export function setSpanStatus(span: Span, code: SpanStatusCode, message?: string): Span {
  if (span.ended) return span;
  span.status = code;
  span.statusMessage = message ?? "";
  return span;
}

/**
 * End the span. Computes the duration, marks `ended = true`, and (if
 * telemetry is enabled AND the span was sampled) dispatches to the
 * registered exporter. Safe to call multiple times — subsequent calls
 * are no-ops.
 */
export function endSpan(span: Span, endTime?: number): void {
  if (span.ended) return;
  endSpanInternal(span, endTime);
}

/* ──────────────── internal helpers ──────────────── */

function endSpanInternal(span: Span, endTime?: number): void {
  const t = endTime ?? Date.now();
  span.endTime = t;
  span.durationSeconds = Math.max(0, (t - span.startTime) / 1000);
  span.ended = true;
  if (!enabled) return;
  if (!span.context.sampled) return;
  if (!exporterSink) return;
  // Exporter errors are swallowed — telemetry must NEVER break the caller.
  // OTLP/HTTP failures are the exporter's problem to log + retry; we hand
  // off and forget.
  try {
    const r = exporterSink([span]);
    if (r && typeof (r as Promise<void>).catch === "function") {
      (r as Promise<void>).catch(() => {
        /* no-op */
      });
    }
  } catch {
    /* no-op */
  }
}

function resolveParent(explicit: SpanContext | null | undefined): SpanContext | null {
  if (explicit !== undefined) return explicit;
  const active = currentSpan();
  return active?.context ?? null;
}

function newContext(parent: SpanContext | null): SpanContext {
  if (parent) {
    return {
      traceId: parent.traceId,
      spanId: generateSpanId(),
      traceFlags: parent.traceFlags,
      isRemote: false,
      sampled: parent.sampled,
    };
  }
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    traceFlags: TRACE_FLAG_SAMPLED,
    isRemote: false,
    sampled: true,
  };
}

function generateTraceId(): string {
  return randomHex(TRACE_ID_HEX_LENGTH);
}

function generateSpanId(): string {
  return randomHex(SPAN_ID_HEX_LENGTH);
}

/**
 * Crypto-strong random hex of the requested length. Falls back to
 * `Math.random` only if `crypto.getRandomValues` is unavailable (Edge
 * runtime historically) so the API never throws on import.
 */
function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    s += h.length === 1 ? "0" + h : h;
  }
  return s.slice(0, length);
}

function readBoolEnv(name: string): boolean {
  const v = process.env[name];
  if (v === undefined) return false;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function buildResourceFromEnv(): Resource {
  return detectResource();
}

function placeholderResource(): Resource {
  return Object.freeze({
    serviceName: "omniroute",
    serviceVersion: "0.0.0",
    deploymentEnvironment: "development",
    processPid: process.pid,
    processRuntimeName: "node",
    processRuntimeVersion: process.versions.node ?? "unknown",
    hostName: "unknown",
    attributes: Object.freeze({}),
  });
}

/* ──────────────── export surface ──────────────── */

export const __TESTING__ = {
  storage,
  newContext,
  generateTraceId,
  generateSpanId,
  STACK_TOKEN,
  TRACE_FLAG_SAMPLED,
};