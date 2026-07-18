/**
 * F — Wire Prometheus /metrics endpoint.
 *
 * Mounted at /metrics by the Next.js App Router.
 * Delegates to metricsEdges for polyglot-specific counters.
 */
import { metricsRenderHandler } from "./edges/metricsEdges.ts";

export async function handleMetricsRequest(): Promise<Response> {
  const result = await metricsRenderHandler("prometheus");
  if (result.ok) {
    return new Response(result.value, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("# polyglot metrics temporarily unavailable", {
    status: 503,
  });
}
