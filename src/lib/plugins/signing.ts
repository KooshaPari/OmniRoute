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
 * Verify SHA-256 hash matches expected value.
 *
 * Uses `crypto.timingSafeEqual` so the comparison time does not depend on
 * the position or number of matching bytes, closing a timing-side-channel
 * that would otherwise let an attacker probe for the expected digest.
 */
export function verifySha256(data: Buffer, expectedHash: string): boolean {
  const actual = sha256(data);
  const expected = expectedHash.toLowerCase();
  if (actual.length !== expected.length) {
    // Burn a constant-time comparison against a same-length scratch to
    // avoid leaking via a fast length-mismatch short-circuit.
    const scratch = Buffer.alloc(actual.length);
    timingSafeEqual(Buffer.from(actual), scratch);
    return false;
  }
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
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
