/**
 * W3C traceparent header parser/builder tests.
 *
 * Covers:
 * - parseTraceParent: valid, invalid format, malformed, wrong version,
 *   all-zeros trace-id rejection, all-zeros parent-id rejection,
 *   trace-id length, parent-id length, flags bit parsing.
 * - buildTraceParent: round-trip with parseTraceParent, format shape.
 * - injectTraceParent: returns same headers object, preserves existing
 *   headers, overrides existing traceparent when forced.
 * - extractTraceParent: from Request with header, from Request without
 *   header, from unknown input.
 *
 * Reference: https://www.w3.org/TR/trace-context/#traceparent-header
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTraceParent,
  buildTraceParent,
  injectTraceParent,
  extractTraceParent,
  type TraceParent,
} from "../../../src/lib/observability/traceparent.ts";

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const PARENT_ID = "b7ad6b7169203331";
const FLAGS_SAMPLED = "01";

test("parseTraceParent: parses a valid traceparent header", () => {
  const header = `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`;
  const parsed = parseTraceParent(header);
  assert.ok(parsed, "should return a non-null result");
  assert.equal(parsed.version, "00");
  assert.equal(parsed.traceId, TRACE_ID);
  assert.equal(parsed.spanId, PARENT_ID);
  assert.equal(parsed.flags, FLAGS_SAMPLED);
  assert.equal(parsed.sampled, true);
});

test("parseTraceParent: flags=00 means not sampled", () => {
  const header = `00-${TRACE_ID}-${PARENT_ID}-00`;
  const parsed = parseTraceParent(header);
  assert.ok(parsed);
  assert.equal(parsed.sampled, false);
});

test("parseTraceParent: rejects non-string input", () => {
  assert.equal(parseTraceParent(null), null);
  assert.equal(parseTraceParent(undefined), null);
  assert.equal(parseTraceParent(123 as unknown as string), null);
  assert.equal(parseTraceParent({} as unknown as string), null);
});

test("parseTraceParent: rejects empty string", () => {
  assert.equal(parseTraceParent(""), null);
});

test("parseTraceParent: rejects header with extra trailing fields", () => {
  // W3C spec: additional list members are not allowed in the header itself,
  // so anything past the 4 hyphen-separated fields is invalid for parsing.
  const header = `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}-extra`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects version other than 00", () => {
  const header = `ff-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects all-zeros trace-id", () => {
  const zeros = "0".repeat(32);
  const header = `00-${zeros}-${PARENT_ID}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects all-zeros parent-id", () => {
  const zeros = "0".repeat(16);
  const header = `00-${TRACE_ID}-${zeros}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects trace-id of wrong length", () => {
  const short = "0af7651916cd43dd8448eb211c80319";
  const header = `00-${short}-${PARENT_ID}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects parent-id of wrong length", () => {
  const short = "b7ad6b716920333";
  const header = `00-${TRACE_ID}-${short}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects non-hex characters", () => {
  const badTrace = "0af7651916cd43dd8448eb211c80319z";
  const header = `00-${badTrace}-${PARENT_ID}-${FLAGS_SAMPLED}`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects flags of wrong length", () => {
  const header = `00-${TRACE_ID}-${PARENT_ID}-0`;
  assert.equal(parseTraceParent(header), null);
});

test("parseTraceParent: rejects missing fields", () => {
  assert.equal(parseTraceParent(`00-${TRACE_ID}-${PARENT_ID}`), null);
  assert.equal(parseTraceParent(`00-${TRACE_ID}`), null);
  assert.equal(parseTraceParent("00"), null);
});

test("buildTraceParent: round-trips with parseTraceParent", () => {
  const header = buildTraceParent(TRACE_ID, PARENT_ID, FLAGS_SAMPLED);
  assert.equal(header, `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`);
  const parsed = parseTraceParent(header);
  assert.ok(parsed);
  assert.equal(parsed.traceId, TRACE_ID);
  assert.equal(parsed.spanId, PARENT_ID);
  assert.equal(parsed.flags, FLAGS_SAMPLED);
});

test("injectTraceParent: returns same headers object with traceparent added", () => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const result = injectTraceParent({ traceId: TRACE_ID, spanId: PARENT_ID, flags: FLAGS_SAMPLED, version: "00", sampled: true }, headers);
  assert.strictEqual(result, headers, "should return the same headers object");
  assert.equal(result["content-type"], "application/json");
  assert.equal(result.traceparent, `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`);
});

test("injectTraceParent: overwrites an existing traceparent header by default", () => {
  const headers: Record<string, string> = {
    traceparent: "00-00000000000000000000000000000000-0000000000000000-00",
  };
  const newTp: TraceParent = { traceId: TRACE_ID, spanId: PARENT_ID, flags: FLAGS_SAMPLED, version: "00", sampled: true };
  injectTraceParent(newTp, headers);
  assert.equal(headers.traceparent, `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`);
});

test("extractTraceParent: returns null for an input without a traceparent header", () => {
  const req = { headers: { get(name: string) { return name.toLowerCase() === "traceparent" ? null : null; } } };
  assert.equal(extractTraceParent(req), null);
});

test("extractTraceParent: parses a valid header from a Request-like object", () => {
  const req = {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "traceparent"
          ? `00-${TRACE_ID}-${PARENT_ID}-${FLAGS_SAMPLED}`
          : null;
      },
    },
  };
  const tp = extractTraceParent(req);
  assert.ok(tp);
  assert.equal(tp.traceId, TRACE_ID);
  assert.equal(tp.spanId, PARENT_ID);
});

test("extractTraceParent: returns null for an invalid header value", () => {
  const req = {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "traceparent" ? "garbage" : null;
      },
    },
  };
  assert.equal(extractTraceParent(req), null);
});
