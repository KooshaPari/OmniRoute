/**
 * Combo Span — wraps `handleComboChat` in a parent span (B10 of v8.1).
 *
 * The combo service (Tier-2) fans out to multiple providers (Bifrost,
 * direct OpenAI/Anthropic, etc.) in parallel for fallback / load
 * balancing. The wrapper fuses all those parallel provider spans
 * under a single parent span so a single distributed trace covers
 * the whole combo decision + every provider attempt.
 *
 * How the fusion works (OTel context propagation):
 *
 *   1. We call `tracer.startSpan("combo.execute ...", { kind: INTERNAL })`.
 *   2. We wrap the inner `handleComboChat(...)` call in
 *      `context.with(trace.setSpan(ctx, parentSpan), ...)` so that any
 *      span created inside — including the `bifrost.execute` spans
 *      emitted by `withBifrostSpan` — automatically attaches to this
 *      combo span as a child.
 *   3. After the inner call resolves, we end the parent span with
 *      the appropriate status (OK or ERROR) and the resolution that
 *      the combo ended up picking.
 *
 * Context propagation across the SDK boundary is the critical bit:
 * without `context.with(...)`, child spans would be siblings of the
 * combo span (or orphans), not children. The OTel API package
 * provides `context` and `trace` namespaces for this exact purpose.
 *
 * Span attributes:
 *
 *   - `combo.name`         — combo name (e.g. "gpt-4o-mini-combo")
 *   - `combo.strategy`     — routing strategy (priority, weighted, …)
 *   - `combo.candidates`   — number of resolved candidate targets
 *   - `combo.resolved`     — the model that ultimately won (set on success)
 *   - `combo.attempts`     — total provider attempts (set after success/failure)
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md (ADR-031),
 * `open-sse/services/combo.ts` (the wrapped function),
 * PLAN.md § 2.5.2 (B10).
 *
 * @module open-sse/observability/comboSpan
 */

import {
  SpanStatusCode,
  SpanKind,
  type Span,
  context as otelContext,
  trace as otelTrace,
} from "@opentelemetry/api";
import { getTracer, recordException, isOtelEnabled } from "./otelExporter.ts";

/**
 * Minimal input shape — only the fields needed for span attributes.
 * The full `HandleComboChatOptions` from combo.ts is not imported
 * to avoid a circular dependency.
 */
export interface ComboSpanInput {
  /** Combo name (e.g. "my-fallback-combo"). */
  comboName: string;
  /** Routing strategy (e.g. "priority", "weighted", "p2c"). */
  strategy: string;
  /**
   * Total number of resolved candidate targets before fan-out.
   * We record this as `combo.candidates` so a trace view shows
   * "how wide was the fan-out?" without needing to walk children.
   */
  candidateCount: number;
}

export interface ComboSpanResult<R> {
  /** Whatever the inner function returned. */
  result: R;
  /** The combo parent span (already ended). */
  span: Span;
  /**
   * The candidate that won the combo, when we can detect it from
   * the result. The wrapper does its best-effort extraction:
   * Bifrost responses carry `x-bifrost-model` headers; OpenAI-style
   * JSON responses carry a `model` field; failures return null.
   */
  resolvedModel: string | null;
}

/**
 * Wrap an invocation of `handleComboChat` in a parent span that
 * fuses all parallel provider spans into one tree.
 *
 * This is safe to call when OTel is disabled — the no-op tracer
 * yields a non-recording parent span that is still attached to the
 * current OTel context, so any child spans inside still get a
 * coherent (but unsampled) tree.
 */
export async function withComboSpan<T>(
  input: ComboSpanInput,
  fn: (span: Span) => Promise<T>
): Promise<ComboSpanResult<T>> {
  const tracer = getTracer("omniroute.combo");
  const parentSpan = tracer.startSpan(
    `combo.execute ${input.comboName} (${input.strategy})`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "combo.name": input.comboName,
        "combo.strategy": input.strategy,
        "combo.candidates": input.candidateCount,
        "otel.enabled": isOtelEnabled(),
      },
    }
  );

  // Attach the parent span to the active OTel context. Any span
  // created inside `fn` (via `startSpan` or `startActiveSpan`) will
  // pick this up as its parent automatically — that's the whole
  // point of `context.with`.
  const parentCtx = otelTrace.setSpan(otelContext.active(), parentSpan);

  try {
    const result = await otelContext.with(parentCtx, () => fn(parentSpan));
    parentSpan.setAttribute("combo.resolved", safeExtractResolvedModel(result));
    parentSpan.setStatus({ code: SpanStatusCode.OK });
    return {
      result,
      span: parentSpan,
      resolvedModel: safeExtractResolvedModel(result),
    };
  } catch (err) {
    recordException(parentSpan, err);
    parentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    parentSpan.end();
  }
}

/**
 * Best-effort extraction of the resolved model name from a combo
 * result. The result type from `handleComboChat` is `Promise<Response>`,
 * but the wrapper does not require that exact type — callers may
 * pass any value through. We sniff for the common shapes:
 *
 *   1. `Response` with a `x-bifrost-model` header (Bifrost upstream).
 *   2. `Response` whose JSON body has a `model` field.
 *   3. Plain object with a `model` or `resolvedModel` field.
 *
 * Returns `null` when nothing matches — this is a soft failure;
 * the combo span still records `combo.candidates` so the trace view
 * shows the fan-out even without the resolution.
 */
function safeExtractResolvedModel(result: unknown): string | null {
  if (!result) return null;

  // Response-like
  if (typeof Response !== "undefined" && result instanceof Response) {
    const hdr = result.headers?.get?.("x-bifrost-model");
    if (hdr) return hdr;
    const hdr2 = result.headers?.get?.("x-omniroute-resolved-model");
    if (hdr2) return hdr2;
    // Don't await body.json() — that would consume the stream.
    // The caller can populate the resolved attribute themselves
    // by passing a custom `fn` closure.
    return null;
  }

  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.model === "string") return obj.model;
    if (typeof obj.resolvedModel === "string") return obj.resolvedModel;
    if (typeof obj.resolved_model === "string") return obj.resolved_model;
    if (typeof obj.winningModel === "string") return obj.winningModel;
  }

  return null;
}
