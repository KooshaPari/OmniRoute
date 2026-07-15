// @vitest-environment node
/**
 * Smoke test for managementPassword (PR: bcryptjs → @node-rs/argon2 migration).
 * Verifies:
 *   - new passwords produce $argon2id$...$ strings
 *   - verifyManagementPassword accepts both Argon2id and legacy bcrypt hashes
 *   - isArgon2idHash / isBcryptHash regex checks work
 *   - verifyManagementPassword rejects non-hash inputs (defense-in-depth)
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import bcrypt from "bcryptjs";
import {
  hashManagementPassword,
  verifyManagementPassword,
  isBcryptHash,
  isArgon2idHash,
} from "../../../src/lib/auth/managementPassword.ts";

it("managementPassword: new hash is Argon2id (preferred)", async () => {
  const hash = await hashManagementPassword("S3cret-passphrase!");
  expect(typeof hash).toBe("string");
  expect(hash).toMatch(/^\$argon2id\$/);
  expect(isArgon2idHash(hash)).toBe(true);
  expect(isBcryptHash(hash)).toBe(false);
});

it("managementPassword: argon2 verify round-trip succeeds", async () => {
  const hash = await hashManagementPassword("hello-world");
  expect(await verifyManagementPassword("hello-world", hash)).toBe(true);
});

it("managementPassword: argon2 wrong password rejected", async () => {
  const hash = await hashManagementPassword("correct");
  expect(await verifyManagementPassword("wrong", hash)).toBe(false);
});

it("managementPassword: legacy bcrypt hash still verifies (backward compat)", async () => {
  // Generate a real bcryptjs hash for the "legacy" path
  const legacy = await bcrypt.hash("legacy-pass", 10);
  expect(isBcryptHash(legacy)).toBe(true);
  expect(await verifyManagementPassword("legacy-pass", legacy)).toBe(true);
  expect(await verifyManagementPassword("wrong-pass", legacy)).toBe(false);
});

it("managementPassword: rejects arbitrary non-hash strings", async () => {
  expect(await verifyManagementPassword("pass", "not-a-hash")).toBe(false);
  expect(await verifyManagementPassword("pass", "")).toBe(false);
});

it("managementPassword: typed inputs required (no implicit coercion)", async () => {
  // @ts-expect-error — exercise runtime guard
  expect(await verifyManagementPassword(null, "$argon2id$x")).toBe(false);
  // @ts-expect-error
  expect(await verifyManagementPassword("x", null)).toBe(false);
});

it("managementPassword: isArgon2idHash / isBcryptHash mutually exclusive (positive + negative)", () => {
  expect(isArgon2idHash("$argon2id$v=19$m=19456,t=2,p=1$abc")).toBe(true);
  expect(isBcryptHash("$argon2id$v=19$m=19456,t=2,p=1$abc")).toBe(false);
  expect(
    isBcryptHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"),
  ).toBe(true);
  expect(
    isArgon2idHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"),
  ).toBe(false);
});
