/**
 * E2E: Management Password (argon2 hash + verify cycle)
 *
 * Tests the full lifecycle: hash a plaintext password, verify the correct
 * password succeeds, verify a wrong password fails, and confirm the hash
 * is recognised by isArgon2idHash.
 */
import { describe, it, expect } from "vitest";
import {
  hashManagementPassword,
  verifyManagementPassword,
  isArgon2idHash,
  isArgon2Hash,
} from "@/lib/auth/managementPassword";

const TEST_PASSWORD = "Sup3r$ecure!Pass-2026";
const WRONG_PASSWORD = "wrong-password";
const NOOP_UPGRADER = async () => {};

describe("E2E: management password — hash & verify cycle", () => {
  it("hashManagementPassword returns an argon2id hash string", async () => {
    const hash = await hashManagementPassword(TEST_PASSWORD);

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
    // argon2id hashes start with $argon2id$
    expect(hash).toMatch(/^\$argon2(id|i)\$/);
  });

  it("verifyManagementPassword accepts the correct password", async () => {
    const hash = await hashManagementPassword(TEST_PASSWORD);
    const result = await verifyManagementPassword(
      TEST_PASSWORD,
      hash,
      NOOP_UPGRADER,
    );
    expect(result).toBe(true);
  });

  it("verifyManagementPassword rejects a wrong password", async () => {
    const hash = await hashManagementPassword(TEST_PASSWORD);
    const result = await verifyManagementPassword(
      WRONG_PASSWORD,
      hash,
      NOOP_UPGRADER,
    );
    expect(result).toBe(false);
  });

  it("verifyManagementPassword returns false for an empty stored hash", async () => {
    const result = await verifyManagementPassword(
      TEST_PASSWORD,
      "",
      NOOP_UPGRADER,
    );
    expect(result).toBe(false);
  });

  it("isArgon2idHash recognises argon2id hashes", async () => {
    const hash = await hashManagementPassword(TEST_PASSWORD);
    expect(isArgon2idHash(hash)).toBe(true);
  });

  it("isArgon2idHash rejects non-argon2 strings", () => {
    expect(isArgon2idHash("not-a-hash")).toBe(false);
    expect(isArgon2idHash("")).toBe(false);
    expect(isArgon2idHash(null)).toBe(false);
    expect(isArgon2idHash(42)).toBe(false);
  });

  it("isArgon2Hash recognises all argon2 variants", async () => {
    const hash = await hashManagementPassword(TEST_PASSWORD);
    expect(isArgon2Hash(hash)).toBe(true);
    // Non-argon2 strings should fail
    expect(isArgon2Hash("$2b$10$fakeBcryptHash")).toBe(false);
    expect(isArgon2Hash("plaintext")).toBe(false);
  });

  it("two hashes of the same password are different (unique salt)", async () => {
    const hash1 = await hashManagementPassword(TEST_PASSWORD);
    const hash2 = await hashManagementPassword(TEST_PASSWORD);

    // Both should verify correctly
    expect(await verifyManagementPassword(TEST_PASSWORD, hash1, NOOP_UPGRADER)).toBe(true);
    expect(await verifyManagementPassword(TEST_PASSWORD, hash2, NOOP_UPGRADER)).toBe(true);

    // But the raw strings should differ (different random salts)
    expect(hash1).not.toBe(hash2);
  });

  it("hash rejects an empty string", async () => {
    await expect(hashManagementPassword("")).rejects.toThrow(TypeError);
  });
});
