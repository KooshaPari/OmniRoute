/**
 * E — Webhook dispatch edges (T1 dispatch, T2 signing).
 *
 * dispatch: network-bound HTTP call → T1 (no FFI benefit).
 * sign: HMAC signing, CPU-bound → T2 candidate for UDS RPC.
 */
import { registerEdge, getEdgeTier } from "../dispatchEdges.ts";
import type { DispatchEdgeResult } from "../dispatchEdges.ts";

registerEdge({ name: "webhook.dispatch", defaultTier: 1, providerScope: ["*"] });
registerEdge({ name: "webhook.sign", defaultTier: 2, providerScope: ["*"] });

export async function webhookDispatchHandler(
  event: string,
  payload: unknown,
): Promise<DispatchEdgeResult<{ delivered: number; failed: number }>> {
  const { dispatchWebhook } = await import("../../lib/webhookDispatcher.ts");
  const result = await dispatchWebhook(event, payload);
  return { ok: true, value: result };
}

export async function webhookSignHandler(
  payload: string,
  secret: string,
): Promise<DispatchEdgeResult<{ signature: string }>> {
  const tier = getEdgeTier("webhook.sign");
  if (tier <= 2) {
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    return { ok: true, value: { signature: sig } };
  }
  // T3 — delegate to FFI (future: Rust HMAC crate)
  return { ok: true, value: { signature: "" } };
}
