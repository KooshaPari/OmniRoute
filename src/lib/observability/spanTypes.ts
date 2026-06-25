/**
 * Core span type definitions for the OmniRoute observability stack.
 *
 * Modeled on the OpenTelemetry trace data model
 * (https://opentelemetry.io/docs/specs/otel/trace/api/#span) but stripped
 * down to the minimum surface needed by the proxy / relay / provider code
 * paths in this repo. We deliberately DO NOT depend on @opentelemetry/* —
 * this is a manual OTel-compatible implementation with stub mode by default.
 *
 * Every field is explicit; consumers can rely on structural typing without
 * surprise `undefined` propagation. Use `null` (not `undefined`) for fields
 * that are "not set" so they serialize predictably over OTLP.
 *
 * @see ./otel.ts for the active-span stack + tracer API
 * @see ./traceparent.ts for the W3C trace context wire format
 */

/**
 * Logical role of a span in a request lifecycle.
 *
 * Mirrors OTel SpanKind. SERVER/CLIENT pairs naturally around fetch
 * boundaries; INTERNAL is the default for in-process work; PRODUCER/CONSUMER
 * are reserved for future async messaging.
 */
export type SpanKind =
  | "INTERNAL"
  | "SERVER"
  | "CLIENT"
  | "PRODUCER"
  | "CONSUMER";

/**
 * Status of a span, per OTel. Only `OK` and `ERROR` are surfaced; `UNSET`
 * is the default for spans that have not been explicitly ended.
 */
export type SpanStatusCode = "UNSET" | "OK" | "ERROR";

/**
 * Describes the resource (service, version, environment, host) producing
 * telemetry. Read once at startup by the Resource detector; passed through
 * every Span/Metric as `resource` so collectors can attribute data
 * correctly without per-span tagging.
 */
export interface Resource {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly deploymentEnvironment: string;
  readonly processPid: number;
  readonly processRuntimeName: string;
  readonly processRuntimeVersion: string;
  readonly hostName: string;
  /** Free-form attributes merged from OTEL_RESOURCE_ATTRIBUTES (string-only). */
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * SpanContext is the immutable 32-byte identity that travels with the
 * `traceparent` header. Every Span owns exactly one SpanContext; a span
 * tree is linked via the `parentSpanContext` field on Span.
 *
 * `traceFlags` is the 1-byte W3C flags field; bit 0 (`01`) is the "sampled"
 * flag. We expose both the raw hex form and the parsed boolean for
 * convenience.
 */
export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
  readonly isRemote: boolean;
  readonly sampled: boolean;
}

/**
 * A structured event recorded during a span's lifetime. Modeled on OTel's
 * `Span.addEvent` API: a name, an optional timestamp (defaults to "now"),
 * and an arbitrary attribute bag. Kept stringly-typed on purpose because
 * events are typically rendered into JSON logs and Prometheus exemplars,
 * where typed payloads are overkill.
 */
export interface SpanEvent {
  readonly name: string;
  readonly time: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/**
 * A link to a span that is causally related but NOT a parent (e.g. a batch
 * span linking to the N individual operations it consumed). Modeled on
 * OTel `Span.addLink`. Stored as `links` on Span and serialized into OTLP.
 */
export interface SpanLink {
  readonly context: SpanContext;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Options accepted when starting a new span. All fields optional. The
 * `kind`, `attributes`, `links`, and `startTime` fields have safe defaults
 * (INTERNAL / {} / [] / Date.now()).
 */
export interface SpanOptions {
  readonly kind?: SpanKind;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly links?: readonly SpanLink[];
  readonly startTime?: number;
  readonly parent?: SpanContext | null;
  readonly sampled?: boolean;
}

/**
 * The public-facing Span handle. Most call sites only need `setAttribute`,
 * `addEvent`, `recordException`, and `end`. The full data tree (status,
 * events, links, attributes) is held internally until end(), at which point
 * the Span is sealed and dispatched to the exporter (if any).
 */
export interface Span {
  readonly name: string;
  readonly kind: SpanKind;
  readonly context: SpanContext;
  readonly parentSpanContext: SpanContext | null;
  readonly startTime: number;
  readonly resource: Resource;
  /** Mutable bag of attributes set via setAttribute / setAttributes. */
  attributes: Readonly<Record<string, string | number | boolean>>;
  /** Events recorded via addEvent; appended in insertion order. */
  events: readonly SpanEvent[];
  readonly links: readonly SpanLink[];
  status: SpanStatusCode;
  statusMessage: string;
  /** Internal — flipped to true the moment end() runs. */
  ended: boolean;
  /** Internal — set to the end timestamp once end() runs (Unix ms). */
  endTime: number | null;
  /** Internal — end duration in seconds (float). null until end(). */
  durationSeconds: number | null;
  /**
   * Optional exception captured via recordException. Held so the exporter
   * can attach `span.events[*].attributes['exception.*']` per OTel spec.
   */
  exception: { type: string; message: string; stack?: string } | null;
  /**
   * Optional reference back to the active-span-stack entry. Used by the
   * context manager so `withSpan` can pop exactly the span it pushed even
   * if the caller passed a different reference around. Set by `startSpan`.
   */
  readonly __stackToken?: symbol;
}

/**
 * Identity of a tracer — typically `"@omniroute/<package>"` — used to label
 * spans by their creating library. Set via `getTracer(name)` and recorded
 * as `instrumentation.scope.name` on exported spans.
 */
export interface Tracer {
  readonly name: string;
  readonly version: string;
  /** Start a new root span. Respects the active context as parent. */
  startSpan(name: string, opts?: SpanOptions): Span;
  /** Convenience wrapper: start a span, run `fn`, end the span on throw/return. */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, opts?: SpanOptions): Promise<T>;
}