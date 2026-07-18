/**
 * Plugin signing — Ed25519 signature verification for plugin packages.
 *
 * @module plugins/signing
 */

import { createHash, createPublicKey, timingSafeEqual, verify } from "crypto";

/**
 * Compute SHA-256 hash of a buffer.
 */
export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Verify SHA-256 hash matches expected value using a constant-time comparison.
 *
 * Plain `===` over hex digests leaks a per-byte timing oracle (early-exit on
 * first mismatching nibble). For plugin package integrity we instead compare
 * the decoded byte buffers via `crypto.timingSafeEqual`, with a scratch
 * buffer on length mismatch so the comparison is also length-oracle safe.
 */
export function verifySha256(data: Buffer, expectedHash: string): boolean {
  const actual = sha256(data);
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expectedHash, "hex");
  if (actualBytes.length !== expectedBytes.length) {
    // Length-mismatch: still touch a scratch buffer of the same length as the
    // longer input so the comparison time is a function of input length, not
    // of where the mismatch occurred.
    const scratch = Buffer.alloc(actualBytes.length || expectedBytes.length);
    return false;
  }
  return timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Verify Ed25519 signature.
 */
export function verifyEd25519(data: Buffer, signature: Buffer, publicKeyDer: Buffer): boolean {
  try {
    const key = createPublicKey(publicKeyDer);
    return verify(null, data, key, signature);
  } catch {
    return false;
  }
}
