/**
 * Shared error shape for dispatch RPC edges (ADR-032).
 *
 * Every transport (HTTP / UDS / FFI) throws `DispatchEdgeError` with a
 * stable `.code` enum so callers can branch on the failure mode without
 * parsing error strings.
 *
 * Code namespaces:
 *   HTTP_<status>     — upstream HTTP returned a non-2xx.
 *   HTTP_TRANSPORT_ERROR — fetch failed (network, DNS, etc).
 *   UDS_<code>        — server returned a JSON-RPC error code.
 *   UDS_TIMEOUT       — call exceeded its timeout budget.
 *   UDS_CLOSED        — socket closed before the response.
 *   UDS_NO_CONNECTION — socket not yet connected (resolver should fallback).
 *   FFI_ABI_MISMATCH  — crate `version()` symbol doesn't match.
 *   FFI_NOT_AVAILABLE — crate file is missing on disk.
 *   FFI_SYMBOL_NOT_FOUND — crate loaded but the requested symbol is absent.
 *   FFI_CALL_FAILED   — call threw on the C side.
 *   HANDLER_ERROR     — server-side handler threw.
 *
 * @see ADR-032 § "Consequences"
 */

export class DispatchEdgeError extends Error {
  code: string;
  status?: number;
  payload?: unknown;

  constructor(message: string, code: string, options?: { status?: number; payload?: unknown }) {
    super(message);
    this.name = "DispatchEdgeError";
    this.code = code;
    if (options?.status !== undefined) this.status = options.status;
    if (options?.payload !== undefined) this.payload = options.payload;
  }
}

export function isDispatchEdgeError(error: unknown): error is DispatchEdgeError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in (error as Record<string, unknown>) &&
      typeof (error as { code?: string }).code === "string"
  );
}

/**
 * Map a dispatch edge error to a tier-degradation decision. Returns the
 * tier to use as a fallback, or `null` if no degradation is appropriate.
 *
 * Default behavior: any non-fatal transport error degrades from T3 → T2 → T1.
 */
export function degradationFallback(error: DispatchEdgeError, currentTier: "T1" | "T2" | "T3"): "T1" | "T2" | "T3" | null {
  if (currentTier === "T1") return null;

  if (currentTier === "T3" && (error.code === "FFI_NOT_AVAILABLE" || error.code === "FFI_ABI_MISMATCH")) {
    return "T2";
  }
  if (currentTier === "T3") return "T2";

  if (currentTier === "T2" && (error.code === "UDS_NO_CONNECTION" || error.code === "UDS_TIMEOUT" || error.code === "UDS_CLOSED")) {
    return "T1";
  }

  return null;
}
