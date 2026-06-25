/**
 * Structured logger tests.
 *
 * Covers:
 * - LOG_LEVELS: numeric ordering (trace=10 < fatal=60)
 * - createLogger: respects name/bindings; emits via activeSink
 * - getLogger: singleton
 * - level threshold: records below the configured level are dropped
 * - child: bindings merge additively
 * - pretty mode: msg decorated with [ts] and level name
 * - trace correlation: when a span is active, traceId/spanId appear
 * - setSink: capture-and-restore for test isolation
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  LOG_LEVELS,
  createLogger,
  getLogger,
  configure,
  setSink,
  getSink,
  type LogRecord,
} from "../../../src/lib/observability/logger.ts";
import { withSpan } from "../../../src/lib/observability/otel.ts";

let captured: LogRecord[] = [];
let prevSink: (record: LogRecord) => void;
let prevLevel: string | undefined;
let prevMode: string | undefined;

beforeEach(() => {
  prevSink = getSink();
  prevLevel = process.env.LOG_LEVEL;
  prevMode = process.env.LOG_MODE;
  captured = [];
  setSink((record) => captured.push(record));
  // Quiet stderr noise during tests — keep level at warn so info-level
  // test records we DO want to assert against are still emitted.
  process.env.LOG_LEVEL = "trace";
  configure({ level: "trace", mode: "json" });
});

test("LOG_LEVELS: numeric ordering trace < debug < info < warn < error < fatal", () => {
  assert.equal(LOG_LEVELS.trace, 10);
  assert.equal(LOG_LEVELS.debug, 20);
  assert.equal(LOG_LEVELS.info, 30);
  assert.equal(LOG_LEVELS.warn, 40);
  assert.equal(LOG_LEVELS.error, 50);
  assert.equal(LOG_LEVELS.fatal, 60);
});

test("createLogger: emits info-level record with bindings + extras", () => {
  const log = createLogger({ name: "test-svc", bindings: { region: "us-east-1" } });
  log.info("hello", { user: "u-1" });
  assert.equal(captured.length, 1);
  const r = captured[0]!;
  assert.equal(r.msg, "hello");
  assert.equal(r.level, LOG_LEVELS.info);
  assert.equal(r.name, "test-svc");
  assert.equal(r.region, "us-east-1");
  assert.equal(r.user, "u-1");
});

test("createLogger: respects per-logger level threshold", () => {
  const log = createLogger({ name: "t", level: "warn" });
  log.info("dropped");
  log.warn("kept");
  log.error("kept-too");
  assert.equal(captured.length, 2);
  assert.equal(captured[0]!.msg, "kept");
  assert.equal(captured[1]!.msg, "kept-too");
});

test("createLogger: child merges bindings additively", () => {
  const parent = createLogger({ name: "parent", bindings: { a: 1, b: 2 } });
  const child = parent.child({ b: 99, c: 3 });
  child.info("c-info");
  assert.equal(captured.length, 1);
  const r = captured[0]!;
  assert.equal(r.a, 1);
  assert.equal(r.b, 99, "child overrides parent");
  assert.equal(r.c, 3);
  assert.equal(r.name, "parent");
});

test("createLogger: child of child accumulates bindings", () => {
  const root = createLogger({ bindings: { root: true } });
  const mid = root.child({ mid: true });
  const leaf = mid.child({ leaf: true });
  leaf.info("deep");
  const r = captured[0]!;
  assert.equal(r.root, true);
  assert.equal(r.mid, true);
  assert.equal(r.leaf, true);
});

test("createLogger: trace / debug / warn / error / fatal all emit at the right level", () => {
  const log = createLogger({ name: "all-levels" });
  log.trace("t");
  log.debug("d");
  log.info("i");
  log.warn("w");
  log.error("e");
  log.fatal("f");
  assert.equal(captured.length, 6);
  assert.deepEqual(
    captured.map((r) => r.level),
    [10, 20, 30, 40, 50, 60]
  );
});

test("configure: sets active level and mode for subsequent loggers", () => {
  configure({ level: "error", mode: "pretty" });
  const log = createLogger({ name: "cfg" });
  log.warn("suppressed");
  log.error("kept");
  assert.equal(captured.length, 1);
  assert.match(captured[0]!.msg, /\[.*\] ERROR/);
});

test("pretty mode: msg is decorated with timestamp and level name", () => {
  configure({ level: "info", mode: "pretty" });
  const log = createLogger({ name: "pretty" });
  log.info("hello-pretty");
  assert.equal(captured.length, 1);
  const r = captured[0]!;
  assert.match(r.msg, /hello-pretty/);
  assert.match(r.msg, /\[20\d\d-/); // ISO timestamp prefix
  assert.match(r.msg, /INFO/);
});

test("trace correlation: when active span is present, record carries traceId and spanId", async () => {
  await withSpan("corr-span", async () => {
    const log = createLogger({ name: "corr" });
    log.info("inside-span");
    assert.equal(captured.length, 1);
    const r = captured[0]!;
    assert.ok(r.traceId);
    assert.ok(r.spanId);
    assert.equal((r.traceId as string).length, 32);
    assert.equal((r.spanId as string).length, 16);
  });
});

test("trace correlation: outside any span, traceId is still attached (fallback for log-only contexts)", () => {
  // Per the otel.ts contract, currentTraceId() returns a fresh 32-hex
  // when there is no active span so log-only consumers always have a
  // trace column. Logger builds on that contract.
  const log = createLogger({ name: "no-span" });
  log.info("outside");
  assert.equal(captured.length, 1);
  const r = captured[0]!;
  assert.ok(r.traceId);
  assert.equal((r.traceId as string).length, 32);
});

test("getLogger: returns the same instance on repeated calls", () => {
  const a = getLogger();
  const b = getLogger();
  assert.strictEqual(a, b);
});

test("setSink: returns previous sink and overrides active sink", () => {
  const sink = (record: LogRecord) => captured.push(record);
  const prev = setSink(sink);
  assert.equal(typeof prev, "function");
  const log = createLogger({});
  log.info("captured");
  assert.equal(captured.length, 1);
  // Restore so subsequent tests don't leak this sink.
  setSink(prev);
});

test("logger bindings are frozen", () => {
  const log = createLogger({ bindings: { a: 1 } });
  assert.throws(() => {
    (log.bindings as Record<string, unknown>).a = 2;
  });
});

test("logger methods are bound and stable across calls", () => {
  const log = createLogger({});
  const { info } = log;
  info("alias-call");
  assert.equal(captured.length, 1);
});

test("cleanup: restore previous env / sink", () => {
  // Smoke test that the afterEach-like cleanup in beforeEach is symmetric.
  if (prevLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = prevLevel;
  if (prevMode === undefined) delete process.env.LOG_MODE;
  else process.env.LOG_MODE = prevMode;
  setSink(prevSink);
  assert.equal(typeof getSink(), "function");
});
