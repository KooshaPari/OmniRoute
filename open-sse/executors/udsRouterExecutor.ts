// UDS Router Executor — proxies chat completion requests to the Rust data plane
// over a Unix Domain Socket. Registered as a fallback-compatible executor that
// takes priority when the Rust data plane socket is available.
//
// Integration flow:
//   chatCore.ts → getExecutor() → UdsRouterExecutor
//     → forwardToDataPlane() → net.Socket → omniroute-runtime (Rust)
//     → failover: return null → chatCore falls back to DefaultExecutor
//
// Reference: plans/2026-07-05-omniroute-rust-data-plane-v1.md §9 Phase 5
//            SPEC.md §17 polyglot binding tiers (T2 UDS RPC)

import { type ExecutorResult, type ModelInfo } from "@/open-sse/types.d";
import { forwardToDataPlane, udsHealthCheck, getSocketPath } from "@/open-sse/services/udsRouter";
import logger from "@/lib/logger";

export const UDS_ROUTER_EXECUTOR_ID = "uds-router";

/**
 * Attempts to forward a chat completion request through the Rust data plane.
 *
 * Returns an ExecutorResult on success, or null if:
 *   - The UDS socket is not available
 *   - The request times out or fails
 *
 * Callers MUST fall back to their own executor when this returns null.
 */
export async function executeViaUdsRouter(
  provider: string,
  model: string,
  messages: unknown[],
  apiKey: string,
  extraBody?: Record<string, unknown>
): Promise<ExecutorResult | null> {
  if (!udsHealthCheck()) {
    return null;
  }

  const body = JSON.stringify({
    model,
    messages,
    stream: false,
    ...(extraBody ?? {}),
  });

  const result = await forwardToDataPlane(body, apiKey, provider);

  if (!result) {
    logger.debug({ provider }, "uds-executor: forward returned null, fallback");
    return null;
  }

  if (result.statusCode >= 400) {
    logger.warn({ statusCode: result.statusCode, provider }, "uds-executor: upstream error");
    return null;
  }

  // Parse the JSON response body
  try {
    const parsed = JSON.parse(result.body);
    return parsed as ExecutorResult;
  } catch {
    logger.error({ body: result.body.slice(0, 200) }, "uds-executor: failed to parse response");
    return null;
  }
}

/**
 * Returns diagnostic info about the UDS router connection state.
 */
export function getUdsRouterDiagnostics(): Record<string, unknown> {
  return {
    socketPath: getSocketPath(),
    healthy: udsHealthCheck(),
    executorId: UDS_ROUTER_EXECUTOR_ID,
  };
}
