/**
 * Observability barrel — the single import surface for the OmniRoute
 * observability stack. Re-exports from `otel.ts`, `metrics.ts`,
 * `logger.ts`, `auto.ts`, `proxySpan.ts`, `traceparent.ts`,
 * `withTraceparent.ts`, `resource.ts`, `spanTypes.ts`, and
 * `otlpExporter.ts`.
 *
 * Consumers should always import from `@/lib/observability` rather than
 * the individual files so the barrel can rearrange internals without
 * breaking callers.
 *
 * `initTelemetry()` boots the stack. After it runs:
 *   - spans are tracked in AsyncLocalStorage
 *   - metrics are accumulated in the singleton registry
 *   - the logger auto-correlates with the active span
 *   - OTLP exports (if enabled) go out via the registered exporter
 *
 * The barrel also exposes the W3C trace-context helpers
 * (`parseTraceParent`, `buildTraceParent`, `injectTraceParent`,
 * `extractTraceParent`) and the fetch wrapper `withTraceparent` for
 * callers that need fine-grained control.
 */

export type {
  Resource,
  Span,
  SpanContext,
  SpanEvent,
  SpanKind,
  SpanLink,
  SpanOptions,
  SpanStatusCode,
  Tracer,
} from "./spanTypes.ts";

export {
  initTelemetry,
  shutdownTelemetry,
  setExporter,
  isTelemetryEnabled,
  getResource,
  getTracer,
  startSpan,
  withSpan,
  currentSpan,
  currentTraceId,
  currentSpanId,
  setAttribute,
  setAttributes,
  addEvent,
  recordException,
  setSpanStatus,
  endSpan,
} from "./otel.ts";

export { detectResource, parseResourceAttributes, withResourceAttributes } from "./resource.ts";

export {
  MAX_LABEL_VALUES,
  Counter,
  Gauge,
  Histogram,
  Summary,
  MetricsRegistry,
  metricsRegistry,
  httpMetricsMiddleware,
  recordProviderAttempt,
  recordProviderDuration,
  recordCacheHit,
  recordCacheMiss,
  recordQuotaRemaining,
  recordQuotaLimit,
  setProcessMetrics,
} from "./metrics.ts";

export {
  LOG_LEVELS,
  createLogger,
  getLogger,
  configure,
  setSink,
  getSink,
} from "./logger.ts";
export type { LogLevel, LogMode, LogRecord, LogSink, Logger } from "./logger.ts";

export {
  KNOWN_CACHE_LAYERS,
  isKnownCacheLayer,
  instrumentFetch,
  instrumentDb,
  instrumentCache,
  instrumentProvider,
  recordExceptionSafe,
  logWithTrace,
} from "./auto.ts";

export {
  withProxySpan,
  propagateTraceParent,
  isProxySpanResult,
  captureActiveSpanMeta,
} from "./proxySpan.ts";
export type { ProxySpanResult } from "./proxySpan.ts";

export {
  parseTraceParent,
  buildTraceParent,
  injectTraceParent,
  extractTraceParent,
} from "./traceparent.ts";
export type { TraceParent } from "./traceparent.ts";

export {
  withTraceparent,
  defaultFetchBuilder,
  injectIntoRequestInit,
} from "./withTraceparent.ts";
export type { WithTraceparentOptions, FetchRequestBuilder } from "./withTraceparent.ts";

export { OtlpExporter, serializeSpans } from "./otlpExporter.ts";
export type { OtlpExporterOptions } from "./otlpExporter.ts";