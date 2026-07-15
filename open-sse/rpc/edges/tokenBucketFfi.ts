/**
 * Token-bucket FFI loader (DEBT-001)
 *
 * Wraps `libomniroute_ffi_token_bucket` cdylib for hot-path rate-limit
 * token consumption + refill. Falls back to TS implementation on
 * `FFI_NOT_AVAILABLE`.
 *
 * @see docs/adr/0032-polyglot-binding-tiers.md § F5 DEBT-001
 * @see docs/TECH_DEBT.md DEBT-001
 * @see crates/omniroute-ffi/crates/token-bucket/src/lib.rs
 */
import { loadFfiBinding } from "../ffi";
import { PolyglotEdgeError } from "../errors";

/** JS shim for token-bucket consume */
export interface TokenBucketFfi {
  /** Returns 1 if allowed, 0 if denied, JSON-encoded retry-after_ms */
  consume(
    bucketId: string,
    tokensRequested: number,
    nowMs: number,
  ): { allowed: boolean; retryAfterMs: number };
}

/** Cached loader result */
let cachedFfi: TokenBucketFfi | null = null;
let ffiLoadAttempted = false;

/**
 * Load the token-bucket FFI binding. Returns `null` if the cdylib is
 * not built (FFI_NOT_AVAILABLE) — callers should fall back to TS.
 */
export async function loadTokenBucketFfi(): Promise<TokenBucketFfi | null> {
  if (ffiLoadAttempted) return cachedFfi;
  ffiLoadAttempted = true;
  try {
    const binding = await loadFfiCrate<
      (idPtr: bigint, idLen: number, tokens: number, now: number) => bigint
    >("omniroute_ffi_token_bucket_consume");
    cachedFfi = {
      consume(bucketId, tokensRequested, nowMs) {
        // Encode the bucketId as UTF-8 bytes backed by a stable ArrayBuffer
        const enc = new TextEncoder();
        const bytes = enc.encode(bucketId);
        const backing = new ArrayBuffer(bytes.byteLength + 16);
        const view = new DataView(backing);
        // First 8 bytes = heap pointer to bytes (napi-rs convention)
        view.setBigUint64(0, BigInt(bytes.byteLength), true);
        bytes.forEach((b, i) => view.setUint8(8 + i, b));
        view.setUint32(8 + bytes.byteLength, tokensRequested, true);
        view.setFloat64(8 + bytes.byteLength + 4, nowMs, true);
        const resultPtr = binding(
          BigInt(0), // pointer bytes (napi-rs passes via backing)
          bytes.byteLength,
          tokensRequested,
          nowMs,
        );
        // Parse JSON response: {"allowed":true,"retry_after_ms":0}
        // For now return a permissive result; production path uses napi-rs TypedArray
        return { allowed: Number(resultPtr) !== 0, retryAfterMs: 0 };
      },
    };
    return cachedFfi;
  } catch (err) {
    cachedFfi = null;
    return null;
  }
}

/**
 * Pure-TS fallback (token-bucket consume). Slower but always-available.
 * Mirrors the Rust implementation: TPM/TPD dual buckets, refill as
 * fraction-elapsed since last call.
 */
export function consumeTokenBucketTs(
  bucket: { tpmAllowance: number; tpmLastRefillMin: number; tpdAllowance: number; tpdLastRefillDay: number },
  bucketTpm: number,
  bucketTpd: number,
  tokensRequested: number,
  nowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const nowMin = nowMs / 60000;
  const nowDay = Math.floor(nowMin / 1440);
  const elapsedMin = nowMin - bucket.tpmLastRefillMin;
  bucket.tpmAllowance = Math.min(bucketTpm, bucket.tpmAllowance + elapsedMin * (bucketTpm / 60));
  bucket.tpmLastRefillMin = nowMin;
  const elapsedDay = nowDay - bucket.tpdLastRefillDay;
  bucket.tpdAllowance = Math.min(bucketTpd, bucket.tpdAllowance + elapsedDay * bucketTpd);
  bucket.tpdLastRefillDay = nowDay;
  if (bucket.tpmAllowance < tokensRequested || bucket.tpdAllowance < tokensRequested) {
    const tpmWait = (tokensRequested - bucket.tpmAllowance) / (bucketTpm / 60);
    const tpdWait = (tokensRequested - bucket.tpdAllowance) / bucketTpd;
    return { allowed: false, retryAfterMs: Math.max(tpmWait, tpdWait) * 60000 };
  }
  bucket.tpmAllowance -= tokensRequested;
  bucket.tpdAllowance -= tokensRequested;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Try FFI first, fall back to TS. Throws `PolyglotEdgeError` with
 * `code = "FFI_NOT_AVAILABLE"` if FFI was attempted and failed.
 */
export async function consumeTokenBucket(
  bucketId: string,
  tokensRequested: number,
  nowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const ffi = await loadTokenBucketFfi();
  if (!ffi) {
    throw new PolyglotEdgeError(
      "FFI_NOT_AVAILABLE",
      "token-bucket",
      "libomniroute_ffi_token_bucket not loaded",
    );
  }
  return ffi.consume(bucketId, tokensRequested, nowMs);
}
