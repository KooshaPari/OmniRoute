// @vitest-environment node
/**
 * Tests for src/lib/plugins/signing.ts — focus on timing-safe hash compare.
 *
 * Covers:
 *   - verifySha256 returns true on exact match
 *   - verifySha256 returns false on a different digest
 *   - verifySha256 returns false on length mismatch (without throwing)
 *   - verifySha256 is case-insensitive on expectedHash
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import { sha256, verifySha256 } from "../../../src/lib/plugins/signing.ts";

it("sha256 produces canonical 64-char hex digest", () => {
  const digest = sha256(Buffer.from("hello"));
  expect(digest.length).toBe(64);
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
});

it("verifySha256 returns true on exact match", () => {
  const data = Buffer.from("plugin-package-v1");
  const expected = sha256(data);
  expect(verifySha256(data, expected)).toBe(true);
});

it("verifySha256 returns true on case-different expected", () => {
  const data = Buffer.from("plugin-package-v1");
  const expected = sha256(data).toUpperCase();
  expect(verifySha256(data, expected)).toBe(true);
});

it("verifySha256 returns false on tampered digest", () => {
  const data = Buffer.from("plugin-package-v1");
  const expected = sha256(data);
  // Flip the last hex char so length is preserved.
  const tampered = expected.slice(0, -1) + (expected.slice(-1) === "0" ? "1" : "0");
  expect(verifySha256(data, tampered)).toBe(false);
});

it("verifySha256 returns false on length mismatch without throwing", () => {
  const data = Buffer.from("plugin-package-v1");
  // SHA-256 produces 64 chars; anything else must return false safely.
  expect(verifySha256(data, "tooshort")).toBe(false);
  expect(verifySha256(data, "")).toBe(false);
  expect(verifySha256(data, "a".repeat(80))).toBe(false);
});

it("verifySha256 returns false for empty input vs any digest", () => {
  const expected = sha256(Buffer.from("plugin-package-v1"));
  expect(verifySha256(Buffer.from(""), expected)).toBe(false);
});
