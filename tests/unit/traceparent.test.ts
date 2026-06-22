/**
 * W3C traceparent parser/injector tests — B10 of v8.1.
 *
 * Pure-function tests, no OTel SDK needed. Exercises the W3C spec
 * edge cases (reserved all-zero trace-id, lowercase hex requirement,
 * version handling, tracestate pass-through) without any telemetry
 * runtime.
 *
 * Reference: open-sse/observability/traceparent.ts, PLAN.md § 2.5.2 (B10).
 */

import { describe, it, expect } from "vitest";
import {
  generateTraceparent,
  parseTraceparent,
  parseTracestate,
  formatTraceparent,
  formatTracestate,
  childTraceparent,
  injectTraceparent,
  readTraceparentFromHeaders,
  TRACEPARENT_VERSION,
  type Traceparent,
} from "../../open-sse/observability/traceparent.ts";

describe("traceparent", () => {
  describe("generateTraceparent", () => {
    it("emits the W3C 4-field format: 00-<32>-<16>-<2>", () => {
      const tp = generateTraceparent();
      expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    });

    it("defaults to sampled (flags=01) when called with no args", () => {
      const tp = generateTraceparent();
      expect(tp.endsWith("-01")).toBe(true);
    });

    it("defaults to sampled (flags=01) when called with empty options object", () => {
      const tp = generateTraceparent({});
      expect(tp.endsWith("-01")).toBe(true);
    });

    it("emits unsampled (flags=00) when sampled=false", () => {
      const tp = generateTraceparent({ sampled: false });
      expect(tp.endsWith("-00")).toBe(true);
    });

    it("accepts positional boolean (legacy form)", () => {
      expect(generateTraceparent(true).endsWith("-01")).toBe(true);
      expect(generateTraceparent(false).endsWith("-00")).toBe(true);
    });

    it("emits a fresh trace-id on each call (no collisions in 1000 draws)", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        seen.add(generateTraceparent());
      }
      // Birthday-bound: 1000 draws across 32 hex chars has vanishing
      // collision probability. If this ever fails, RNG is broken.
      expect(seen.size).toBe(1000);
    });

    it("never emits the reserved all-zero trace-id", () => {
      for (let i = 0; i < 200; i++) {
        const tp = generateTraceparent();
        const traceId = tp.split("-")[1];
        expect(traceId).not.toBe("00000000000000000000000000000000");
      }
    });

    it("never emits the reserved all-zero parent-id", () => {
      for (let i = 0; i < 200; i++) {
        const tp = generateTraceparent();
        const parentId = tp.split("-")[2];
        expect(parentId).not.toBe("0000000000000000");
      }
    });

    it("emits lowercase hex only", () => {
      const tp = generateTraceparent();
      expect(tp).toBe(tp.toLowerCase());
    });
  });

  describe("parseTraceparent", () => {
    it("parses a freshly-generated traceparent", () => {
      const generated = generateTraceparent();
      const parsed = parseTraceparent(generated);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.traceparent.version).toBe(TRACEPARENT_VERSION);
        expect(parsed.traceparent.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(parsed.traceparent.parentId).toMatch(/^[0-9a-f]{16}$/);
        expect(parsed.traceparent.flags).toMatch(/^[0-9a-f]{2}$/);
      }
    });

    it("parses a known-valid W3C example", () => {
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.traceparent.traceId).toBe(
          "4bf92f3577b34da6a3ce929d0e0e4736"
        );
        expect(result.traceparent.parentId).toBe("00f067aa0ba902b7");
        expect(result.traceparent.flags).toBe("01");
      }
    });

    it("rejects null / undefined with reason=missing", () => {
      expect(parseTraceparent(null).ok).toBe(false);
      expect(parseTraceparent(undefined).ok).toBe(false);
      if (!parseTraceparent(null).ok) {
        expect(parseTraceparent(null).error).toBe("missing");
      }
    });

    it("rejects empty string with reason=missing", () => {
      expect(parseTraceparent("").ok).toBe(false);
      expect(parseTraceparent("   ").ok).toBe(false);
    });

    it("rejects malformed: wrong field count", () => {
      const result = parseTraceparent("00-abc-def");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("wrong_field_count");
    });

    it("rejects non-00 version with reason=wrong_version", () => {
      const result = parseTraceparent(
        "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("wrong_version");
    });

    it("rejects trace-id with non-hex characters", () => {
      const result = parseTraceparent(
        "00-ZZZZ2f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("bad_trace_id");
    });

    it("rejects trace-id with wrong length", () => {
      const result = parseTraceparent("00-4bf-00f067aa0ba902b7-01");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("bad_trace_id");
    });

    it("rejects parent-id with wrong length", () => {
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f0-01"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("bad_parent_id");
    });

    it("rejects flags with wrong length", () => {
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-12345"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("bad_flags");
    });

    it("rejects reserved all-zero trace-id", () => {
      const result = parseTraceparent(
        "00-00000000000000000000000000000000-00f067aa0ba902b7-01"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("reserved_trace_id");
    });

    it("rejects reserved all-zero parent-id", () => {
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("reserved_parent_id");
    });

    it("rejects values with whitespace", () => {
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736 -00f067aa0ba902b7-01"
      );
      expect(result.ok).toBe(false);
    });

    it("rejects uppercase hex in flags (strict spec compliance)", () => {
      // W3C trace-context spec requires lowercase hex in all fields
      // (version, trace-id, parent-id, flags). We are strict here
      // because round-tripping parse → emit must be deterministic.
      const result = parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-FF"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("bad_flags");
    });
  });

  describe("parseTracestate / formatTracestate", () => {
    it("returns empty array for null/empty input", () => {
      expect(parseTracestate(null)).toEqual([]);
      expect(parseTracestate(undefined)).toEqual([]);
      expect(parseTracestate("")).toEqual([]);
      expect(parseTracestate("   ")).toEqual([]);
    });

    it("parses a single entry", () => {
      expect(parseTracestate("vendor=value")).toEqual([
        { key: "vendor", value: "value" },
      ]);
    });

    it("parses multiple entries preserving order", () => {
      expect(parseTracestate("a=1,b=2,c=3")).toEqual([
        { key: "a", value: "1" },
        { key: "b", value: "2" },
        { key: "c", value: "3" },
      ]);
    });

    it("skips malformed entries (no =, empty key, empty value)", () => {
      expect(parseTracestate("a=1,=broken,broken,c=")).toEqual([
        { key: "a", value: "1" },
      ]);
    });

    it("formats a list of entries back to header value", () => {
      expect(formatTracestate([{ key: "a", value: "1" }])).toBe("a=1");
      expect(
        formatTracestate([
          { key: "a", value: "1" },
          { key: "b", value: "2" },
        ])
      ).toBe("a=1,b=2");
    });

    it("round-trips: parse → format is identity", () => {
      const raw = "vendor1=abc,vendor2=def-ghi";
      expect(formatTracestate(parseTracestate(raw))).toBe(raw);
    });

    it("returns empty string for empty input", () => {
      expect(formatTracestate([])).toBe("");
    });
  });

  describe("formatTraceparent / childTraceparent", () => {
    it("formats a parsed traceparent back to header value", () => {
      const tp: Traceparent = {
        version: "00",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        parentId: "00f067aa0ba902b7",
        flags: "01",
      };
      expect(formatTraceparent(tp)).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      );
    });

    it("childTraceparent preserves trace-id and flags, swaps parent-id", () => {
      const parent: Traceparent = {
        version: "00",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        parentId: "00f067aa0ba902b7",
        flags: "01",
      };
      const child = childTraceparent(parent, "1111111111111111");
      expect(child).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-1111111111111111-01"
      );
    });

    it("childTraceparent re-rolls reserved all-zero parent-id", () => {
      const parent: Traceparent = {
        version: "00",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        parentId: "00f067aa0ba902b7",
        flags: "01",
      };
      const child = childTraceparent(parent, "0000000000000000");
      const childParentId = child.split("-")[2];
      expect(childParentId).not.toBe("0000000000000000");
      // Trace-id must still be preserved.
      expect(child.split("-")[1]).toBe(parent.traceId);
    });
  });

  describe("injectTraceparent", () => {
    it("writes traceparent when absent", () => {
      const headers: Record<string, string> = {};
      injectTraceparent(headers, "00-aa-bb-01");
      expect(headers["traceparent"]).toBe("00-aa-bb-01");
    });

    it("overwrites existing traceparent (case-insensitive)", () => {
      const headers: Record<string, string> = {
        Traceparent: "00-old-old-01",
      };
      injectTraceparent(headers, "00-new-new-01");
      // Original key preserved, value replaced.
      expect(headers["Traceparent"]).toBe("00-new-new-01");
    });

    it("appends tracestate when existing tracestate present (default)", () => {
      const headers: Record<string, string> = {
        tracestate: "vendor1=abc",
      };
      injectTraceparent(headers, "00-aa-bb-01", "vendor2=def");
      expect(headers["tracestate"]).toBe("vendor1=abc,vendor2=def");
    });

    it("replaces tracestate when replaceTracestate=true", () => {
      const headers: Record<string, string> = {
        tracestate: "vendor1=abc",
      };
      injectTraceparent(headers, "00-aa-bb-01", "vendor2=def", {
        replaceTracestate: true,
      });
      expect(headers["tracestate"]).toBe("vendor2=def");
    });

    it("does not touch tracestate when not provided", () => {
      const headers: Record<string, string> = {
        tracestate: "vendor1=abc",
      };
      injectTraceparent(headers, "00-aa-bb-01");
      expect(headers["tracestate"]).toBe("vendor1=abc");
    });
  });

  describe("readTraceparentFromHeaders", () => {
    it("returns null traceparent + empty tracestate for empty headers", () => {
      const r = readTraceparentFromHeaders({});
      expect(r.traceparent).toBeNull();
      expect(r.tracestate).toEqual([]);
    });

    it("parses traceparent and tracestate together", () => {
      const r = readTraceparentFromHeaders({
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        tracestate: "a=1,b=2",
      });
      expect(r.traceparent?.traceId).toBe(
        "4bf92f3577b34da6a3ce929d0e0e4736"
      );
      expect(r.tracestate).toEqual([
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ]);
    });

    it("returns null traceparent when malformed", () => {
      const r = readTraceparentFromHeaders({
        traceparent: "garbage",
      });
      expect(r.traceparent).toBeNull();
    });

    it("is case-insensitive on header keys", () => {
      const r = readTraceparentFromHeaders({
        Traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      });
      expect(r.traceparent?.parentId).toBe("00f067aa0ba902b7");
    });
  });
});
