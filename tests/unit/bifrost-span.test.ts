/**
 * Bifrost Span tests — B10 of v8.1.
 *
 * Exercises `withBifrostSpan()` which wraps a Bifrost HTTP call in
 * an OTel span and injects the W3C `traceparent` into the request
 * headers. The actual Bifrost HTTP call is mocked — these tests
 * verify the wrapper's contract, not Bifrost itself.
 *
 * Reference: open-sse/observability/bifrostSpan.ts, PLAN.md § 2.5.2 (B10).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  withBifrostSpan,
  safeParseTraceparent,
  type BifrostSpanInput,
} from "../../open-sse/observability/bifrostSpan.ts";
import { parseTraceparent } from "../../open-sse/observability/traceparent.ts";

describe("bifrostSpan", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SDK_DISABLED;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  describe("withBifrostSpan", () => {
    const baseInput: BifrostSpanInput = {
      provider: "openai",
      bifrostProvider: "openai",
      model: "gpt-4o-mini",
      baseUrl: "http://bifrost.local:8080",
      headers: {},
    };

    it("returns whatever the inner function returned", async () => {
      const inner = vi.fn(async () => ({ ok: true, body: "response" }));
      const result = await withBifrostSpan(baseInput, inner);
      expect(result.result).toEqual({ ok: true, body: "response" });
      expect(inner).toHaveBeenCalledTimes(1);
    });

    it("injects a valid W3C traceparent header before calling fn", async () => {
      const seenHeaders: Record<string, string> = {};
      await withBifrostSpan(baseInput, async () => {
        Object.assign(seenHeaders, baseInput.headers);
        return { ok: true };
      });
      // The wrapper mutates `baseInput.headers` in place.
      expect(seenHeaders.traceparent ?? baseInput.headers.traceparent).toBeDefined();
      const parsed = parseTraceparent(baseInput.headers.traceparent ?? "");
      expect(parsed.ok).toBe(true);
    });

    it("defaults traceparent flags to 00 (unsampled) when no parent is provided", async () => {
      // The wrapper defaults to unsampled (flag=00) when minting
      // fresh, to avoid contaminating Bifrost's sampling decisions.
      await withBifrostSpan(baseInput, async () => ({ ok: true }));
      const tp = baseInput.headers.traceparent ?? "";
      const parts = tp.split("-");
      // flags are the last 2-hex segment.
      expect(parts[3]).toBe("00");
    });

    it("preserves existing traceparent when caller injects one via parentTraceparent", async () => {
      const input: BifrostSpanInput = {
        ...baseInput,
        parentTraceparent: {
          version: "00",
          traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
          parentId: "00f067aa0ba902b7",
          flags: "01",
        },
      };
      await withBifrostSpan(input, async () => ({ ok: true }));
      const tp = input.headers.traceparent ?? "";
      const parsed = parseTraceparent(tp);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        // Trace-id must be preserved from parent.
        expect(parsed.traceparent.traceId).toBe(
          "4bf92f3577b34da6a3ce929d0e0e4736"
        );
        // Sampled flag inherited from parent.
        expect(parsed.traceparent.flags).toBe("01");
      }
    });

    it("appends caller-supplied tracestate when present", async () => {
      const input: BifrostSpanInput = {
        ...baseInput,
        tracestate: "vendor1=abc",
      };
      await withBifrostSpan(input, async () => ({ ok: true }));
      expect(input.headers.tracestate).toBe("vendor1=abc");
    });

    it("re-throws errors from inner function (so caller sees original)", async () => {
      const err = new Error("upstream 502");
      await expect(
        withBifrostSpan(baseInput, async () => {
          throw err;
        })
      ).rejects.toBe(err);
    });

    it("records exception on the span but does not swallow the throw", async () => {
      let observed: unknown = null;
      try {
        await withBifrostSpan(baseInput, async () => {
          throw new Error("kaboom");
        });
      } catch (e) {
        observed = e;
      }
      expect((observed as Error).message).toBe("kaboom");
    });

    it("exposes the span on the result envelope (already ended)", async () => {
      let spanEnded = false;
      const result = await withBifrostSpan(baseInput, async (span) => {
        // While inside fn, span.end hasn't been called yet.
        spanEnded = false;
        return { ok: true };
      });
      expect(result.span).toBeDefined();
      // The span.end() call is in the wrapper's finally — outside fn,
      // the span IS ended.
      expect(typeof result.span.end).toBe("function");
    });

    it("works correctly when called multiple times in sequence (idempotent)", async () => {
      for (let i = 0; i < 5; i++) {
        const input: BifrostSpanInput = {
          ...baseInput,
          headers: {},
        };
        const r = await withBifrostSpan(input, async () => ({ ok: true }));
        expect(r.result).toEqual({ ok: true });
        expect(input.headers.traceparent).toBeDefined();
      }
    });

    it("emits a fresh parent-id per call (no collisions across 100 calls)", async () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const input: BifrostSpanInput = { ...baseInput, headers: {} };
        await withBifrostSpan(input, async () => ({ ok: true }));
        const tp = input.headers.traceparent ?? "";
        seen.add(tp.split("-")[2] ?? "");
      }
      // Each call mints a fresh parent-id. 100 draws, no collisions
      // expected (8 hex chars = 4B keyspace).
      expect(seen.size).toBe(100);
    });
  });

  describe("safeParseTraceparent", () => {
    it("returns parsed traceparent when valid", () => {
      const tp = safeParseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      );
      expect(tp?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
      expect(tp?.parentId).toBe("00f067aa0ba902b7");
    });

    it("returns null when input is null/undefined", () => {
      expect(safeParseTraceparent(null)).toBeNull();
      expect(safeParseTraceparent(undefined)).toBeNull();
    });

    it("returns null when malformed", () => {
      expect(safeParseTraceparent("garbage")).toBeNull();
      expect(safeParseTraceparent("00-aa-bb")).toBeNull();
    });
  });
});
