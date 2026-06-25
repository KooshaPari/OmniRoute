/**
 * Unit tests for the compression telemetry wiring (PR-006).
 *
 * Verifies:
 *  1. applyCompression emits a single telemetry event with the resolved
 *     `mode` for each of the 5 branches (rtk, lite, stacked, standard,
 *     ultra).
 *  2. applyStackedCompression emits a parent telemetry event AND one
 *     reportPerEngineBreakdownTelemetry call per stacked engine.
 *  3. The telemetry adapter is **fire-and-forget** — a thrown error in
 *     `recordCompressionRun` must not bubble up to the caller.
 *  4. Telemetry is no-op when `stats` is null (off branch).
 *
 * The tests inject a stub via {@link setTestInstance} so they can assert
 * call counts and arguments without monkey-patching the module loader.
 *
 * Note: lite / standard / ultra branches return `stats: null` when no
 * technique is applicable. We exercise the telemetry hook by using
 * the rtk and stacked branches which always emit a stats object, plus
 * the off branch which always has stats=null.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  applyCompression,
  applyStackedCompression,
} from "../../../open-sse/services/compression/strategySelector.ts";
import {
  CompressionTelemetry,
  setTestInstance,
  __resetDefaultCompressionTelemetryForTests,
  type CompressionTelemetryContext,
} from "../../../open-sse/services/compression/telemetry.ts";
import type { CompressionStats } from "../../../open-sse/services/compression/types.ts";

class StubRecorder extends CompressionTelemetry {
  public runs: Array<{ stats: CompressionStats; ctx?: CompressionTelemetryContext }> = [];
  public breakdown: Array<{ stats: CompressionStats; engineName: string }> = [];
  public throwOnNext: Error | null = null;

  override recordCompressionRun(stats: CompressionStats, ctx?: CompressionTelemetryContext): void {
    if (this.throwOnNext) {
      const err = this.throwOnNext;
      this.throwOnNext = null;
      throw err;
    }
    this.runs.push({ stats, ctx });
  }

  override recordEngineBreakdown(stats: CompressionStats, engineName: string): void {
    this.breakdown.push({ stats, engineName });
  }
}

let stub: StubRecorder;

// Body shape that exercises both branches that always emit stats
// (rtk, stacked) and branches that emit only when applicable (lite,
// standard, ultra).
const BODY = {
  messages: [
    {
      role: "user" as const,
      content:
        "Some content here.\n\n\n\n\n\nSome content here.\n\n\n\n\n\nSome content here.\n\n\n\n\n\n",
    },
  ],
};

beforeEach(() => {
  stub = new StubRecorder();
  setTestInstance(stub);
});

afterEach(() => {
  __resetDefaultCompressionTelemetryForTests();
});

describe("PR-006: compression telemetry wiring", () => {
  it("applyCompression(rtk) emits a single telemetry run with mode=rtk", () => {
    const result = applyCompression(BODY, "rtk", { config: { mode: "rtk" } });
    assert.ok(result, "applyCompression must return a result");
    assert.equal(result!.stats?.mode, "rtk");
    assert.equal(stub.runs.length, 1, "expected exactly one telemetry run");
    assert.strictEqual(stub.runs[0].stats, result!.stats);
  });

  it("applyCompression(stacked) emits one parent run + per-engine breakdown", () => {
    const result = applyCompression(BODY, "stacked", {
      config: {
        mode: "stacked",
        stackedPipeline: [{ engine: "rtk" }, { engine: "caveman" }],
      },
    });
    assert.ok(result);
    assert.equal(result!.stats?.mode, "stacked");
    assert.equal(stub.runs.length, 1, "expected one parent telemetry run");
    assert.ok(
      stub.breakdown.length >= 2,
      `expected >= 2 breakdown entries, got ${stub.breakdown.length}`
    );
  });

  it("applyStackedCompression emits one parent run + one breakdown per step", () => {
    const result = applyStackedCompression(
      BODY,
      [{ engine: "rtk" }, { engine: "caveman" }],
      undefined
    );
    assert.ok(result);
    assert.equal(result!.stats?.mode, "stacked");
    assert.equal(stub.runs.length, 1, "expected one parent run");
    assert.equal(stub.breakdown.length, 2, "expected one breakdown per engine");
  });

  it("applyCompression(lite) emits a telemetry run when lite actually compresses", () => {
    // Build a body that lite compression will actually mutate.
    const liteBody = {
      messages: [
        {
          role: "user" as const,
          content:
            "line1\n\n\nline2\n\n\nline3\n\n\nline4\n\n\nline5\n\n\nline6\n\n\nline7\n\n\nline8",
        },
      ],
    };
    const result = applyCompression(liteBody, "lite", {
      config: { mode: "lite" },
    });
    assert.ok(result);
    if (result!.stats) {
      assert.equal(result!.stats.mode, "lite");
      assert.equal(stub.runs.length, 1, "expected one telemetry run when lite compresses");
    } else {
      // Lite didn't compress — that's also valid, telemetry should be no-op.
      assert.equal(stub.runs.length, 0, "no telemetry when lite does not compress");
    }
  });

  it("telemetry is fire-and-forget — a thrown error does not bubble up", () => {
    stub.throwOnNext = new Error("recorder exploded");
    assert.doesNotThrow(() => {
      applyCompression(BODY, "rtk", { config: { mode: "rtk" } });
    });
  });

  it("applyCompression(off) emits no telemetry (early-exit branch)", () => {
    const result = applyCompression(BODY, "off");
    assert.ok(result);
    // off branch returns { body, compressed: false, stats: null } — no telemetry
    assert.equal(result!.stats, null);
    assert.equal(stub.runs.length, 0, "no telemetry for the off branch");
  });
});
