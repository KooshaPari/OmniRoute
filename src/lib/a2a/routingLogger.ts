/**
 * A2A Routing Decision Logger
 *
 * Each decision is enriched with W3C trace context (trace_id / span_id)
 * from the active OpenTelemetry span, falling back to synthetic
 * W3C-compatible IDs when no OTel SDK is installed.
 *
 * In development, the full decision is printed to the console.
 * In production, it is persisted to the `routing_decisions` DB table
 * (see src/lib/db/routingDecisions.ts).
 *
 * Integration tiers:
 *   1. `@pheno-otel/tracing` — sibling Rust-to-JS bridge
 *   2. `@opentelemetry/api` — standard OTel JS API
 *   3. Synthetic W3C-compatible IDs via `node:crypto` (always available)
 */

import { getActiveSpanContext } from "./otelContext";
import { saveRoutingDecision } from "@/lib/db/routingDecisions";

export interface RoutingDecision {
  /** Optional UUID; auto-assigned when persisted. */
  id?: string;
  taskType: string;
  comboId: string;
  providerSelected: string;
  modelUsed: string;
  score: number;
  factors: string[];
  fallbacksTriggered: string[];
  success: boolean;
  latencyMs: number;
  cost: number;
  traceId?: string;
  spanId?: string;
}

/**
 * Log a routing decision with trace context enrichment.
 *
 * Hydrates `traceId` and `spanId` from the active OpenTelemetry span
 * (or synthetic context) when the caller hasn't already supplied them.
 * This ensures backward compatibility — existing callers that pass
 * explicit trace IDs see them preserved.
 *
 * In development, the full decision is printed to the console.
 * In production, it is persisted to the audit table.
 */
export function logRoutingDecision(decision: RoutingDecision): void {
  // Hydrate trace context if not already set by the caller
  if (!decision.traceId || !decision.spanId) {
    const ctx = getActiveSpanContext();
    if (ctx) {
      if (!decision.traceId) decision.traceId = ctx.traceId;
      if (!decision.spanId) decision.spanId = ctx.spanId;
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[A2A ROUTING]", JSON.stringify(decision, null, 2));
  }

  // Persist to database audit table for production (fire-and-forget)
  try {
    saveRoutingDecision(decision);
  } catch {
    // Silently swallow — logging should never throw.
    // The DB module returns null when the table doesn't exist (pre-migration),
    // so this catch only fires on actual DB errors (disk full, etc.).
  }
}
