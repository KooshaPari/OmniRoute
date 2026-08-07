import { test } from "node:test";
import assert from "node:assert";
import {
  decryptStrict,
  encryptStrict,
  decryptStrictConnectionFields,
  encryptStrictConnectionFields,
  EncryptionDecryptionError,
} from "../../../src/lib/db/encryption.ts";

/**
 * Tests for the strict-mode encryption helpers added in the F8 followup.
 *
 * IMPORTANT: src/lib/db/encryption.ts caches the derived key at module
 * load time. Tests are ordered so "no-key" assertions run BEFORE any
 * test that sets STORAGE_ENCRYPTION_KEY (since once cached, the key
 * stays even after the env var is deleted).
 */

test("EncryptionDecryptionError: carries classification + ciphertextPrefix + cause", () => {
  const err = new EncryptionDecryptionError("test message", {
    cause: new Error("underlying"),
    ciphertextPrefix: "enc:v1:abc:def:ghi",
    classification: "auth-tag-failure",
  });
  assert.strictEqual(err.name, "EncryptionDecryptionError");
  assert.strictEqual(err.classification, "auth-tag-failure");
  assert.strictEqual(err.ciphertextPrefix, "enc:v1:abc:def:ghi");
  assert.ok(err.cause instanceof Error);
  assert.strictEqual(err.message, "test message");
});

test("decryptStrict() with null returns null (passthrough)", () => {
  assert.strictEqual(decryptStrict(null), null);
});

test("decryptStrict() with undefined returns undefined (passthrough)", () => {
  assert.strictEqual(decryptStrict(undefined), undefined);
});

test("decryptStrict() with non-encrypted string returns as-is", () => {
  const plaintext = "not-encrypted-string";
  assert.strictEqual(decryptStrict(plaintext), plaintext);
});

test("encryptStrict() throws EncryptionDecryptionError when STORAGE_ENCRYPTION_KEY is unset", () => {
  // Runs before any test sets STORAGE_ENCRYPTION_KEY — module cache is still null
  assert.strictEqual(
    process.env.STORAGE_ENCRYPTION_KEY,
    undefined,
    "precondition: env var must be unset for this test",
  );
  assert.throws(
    () => encryptStrict("plaintext"),
    (err) => {
      assert.ok(err instanceof EncryptionDecryptionError);
      assert.strictEqual(err.classification, "not-configured");
      return true;
    },
  );
});

test("with STORAGE_ENCRYPTION_KEY set: round-trip + malformed + bad auth tag", () => {
  // All "with-key" tests in one block since module caches _staticKey
  process.env.STORAGE_ENCRYPTION_KEY = "test-key-for-encryption-strict-test";

  // Round-trip works
  const plaintext = "my-secret-api-key-12345";
  const encrypted = encryptStrict(plaintext);
  assert.ok(encrypted && encrypted.startsWith("enc:v1:"), "should be encrypted");
  assert.strictEqual(decryptStrict(encrypted), plaintext, "round-trip should succeed");

  // Already-encrypted is preserved (no double-encrypt)
  assert.strictEqual(encryptStrict(encrypted), encrypted, "already-encrypted is preserved");

  // Malformed ciphertext throws
  assert.throws(
    () => decryptStrict("enc:v1:invalid"),
    (err) => {
      assert.ok(err instanceof EncryptionDecryptionError);
      assert.strictEqual(err.classification, "malformed");
      assert.ok(err.ciphertextPrefix && err.ciphertextPrefix.length > 0);
      return true;
    },
  );

  // Bad auth tag throws (garbage iv + ct + authTag)
  assert.throws(
    () =>
      decryptStrict(
        "enc:v1:00000000000000000000000000000000:0000:00000000000000000000000000000000",
      ),
    (err) => {
      assert.ok(err instanceof EncryptionDecryptionError);
      assert.ok(
        err.classification === "auth-tag-failure" || err.classification === "malformed",
        `expected auth-tag-failure or malformed, got: ${err.classification}`,
      );
      assert.ok(err.cause, "should have underlying cause");
      return true;
    },
  );

  // decryptStrictConnectionFields round-trip
  const conn = {
    apiKey: "plaintext-api-key",
    accessToken: "plaintext-access-token",
    refreshToken: "plaintext-refresh-token",
    idToken: "plaintext-id-token",
    name: "should-not-be-encrypted",
  };
  const encrypted2 = encryptStrictConnectionFields(conn);
  assert.ok(encrypted2.apiKey?.startsWith("enc:v1:"));
  assert.ok(encrypted2.accessToken?.startsWith("enc:v1:"));
  assert.ok(encrypted2.refreshToken?.startsWith("enc:v1:"));
  assert.ok(encrypted2.idToken?.startsWith("enc:v1:"));
  assert.strictEqual(encrypted2.name, "should-not-be-encrypted");

  const decrypted = decryptStrictConnectionFields(encrypted2);
  assert.strictEqual(decrypted.apiKey, "plaintext-api-key");
  assert.strictEqual(decrypted.accessToken, "plaintext-access-token");
  assert.strictEqual(decrypted.refreshToken, "plaintext-refresh-token");
  assert.strictEqual(decrypted.idToken, "plaintext-id-token");

  // decryptStrictConnectionFields throws on corrupted field
  const corrupted = {
    apiKey: "enc:v1:invalid",
    accessToken: null,
    refreshToken: null,
    idToken: null,
  };
  assert.throws(
    () => decryptStrictConnectionFields(corrupted),
    (err) => {
      assert.ok(err instanceof EncryptionDecryptionError);
      assert.strictEqual(err.classification, "malformed");
      return true;
    },
  );
});
