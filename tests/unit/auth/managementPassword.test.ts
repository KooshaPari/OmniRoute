// Management-password KDF contract (bcrypt).
//
// Converted from a vitest suite that lived under tests/unit/vitest/ and was never
// collected by a runner. node:test is the runner that owns tests/unit/auth/**, so
// this file runs in the unit shards instead of waiting for a vitest slot.
import test from "node:test";
import assert from "node:assert/strict";
import {
  hashManagementPassword,
  verifyManagementPassword,
  isBcryptHash,
} from "../../../src/lib/auth/managementPassword";

const STRONG_PASSWORD = "Correct-Horse-Battery-Staple-2026!";
const WRONG_PASSWORD = "wrong-password";

test("hashes with bcrypt by default", async () => {
  const hash = await hashManagementPassword(STRONG_PASSWORD);
  assert.equal(isBcryptHash(hash), true);
  // argon2id is no longer accepted: the management-password KDF is bcrypt.
  assert.equal(isBcryptHash("$argon2id$v=19$m=19456,t=2,p=1$abcd"), false);
});

test("verifies a freshly-hashed bcrypt password", async () => {
  const hash = await hashManagementPassword(STRONG_PASSWORD);
  assert.equal(await verifyManagementPassword(STRONG_PASSWORD, hash), true);
  assert.equal(await verifyManagementPassword(WRONG_PASSWORD, hash), false);
});

test("detects bcrypt hashes by prefix", () => {
  // A real bcrypt hash is exactly 60 chars: $2b$NN$ + 53 chars of salt+digest.
  assert.equal(isBcryptHash(`$2b$10$${"a".repeat(53)}`), true);
  assert.equal(isBcryptHash(`$2a$10$${"b".repeat(53)}`), true);
  // Truncated / partial hashes must not be accepted as "already hashed".
  assert.equal(isBcryptHash("$2b$10$short"), false);
  assert.equal(isBcryptHash("$argon2id$v=19$abcd"), false);
});

test("rejects empty / malformed passwords", async () => {
  // Empty and whitespace-only passwords are an auth bypass: the callers guard
  // with truthiness only, so "   " would otherwise hash to a usable password.
  await assert.rejects(() => hashManagementPassword(""), /must not be empty/);
  await assert.rejects(() => hashManagementPassword("   "), /must not be empty/);
  assert.equal(await verifyManagementPassword(STRONG_PASSWORD, ""), false);
  assert.equal(await verifyManagementPassword(STRONG_PASSWORD, "garbage"), false);
  // A legacy argon2id hash must not authenticate: the KDF is bcrypt only.
  assert.equal(
    await verifyManagementPassword(STRONG_PASSWORD, "$argon2id$v=19$m=19456,t=2,p=1$abcd"),
    false
  );
});

test("verifyManagementPassword still accepts legacy bcrypt hashes (no upgrade required)", async () => {
  const bcrypt = await import("bcryptjs");
  const legacyHash = await bcrypt.hash(STRONG_PASSWORD, 10);
  assert.equal(isBcryptHash(legacyHash), true);
  assert.equal(await verifyManagementPassword(STRONG_PASSWORD, legacyHash), true);
  assert.equal(await verifyManagementPassword(WRONG_PASSWORD, legacyHash), false);
});
