/**
 * T1 — HTTP loopback transport for polyglot edges.
 *
 * Wraps `fetch` with the polyglot-edge conventions:
 *   - JSON request/response bodies.
 *   - Per-edge timeout (defaults to 5s, well above the 1-2ms loopback budget).
 *   - AbortSignal propagation.
 *   - Error enrichment: surfaces the upstream status code in the thrown
 *     `PolyglotEdgeError` so callers can distinguish 4xx (caller's fault)
 *     vs 5xx (binding's fault).
 *
 * Loopback URIs default to `http://127.0.0.1:${process.env.OMNIROUTE_HTTP_PORT ?? "20128"}`,
 * matching the canonical OmniRoute Next.js dev port from `.env.example`.
 * A `OMNIROUTE_EDGE_HTTP_BASE` override prefixes all edge HTTP calls in
 * multi-node deployments (test clusters, fleet sharding).
 */

import type { HttpEdgeContract, InvokeOptions } from "./polyglotEdges.ts";
import type { PolyglotEdgeError } from "./errors.ts";

const DEFAULT_HTTP_PORT = "20128";
const DEFAULT_HTTP_BASE = () =>
  process.env.OMNIROUTE_EDGE_HTTP_BASE ?? `http://127.0.0.1:${process.env.OMNIROUTE_HTTP_PORT ?? DEFAULT_HTTP_PORT}`;

export async function invokeHttpEdge<TIn, TOut>(
  contract: HttpEdgeContract<TIn, TOut>,
  input: TIn,
  options: InvokeOptions = {}
): Promise<TOut> {
  const timeoutMs = options.timeoutMs ?? contract.timeoutMs ?? 5000;
  const base = DEFAULT_HTTP_BASE();
  const url = `${base}${contract.path}`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error(`HTTP edge timeout after ${timeoutMs}ms`)), timeoutMs);

  // Bridge caller-provided AbortSignal to our controller.
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", () => controller.abort(options.signal!.reason), { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await safeReadJson(response);
      const err: PolyglotEdgeError = new Error(
        `HTTP edge ${contract.path} returned ${response.status}: ${JSON.stringify(errorPayload).slice(0, 256)}`
      );
      err.code = `HTTP_${response.status}`;
      err.status = response.status;
      err.payload = errorPayload;
      throw err;
    }

    return (await response.json()) as TOut;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    if ((error as { code?: string })?.code) throw error; // Already a PolyglotEdgeError.

    const err: PolyglotEdgeError = new Error(
      `HTTP edge ${contract.path} failed: ${error instanceof Error ? error.message : String(error)}`
    );
    err.code = "HTTP_TRANSPORT_ERROR";
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Smoke-test an HTTP edge. Returns null on success or a string error.
 * Used by `PolyglotEdge.healthcheck`.
 */
export async function healthcheckHttpEdge(contract: HttpEdgeContract<unknown, unknown>): Promise<string | null> {
  try {
    const base = DEFAULT_HTTP_BASE();
    const url = `${base}${contract.path}/health`;
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(2000) });
    if (response.ok) return null;
    return `HTTP healthcheck returned ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
