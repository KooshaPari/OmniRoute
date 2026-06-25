/**
 * Structured logger — Pino-style JSON + pretty modes, with optional
 * trace correlation when an active span is present.
 *
 * Five severity levels per the pino contract: trace, debug, info, warn,
 * error. The default level is `info`; set via `LOG_LEVEL` env var.
 *
 * Output modes:
 *   - "json" (default) — one JSON object per line. Production-friendly;
 *     the field shape matches pino so existing log collectors Just Work.
 *   - "pretty" — colorized, human-readable. For local dev only; not
 *     suitable for log shipping.
 *
 * Child loggers: {@link child} returns a new logger with merged bindings.
 * Bindings are additive; the child retains the parent's transport.
 *
 * Trace correlation: when a span is active (see `otel.ts`), the emitted
 * log line carries `traceId` and `spanId` fields automatically. Operators
 * grep their JSON logs by traceId to follow a single request across all
 * the spans it produced.
 *
 * Why a manual logger: pino is great but pulls in thread-stream,
 * pino-abstract-transport, sonic-boom, etc. The proxy/relay needs ONE
 * log shape — we don't need transports, redaction, or hot config reload.
 * Hand-rolling keeps the import graph small and lets us pin the
 * correlation contract to our own otel module.
 */

import { currentTraceId, currentSpanId } from "./otel.ts";

/**
 * Numeric log levels — pino-compatible. Lower number = more verbose.
 * `trace` is 10, `fatal` is 60. The numeric ordering lets callers
 * implement `level < threshold` checks without per-level if/else trees.
 */
export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;
export type LogMode = "json" | "pretty";

/**
 * Log record shape — what {@link Logger} writes for each event.
 * Matches pino's JSON contract so log shippers don't need a custom parser.
 */
export interface LogRecord {
  readonly level: number;
  readonly time: number;
  readonly msg: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly [extra: string]: unknown;
}

/**
 * Sink interface — pluggable so the bootstrap can write to stdout (the
 * default) or to a file/network collector in tests.
 */
export type LogSink = (record: LogRecord) => void;

/**
 * Logger instance. Construct via {@link createLogger} or {@link getLogger};
 * clone with {@link child} for scoped bindings.
 */
export interface Logger {
  readonly level: LogLevel;
  readonly mode: LogMode;
  readonly bindings: Readonly<Record<string, unknown>>;
  trace(msg: string, extra?: Record<string, unknown>): void;
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  fatal(msg: string, extra?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
  /** Internal: emit a record at a specific level. Used by helpers. */
  emit(level: LogLevel, msg: string, extra?: Record<string, unknown>): void;
}

/**
 * Default sink writes to stdout (pretty → process.stdout, json → a single
 * console.log). Bound at module-load; tests override via setSink().
 */
let activeSink: LogSink = (record) => {
  const line = JSON.stringify(record);
  console.log(line);
};

let activeMode: LogMode = readModeFromEnv();
let activeLevel: LogLevel = readLevelFromEnv();

/**
 * Override the sink. Used by tests that want to capture log output
 * without polluting stdout. The previous sink is returned so callers can
 * restore it (matters in tests that mutate global state).
 */
export function setSink(sink: LogSink | null): LogSink {
  const prev = activeSink;
  if (sink === null) {
    activeSink = (record) => {
      const line = JSON.stringify(record);
      console.log(line);
    };
  } else {
    activeSink = sink;
  }
  return prev;
}

/**
 * Override the current mode + level. Both default to env vars
 * (`LOG_MODE`, `LOG_LEVEL`); programmatic override is for tests and for
 * the bootstrap to honor CLI flags.
 */
export function configure(opts: { level?: LogLevel; mode?: LogMode }): void {
  if (opts.level) activeLevel = opts.level;
  if (opts.mode) activeMode = opts.mode;
}

/**
 * Read the current sink/level/mode. Used by tests that want to restore
 * the previous state after mutating global state.
 */
export function getSink(): LogSink {
  return activeSink;
}

/**
 * Create a new logger with optional initial bindings.
 *
 * @param opts.name    — name emitted as `name` field on every record (e.g.
 *                       the package emitting the log)
 * @param opts.bindings — initial key/value pairs merged into every record
 * @param opts.level   — override the global level for THIS logger
 * @param opts.mode    — override the global mode for THIS logger
 */
export function createLogger(opts: {
  name?: string;
  bindings?: Record<string, unknown>;
  level?: LogLevel;
  mode?: LogMode;
}): Logger {
  const bindings: Record<string, unknown> = { ...(opts.bindings ?? {}) };
  if (opts.name) bindings["name"] = opts.name;
  return makeLogger({ bindings, level: opts.level, mode: opts.mode });
}

/**
 * Return the singleton "root" logger. Equivalent to
 * `createLogger({})` but cached so callers that don't pass bindings can
 * share a single instance.
 */
let rootLoggerInstance: Logger | null = null;
export function getLogger(): Logger {
  if (!rootLoggerInstance) {
    rootLoggerInstance = createLogger({});
  }
  return rootLoggerInstance;
}

/* ──────────────── internals ──────────────── */

function makeLogger(opts: {
  bindings: Record<string, unknown>;
  level?: LogLevel;
  mode?: LogMode;
}): Logger {
  const bindings = Object.freeze({ ...opts.bindings });
  const level: LogLevel = opts.level ?? activeLevel;
  const mode: LogMode = opts.mode ?? activeMode;
  const emit = (lvl: LogLevel, msg: string, extra?: Record<string, unknown>): void => {
    if (LOG_LEVELS[lvl] < LOG_LEVELS[level]) return;
    const record = buildRecord(lvl, msg, bindings, extra);
    renderAndWrite(record, mode);
  };
  const child = (extraBindings: Record<string, unknown>): Logger =>
    makeLogger({ bindings: { ...bindings, ...extraBindings }, level, mode });
  return Object.freeze({
    level,
    mode,
    bindings,
    emit,
    trace: (m, e) => emit("trace", m, e),
    debug: (m, e) => emit("debug", m, e),
    info: (m, e) => emit("info", m, e),
    warn: (m, e) => emit("warn", m, e),
    error: (m, e) => emit("error", m, e),
    fatal: (m, e) => emit("fatal", m, e),
    child,
  });
}

function buildRecord(
  level: LogLevel,
  msg: string,
  bindings: Readonly<Record<string, unknown>>,
  extra?: Record<string, unknown>
): LogRecord {
  const record: LogRecord = {
    level: LOG_LEVELS[level],
    time: Date.now(),
    msg,
    ...bindings,
    ...(extra ?? {}),
  };
  // Auto-correlate with the active span (if any). We do this last so
  // bindings / extras can't accidentally shadow the traceId field.
  try {
    const traceId = currentTraceId();
    if (traceId && traceId !== "00000000000000000000000000000000") {
      record.traceId = traceId;
      record.spanId = currentSpanId();
    }
  } catch {
    /* otel not initialized — skip correlation, no-op */
  }
  return record;
}

function renderAndWrite(record: LogRecord, mode: LogMode): void {
  if (mode === "json") {
    try {
      activeSink(record);
      return;
    } catch {
      // Last-resort fallback so a broken sink doesn't break the caller.
      console.log(JSON.stringify(record));
      return;
    }
  }
  activeSink(renderPretty(record));
}

function renderPretty(record: LogRecord): LogRecord {
  // Pretty mode just decorates the msg with the level + a leading "[ts]".
  // We don't add ANSI escapes — log shippers sometimes run pretty logs
  // through a tee and colors break their parsers.
  const ts = new Date(record.time).toISOString();
  const lvl = levelName(record.level);
  const tracePart = record.traceId ? ` trace=${String(record.traceId)}` : "";
  const msg = `[${ts}] ${lvl}${tracePart}: ${String(record.msg)}`;
  return { ...record, msg };
}

function levelName(n: number): string {
  if (n <= LOG_LEVELS.trace) return "TRACE";
  if (n <= LOG_LEVELS.debug) return "DEBUG";
  if (n <= LOG_LEVELS.info) return "INFO";
  if (n <= LOG_LEVELS.warn) return "WARN";
  if (n <= LOG_LEVELS.error) return "ERROR";
  return "FATAL";
}

function readModeFromEnv(): LogMode {
  const raw = process.env.LOG_MODE?.trim().toLowerCase();
  if (raw === "pretty") return "pretty";
  return "json";
}

function readLevelFromEnv(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "trace" || raw === "debug" || raw === "info" || raw === "warn" || raw === "error" || raw === "fatal") {
    return raw;
  }
  return "info";
}