/**
 * E — Usage sync edge (T1 sync, T2 quota check) + Usage FFI crate.
 *
 * usage.sync is network-bound → stay T1 (HTTP loopback).
 * usage.quotaCheck is CPU-bound hash lookup → T2 candidate.
 */
import { registerEdge, invokeEdge, getEdgeTier } from "../polyglotEdges.ts";
import type { PolyglotEdgeResult, PolyglotEdgeErrorUnion } from "../polyglotEdges.ts";

// ── Register edges ────────────────────────────────────────────────────
registerEdge({
  name: "usage.sync",
  defaultTier: 1,
  providerScope: ["*"],
});
registerEdge({
  name: "usage.quotaCheck",
  defaultTier: 2,
  providerScope: ["*"],
});

// ── Tiered handlers ───────────────────────────────────────────────────

export async function usageSyncHandler(
  payload: Record<string, unknown>,
): Promise<PolyglotEdgeResult<Record<string, unknown>>> {
  const tier = getEdgeTier("usage.sync");
  // T1 is the default — pass through to HTTP loopback (delegate to usage.ts)
  if (tier === 1) {
    // Import inline to avoid circular deps
    const { syncUsage } = await import("../../services/usage.ts");
    const result = await syncUsage(payload as any);
    return { ok: true, value: result as unknown as Record<string, unknown> };
  }
  // T2 — delegate to UDS RPC (future)
  return { ok: true, value: { delegated: true, tier } };
}

export async function quotaCheckHandler(
  apiKey: string,
): Promise<PolyglotEdgeResult<{ allowed: boolean; quota: number }>> {
  const tier = getEdgeTier("usage.quotaCheck");
  if (tier <= 2) {
    // Fall through to TS in all practical cases
    const { checkQuota } = await import("../../services/usage.ts");
    const result = await checkQuota(apiKey);
    return { ok: true, value: result };
  }
  // T3 — delegate to FFI (future: Rust hash-lookup crate)
  return { ok: true, value: { allowed: true, quota: 0 } };
}
