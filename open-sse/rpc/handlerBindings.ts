/**
 * Edge handler bindings for in-process invocation.
 *
 * Routes `invoke(edgeName, …)` to the canonical TypeScript implementation
 * when no UDS server is bound or when the tier is T1 (HTTP or in-process).
 *
 * This module exists as the single seam where T2 handlers can be made
 * available — and where T3 FFI symbol lookups can short-circuit to the
 * TypeScript reference implementation if the crate is missing.
 */

import { invoke, listEdges, registerEdge, getEdge } from "./dispatchEdges.ts";
import type { EdgeTier } from "./dispatchEdges.ts";

// Compression edges — wrapped in their own module.
import "./edges/compressionEdges.ts";
// Guardrails edges.
import "./edges/guardrailsEdges.ts";
// Combo scoring edges (T3 FFI in production, TS fast-path in dev).
import "./edges/scoringEdges.ts";
// Semantic cache + reasoning replay.
import "./edges/cacheEdges.ts";
// SSE chunking.
import "./edges/sseEdges.ts";

export { invoke, listEdges, registerEdge, getEdge };
export type { EdgeTier };
export * from "./errors.ts";
export * from "./udsServer.ts";
