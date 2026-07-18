import { registerEdge, type EdgeDefinition } from "../polyglotEdges";

/**
 * Per-provider rate-limit token-bucket edge.
 *
 * Modeled after ADR-032 § F5 / DEBT-001. Each provider×model combo gets
 * a (TPM, TPD) bucket pair. The hot path checks BOTH buckets atomically
 * before allowing the request.
 *
 * Tier mapping:
 *   T1 — HTTP loopback  (legacy fallback)
 *   T2 — UDS RPC        (NEVER used here; too much overhead vs FFI)
 *   T3 — Native ABI FFI (default — Rust `token-bucket` crate, ~80 ns)
 *
 * @see docs/TECH_DEBT.md DEBT-001
 * @see crates/omniroute-ffi/crates/token-bucket/src/lib.rs
 * @see open-sse/services/rateLimitManager.ts
 */
const t1TokenBucketHandler = async (
  args: { bucketId: string; tokens: number; nowMs: number },
): Promise<{ allowed: boolean; retryAfterMs: number; tier: "T1" | "T2" | "T3"; source: string }> => {
  const { consumeTokenBucket } = await import("./tokenBucketFfi");
  try {
    const result = await consumeTokenBucket(args.bucketId, args.tokens, args.nowMs);
    return { ...result, tier: "T3", source: "rust-token-bucket" };
  } catch {
    // Fallback to TS implementation
    const { consumeTokenBucketTs } = await import("./tokenBucketFfi");
    const bucket = {
      tpmAllowance: 1_000_000,
      tpmLastRefillMin: args.nowMs / 60000 - 60,
      tpdAllowance: 1_000_000,
      tpdLastRefillDay: Math.floor(args.nowMs / 86_400_000) - 1,
    };
    const result = consumeTokenBucketTs(
      bucket,
      1_000_000,
      1_000_000,
      args.tokens,
      args.nowMs,
    );
    return { ...result, tier: "T1", source: "ts-fallback" };
  }
};

export const tokenBucketEdge: EdgeDefinition = {
  name: "ratelimit.token.consume",
  providerScope: ["*"], // global — applies to all providers
  defaultTier: "T3",
  fallbackTier: "T1",
  healthcheck: async () => {
    try {
      const { loadTokenBucketFfi } = await import("./tokenBucketFfi");
      const ffi = await loadTokenBucketFfi();
      return ffi ? "ok" : null;
    } catch {
      return null;
    }
  },
  invoke: async (args: { bucketId: string; tokens: number; nowMs: number }) => t1TokenBucketHandler(args),
};

// Auto-register on module load (consistent with other edges)
registerEdge(tokenBucketEdge);
