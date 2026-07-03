export type ComboDecisionTrace = {
  strategy: string;
  provider: string;
  model: string;
  connectionId?: string | null;
  fallbackCount?: number;
  latencyMs?: number;
};

export function buildComboDecisionTraceHeader(trace: ComboDecisionTrace): string {
  const params = new URLSearchParams({
    strategy: trace.strategy,
    provider: trace.provider,
    model: trace.model,
  });

  if (trace.connectionId) params.set("connectionId", trace.connectionId);
  if (typeof trace.fallbackCount === "number")
    params.set("fallbackCount", String(trace.fallbackCount));
  if (typeof trace.latencyMs === "number") params.set("latencyMs", String(trace.latencyMs));

  return params.toString();
}

export function withComboDecisionTraceHeader(
  response: Response,
  trace: ComboDecisionTrace
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-OmniRoute-Decision", buildComboDecisionTraceHeader(trace));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function getSelectedConnectionId(result: { headers?: Headers | null }): string | undefined {
  const headers = result.headers;
  return (
    headers?.get("X-OmniRoute-Selected-Connection-Id") ||
    headers?.get("x-omniroute-selected-connection-id") ||
    undefined
  );
}
