import { test } from "node:test";
import assert from "node:assert";
import { decrypt } from "../../../src/lib/db/encryption.ts";

test("decrypt() with invalid auth tag should not crash and return null", () => {
  const invalidCiphertext = "enc:v1:0000:0000:0000";
  const result = decrypt(invalidCiphertext);

  // Lenient decrypt() returns null on auth-tag failure (caller treats null
  // as "no usable key"). The structured logger records the failure with
  // the ciphertext prefix for debugging. For strict-mode behavior, use
  // decryptStrict() which throws EncryptionDecryptionError.
  assert.strictEqual(result, null, "Should return null on auth-tag failure");
});

test("decrypt() with malformed ciphertext should return null", () => {
  const malformed = "enc:v1:invalid";
  const result = decrypt(malformed);

  // Wrong segment count is a structural failure — return null, log the
  // malformed prefix for debugging.
  assert.strictEqual(result, null, "Should return null on malformed ciphertext");
});

test("decrypt() with null should return null", () => {
  const result = decrypt(null);
  assert.strictEqual(result, null, "Should return null for null input");
});

test("decrypt() with undefined should return undefined", () => {
  const result = decrypt(undefined);
  assert.strictEqual(result, undefined, "Should return undefined for undefined input");
});

test("decrypt() with non-encrypted string should return as-is", () => {
  const plaintext = "this-is-not-encrypted";
  const result = decrypt(plaintext);
  assert.strictEqual(result, plaintext, "Should return plaintext unchanged");
});
