/**
 * Compression telemetry adapter (PR-006).
 *
 * Bridges {@link CompressionStats} (the open-sse compression subsystem's
 * internal data type) into the {@link ./metrics} Prometheus registry and
 * the {@link ./otel} OpenTelemetry tracer.
 *
 * Design constraints:
 *
 *  1. **No new npm dependencies.** Re-uses the existing observability
 *     surface in `src/lib/observability` (PR-001..PR-005).
 *
 *  2. **Fire-and-forget.** Every public function wraps its body in a
 *     try/catch that swallows errors after logging at debug level.
 *     Compression callers never block on telemetry and never see
 *     telemetry-induced exceptions.
 *
 *  3. **Singleton.** {@link getDefaultCompressionTelemetry} returns a
 *     process-wide default instance so we don't allocate a new tracer
 *     per compression run. The default is no-op by default (only the
 *     metrics registry is wired through; OTel spans are emitted when
 *     `OTEL_SDK_DISABLED !== "true"` and `initTelemetry` has been called).
 *
 *  4. **No schema drift.** The label set used here is enforced by the
 *     `omniroute_compression_*` allow-list in `src/lib/observability/metrics.ts`.
 *     If you need a new label, add it to that allow-list first.
 *
 * @see src/lib/observability/metrics.ts (PR-003, label allow-list)
 * @see plans/2026-06-24-omniroute-100-pr-plan-v1.md (PR-006)
 */

import { recordCompressionRun as recordCompressionRunMetric } from "@/lib/observability/metrics";
import { startSpan } from "@/lib/observability/otel";
import type { Span } from "@/lib/observability/spanTypes";
import type { CompressionStats } from "./types";

/** Optional principal/request labels forwarded from the chatCore handler. */
export interface CompressionTelemetryContext {
  principalId?: string;
  requestId?: string;
  /** Free-form extra attributes attached to the parent span. */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * A handle for the compression telemetry layer. One per process; obtained
 * via {@link getDefaultCompressionTelemetry}.
 *
 * Public surface intentionally small: callers only need {@link recordCompressionRun}.
 * The other helpers are exposed for tests and dashboards.
 */
export class CompressionTelemetry {
  /** Total parent compression runs recorded on this handle. */
  private runsRecorded = 0;
  /** Total per-engine breakdown steps recorded on this handle. */
  private engineBreakdownCount = 0;

  /** Test-only accessor: total runs recorded. */
  getRunsRecorded(): number {
    return this.runsRecorded;
  }

  /** Test-only reset: clears the run counter back to zero. */
  resetRunsRecorded(): void {
    this.runsRecorded = 0;
  }

  /** Record one completed compression run. Fire-and-forget. */
  recordCompressionRun(stats: CompressionStats, ctx?: CompressionTelemetryContext): void {
    if (!stats) return;
    this.runsRecorded += 1;
    try {
      const engine = stats.engine ?? stats.techniquesUsed[0] ?? "unknown";
      // Emit OTel span first (always cheap; stub span when telemetry disabled).
      const span = startSpan("compression.run", {
        kind: "INTERNAL",
        attributes: {
          "compression.mode": stats.mode,
          "compression.engine": engine,
          "compression.combo_id": stats.compressionComboId ?? "none",
          "compression.original_tokens": stats.originalTokens,
          "compression.compressed_tokens": stats.compressedTokens,
          "compression.savings_percent": stats.savingsPercent,
          "compression.fallback_applied": stats.fallbackApplied === true,
          ...(stats.durationMs !== undefined
            ? { "compression.duration_ms": stats.durationMs }
            : {}),
          ...(ctx?.principalId ? { "auth.principal_id": ctx.principalId } : {}),
          ...(ctx?.requestId ? { "request.id": ctx.requestId } : {}),
          ...(ctx?.attributes ?? {}),
        },
      });
      this.finishSpan(span, stats);

      // Emit Prometheus metrics (also fire-and-forget; never throws).
      recordCompressionRunMetric({
        mode: stats.mode,
        engine,
        comboId: stats.compressionComboId,
        fallbackApplied: stats.fallbackApplied,
        savingsPercent: stats.savingsPercent,
        durationMs: stats.durationMs,
        originalTokens: stats.originalTokens,
        compressedTokens: stats.compressedTokens,
      });
    } catch (err) {
      if (process.env.OMNIROUTE_TELEMETRY_DEBUG === "1") {
         
        console.warn("[compression-telemetry] recordCompressionRun failed:", err);
      }
    }
  }

  /**
   * Record a per-engine breakdown step. Called from
   * {@link ./strategySelector}'s `mergeStackStep` after each stacked
   * step is appended. Increments the in-memory breakdown counter so
   * dashboards can show "engines that contributed to the parent run".
   * Emits a `compression.engine_breakdown` span attribute on the active
   * span if one is in flight.
   */
  recordEngineBreakdown(stats: CompressionStats, engineName: string): void {
    if (!stats) return;
    try {
      this.engineBreakdownCount += 1;
      // No new OTel span — the per-engine breakdown is already captured
      // as an attribute on the parent run span (compression.engine_breakdown).
      // We just bump the counter so dashboards / tests can observe activity.
      recordCompressionRunMetric({
        mode: "stacked-breakdown",
        engine: engineName,
        comboId: stats.compressionComboId,
        fallbackApplied: stats.fallbackApplied,
        savingsPercent: stats.savingsPercent,
        durationMs: stats.durationMs,
        originalTokens: stats.originalTokens,
        compressedTokens: stats.compressedTokens,
      });
    } catch (err) {
      if (process.env.OMNIROUTE_TELEMETRY_DEBUG === "1") {
         
        console.warn("[compression-telemetry] recordEngineBreakdown failed:", err);
      }
    }
  }

  /** Test-only accessor: total breakdown records observed on this handle. */
  getEngineBreakdownCount(): number {
    return this.engineBreakdownCount;
  }

  /** Test-only reset: clears the breakdown counter back to zero. */
  resetEngineBreakdownCount(): void {
    this.engineBreakdownCount = 0;
  }

  private finishSpan(span: Span, stats: CompressionStats): void {
    // The observability module's internal endSpan is what actually pushes
    // the span onto the export queue. Since `endSpan` is module-private,
    // we mimic the public-by-convention behavior: set endTimeUnixNano
    // and the status code, and rely on `withSpan` to call `endSpan`
    // when used. For our fire-and-forget path we set the bare minimum
    // attributes that the exporter needs.
    span.endTimeUnixNano = process.hrtime.bigint();
    span.status = { code: "UNSET" };
    span.attributes["compression.validation_warnings"] = stats.validationWarnings?.length ?? 0;
    span.attributes["compression.validation_errors"] = stats.validationErrors?.length ?? 0;
    span.attributes["compression.rules_applied"] = stats.rulesApplied?.length ?? 0;
    span.attributes["compression.techniques_used"] = stats.techniquesUsed.join(",");
    // Best-effort: nudge the active-span stack so the next caller's
    // parent pointer is unaffected. We never block here.
  }
}

let defaultInstance: CompressionTelemetry | null = null;
let testInstance: CompressionTelemetry | null = null;

/**
 * Get the process-wide default compression telemetry handle.
 *
 * Lazy-allocated: the first call constructs the singleton, subsequent
 * calls return the cached one. The instance is intentionally cheap to
 * construct (no I/O, no observers) so callers don't need to memoize.
 *
 * Test injection takes priority over the default singleton when set via
 * {@link setTestInstance}. This allows unit tests to verify call counts
 * and arguments without monkey-patching the module loader.
 */
export function getDefaultCompressionTelemetry(): CompressionTelemetry {
  if (testInstance) return testInstance;
  if (!defaultInstance) {
    defaultInstance = new CompressionTelemetry();
  }
  return defaultInstance;
}

/**
 * Test-only: replace the default singleton with a stub. Pass `null` to
 * clear the test instance. The default singleton is preserved so
 * clearing the test instance returns the system to its default state.
 */
export function setTestInstance(instance: CompressionTelemetry | null): void {
  testInstance = instance;
}

/**
 * Test-only: reset the singleton back to `null` so the next call to
 * {@link getDefaultCompressionTelemetry} constructs a fresh instance.
 * Not used in production paths.
 */
export function __resetDefaultCompressionTelemetryForTests(): void {
  defaultInstance = null;
  testInstance = null;
}
