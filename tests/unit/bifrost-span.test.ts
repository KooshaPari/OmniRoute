/**
 * Bifrost Span tests — B10 of v8.1.
 *
 * Exercises `withBifrostSpan()` which wraps a Bifrost HTTP call in
 * an OTel span and injects the W3C `traceparent` into the request
 * headers. The actual Bifrost HTTP call is mocked — these tests
 * verify the wrapper's contract, not Bifrost itself.
 *
 * Reference: open-sse/observability/bifrostSpan.ts, PLAN.md § 2.5.2 (B10).
 *
 * Uses node:test (CI unit shards), not vitest.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  withBifrostSpan,
  safeParseTraceparent,
  type BifrostSpanInput,
} from "../../open-sse/observability/bifrostSpan.ts";
import { parseTraceparent } from "../../open-sse/observability/traceparent.ts";

const ORIGINAL_ENV = { ...process.env };

test.beforeEach(() => {
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_SDK_DISABLED;
});

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

function baseInput(overrides: Partial<BifrostSpanInput> = {}): BifrostSpanInput {
  return {
    provider: "openai",
    bifrostProvider: "openai",
    model: "gpt-4o-mini",
    baseUrl: "http://bifrost.local:8080",
    headers: {},
    ...overrides,
  };
}

test("withBifrostSpan returns whatever the inner function returned", async () => {
  let calls = 0;
  const result = await withBifrostSpan(baseInput(), async () => {
    calls += 1;
    return { ok: true, body: "response" };
  });
  assert.deepEqual(result.result, { ok: true, body: "response" });
  assert.equal(calls, 1);
});

test("withBifrostSpan injects a valid W3C traceparent header before calling fn", async () => {
  const input = baseInput();
  const seenHeaders: Record<string, string> = {};
  await withBifrostSpan(input, async () => {
    Object.assign(seenHeaders, input.headers);
    return { ok: true };
  });
  assert.ok(seenHeaders.traceparent ?? input.headers.traceparent);
  const parsed = parseTraceparent(input.headers.traceparent ?? "");
  assert.equal(parsed.ok, true);
});

test("withBifrostSpan defaults traceparent flags to 00 when no parent is provided", async () => {
  const input = baseInput();
  await withBifrostSpan(input, async () => ({ ok: true }));
  const parts = (input.headers.traceparent ?? "").split("-");
  assert.equal(parts[3], "00");
});

test("withBifrostSpan preserves existing traceparent when parentTraceparent is set", async () => {
  const input = baseInput({
    parentTraceparent: {
      version: "00",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      flags: "01",
    },
  });
  await withBifrostSpan(input, async () => ({ ok: true }));
  const parsed = parseTraceparent(input.headers.traceparent ?? "");
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.traceparent.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
    assert.equal(parsed.traceparent.flags, "01");
  }
});

test("withBifrostSpan appends caller-supplied tracestate when present", async () => {
  const input = baseInput({ tracestate: "vendor1=abc" });
  await withBifrostSpan(input, async () => ({ ok: true }));
  assert.equal(input.headers.tracestate, "vendor1=abc");
});

test("withBifrostSpan re-throws errors from inner function", async () => {
  const err = new Error("upstream 502");
  await assert.rejects(
    () =>
      withBifrostSpan(baseInput(), async () => {
        throw err;
      }),
    (caught) => caught === err
  );
});

test("withBifrostSpan records exception on the span but does not swallow the throw", async () => {
  let observed: unknown = null;
  try {
    await withBifrostSpan(baseInput(), async () => {
      throw new Error("kaboom");
    });
  } catch (e) {
    observed = e;
  }
  assert.equal((observed as Error).message, "kaboom");
});

test("withBifrostSpan exposes the span on the result envelope", async () => {
  const result = await withBifrostSpan(baseInput(), async () => ({ ok: true }));
  assert.ok(result.span);
  assert.equal(typeof result.span.end, "function");
});

test("withBifrostSpan works correctly when called multiple times in sequence", async () => {
  for (let i = 0; i < 5; i++) {
    const input = baseInput({ headers: {} });
    const r = await withBifrostSpan(input, async () => ({ ok: true }));
    assert.deepEqual(r.result, { ok: true });
    assert.ok(input.headers.traceparent);
  }
});

test("withBifrostSpan emits a fresh parent-id per call", async () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const input = baseInput({ headers: {} });
    await withBifrostSpan(input, async () => ({ ok: true }));
    seen.add((input.headers.traceparent ?? "").split("-")[2] ?? "");
  }
  assert.equal(seen.size, 100);
});

test("safeParseTraceparent returns parsed traceparent when valid", () => {
  const tp = safeParseTraceparent(
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  );
  assert.equal(tp?.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(tp?.parentId, "00f067aa0ba902b7");
});

test("safeParseTraceparent returns null when input is null/undefined", () => {
  assert.equal(safeParseTraceparent(null), null);
  assert.equal(safeParseTraceparent(undefined), null);
});

test("safeParseTraceparent returns null when malformed", () => {
  assert.equal(safeParseTraceparent("garbage"), null);
  assert.equal(safeParseTraceparent("00-aa-bb"), null);
});
