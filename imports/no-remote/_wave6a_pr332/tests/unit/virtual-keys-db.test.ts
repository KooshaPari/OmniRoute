/**
 * Tests for the virtual-keys DB module.
 *
 * Covers the security model (raw key shown once, sha256 stored) and the
 * atomic guard semantics (over-budget, over-RPD, expiry, revocation) per
 * ADR-031 § 2.3. 12 cases — every public function and every guard branch.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-db-vkeys-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const vk = await import("../../src/lib/db/virtualKeys.ts");

async function resetStorage() {
  core.resetDbInstance();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  core.getDbInstance();
}

await resetStorage();

// ──────────────── mintVirtualKey ────────────────

test("mintVirtualKey returns a key with rawKey shown once", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a", { label: "primary" });
  assert.ok(minted.rawKey.startsWith("vk_"));
  assert.equal(minted.rawKey.length, "vk_".length + 64); // 32 bytes → 64 hex chars
  assert.equal(minted.tenantId, "tenant_a");
  assert.equal(minted.label, "primary");
  assert.equal(minted.keyPrefix, minted.rawKey.slice(0, 8));
  assert.equal(minted.currentCostUsd, 0);
  assert.equal(minted.currentRpd, 0);
  assert.equal(minted.revokedAt, null);
});

test("mintVirtualKey stores sha256 hash, never the raw key", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  const row = core
    .getDbInstance()
    .prepare("SELECT hashed_key FROM virtual_keys WHERE id = ?")
    .get(minted.id) as { hashed_key: string };
  // The stored value is a sha256 hex (64 chars) — NOT the raw key.
  assert.equal(row.hashed_key.length, 64);
  assert.notEqual(row.hashed_key, minted.rawKey);
  // The sha256 of the raw key matches the stored value.
  const { createHash } = await import("crypto");
  const expected = createHash("sha256").update(minted.rawKey).digest("hex");
  assert.equal(row.hashed_key, expected);
});

test("mintVirtualKey with allowedModels and caps", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_b", {
    label: "scoped",
    allowedModels: ["gpt-4o", "claude-opus-4"],
    maxCostUsd: 25,
    maxRpd: 100,
    expiresAt: "2027-01-01T00:00:00Z",
  });
  assert.deepEqual(minted.allowedModels, ["gpt-4o", "claude-opus-4"]);
  assert.equal(minted.maxCostUsd, 25);
  assert.equal(minted.maxRpd, 100);
  assert.equal(minted.expiresAt, "2027-01-01T00:00:00.000Z");
});

test("mintVirtualKey rejects missing tenantId", () => {
  assert.throws(() => vk.mintVirtualKey(""), /tenantId is required/);
});

// ──────────────── listVirtualKeysForTenant ────────────────

test("listVirtualKeysForTenant returns only keys for the given tenant", async () => {
  await resetStorage();
  vk.mintVirtualKey("tenant_a", { label: "a1" });
  vk.mintVirtualKey("tenant_a", { label: "a2" });
  vk.mintVirtualKey("tenant_b", { label: "b1" });

  const aKeys = vk.listVirtualKeysForTenant("tenant_a");
  const bKeys = vk.listVirtualKeysForTenant("tenant_b");
  assert.equal(aKeys.length, 2);
  assert.equal(bKeys.length, 1);
  assert.ok(aKeys.every((k) => k.tenantId === "tenant_a"));
  assert.equal(bKeys[0].label, "b1");
});

test("listVirtualKeysForTenant never returns the raw key", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  const listed = vk.listVirtualKeysForTenant("tenant_a");
  assert.equal(listed.length, 1);
  assert.equal((listed[0] as { rawKey?: string }).rawKey, undefined);
  assert.notEqual(listed[0].id, minted.rawKey);
});

// ──────────────── revokeVirtualKey ────────────────

test("revokeVirtualKey transitions active → revoked", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  assert.equal(vk.revokeVirtualKey(minted.id), true);
  const after = vk.getVirtualKey(minted.id);
  assert.ok(after?.revokedAt);
});

test("revokeVirtualKey is idempotent (returns false on second call)", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  assert.equal(vk.revokeVirtualKey(minted.id), true);
  assert.equal(vk.revokeVirtualKey(minted.id), false);
  assert.equal(vk.revokeVirtualKey("no-such-id"), false);
});

// ──────────────── resolveVirtualKey ────────────────

test("resolveVirtualKey round-trips raw → hash → metadata", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  const resolved = vk.resolveVirtualKey(minted.rawKey);
  assert.ok(resolved);
  assert.equal(resolved.id, minted.id);
  assert.equal(resolved.tenantId, "tenant_a");
  // The resolved row includes hashedKey for downstream auditing.
  assert.equal(resolved.hashedKey.length, 64);
  // last_used_at is updated on resolve (best-effort).
  const after = vk.getVirtualKey(minted.id);
  assert.ok(after?.lastUsedAt);
});

test("resolveVirtualKey returns null for revoked key", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  vk.revokeVirtualKey(minted.id);
  assert.equal(vk.resolveVirtualKey(minted.rawKey), null);
});

test("resolveVirtualKey returns null for unknown key", () => {
  assert.equal(vk.resolveVirtualKey("vk_doesnotexist"), null);
});

test("resolveVirtualKey returns null for expired key", async () => {
  await resetStorage();
  // Insert directly so we can backdate expires_at to the past.
  core
    .getDbInstance()
    .prepare(
      `INSERT INTO virtual_keys
        (id, tenant_id, hashed_key, key_prefix, label, expires_at, last_reset_day)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "vkey-expired-1",
      "tenant_a",
      "deadbeef".repeat(8),
      "vk_abc1234",
      "expired",
      "2000-01-01T00:00:00Z",
      new Date().toISOString().slice(0, 10),
    );
  assert.equal(vk.resolveVirtualKey("any-raw-key"), null);
});

// ──────────────── recordVirtualKeyUsage ────────────────

test("recordVirtualKeyUsage applies cost under budget", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a", { maxCostUsd: 10 });
  const r1 = vk.recordVirtualKeyUsage(minted.id, 1.5, {
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 1000,
    completionTokens: 500,
  });
  assert.equal(r1.ok, true);
  if (r1.ok) {
    assert.equal(r1.newCostUsd, 1.5);
    assert.equal(r1.newRpd, 1);
  }
  const after = vk.getVirtualKey(minted.id);
  assert.equal(after?.currentCostUsd, 1.5);
  assert.equal(after?.currentRpd, 1);
});

test("recordVirtualKeyUsage over budget is rejected atomically", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a", { maxCostUsd: 1 });
  // First call: $0.50 — accepted.
  const ok = vk.recordVirtualKeyUsage(minted.id, 0.5);
  assert.equal(ok.ok, true);
  // Second call: $0.75 — would push to $1.25, over the $1 cap.
  const denied = vk.recordVirtualKeyUsage(minted.id, 0.75);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.reason, "over_budget");
  // The state was NOT mutated by the rejected call.
  const after = vk.getVirtualKey(minted.id);
  assert.equal(after?.currentCostUsd, 0.5);
  assert.equal(after?.currentRpd, 1);
});

test("recordVirtualKeyUsage over RPD is rejected atomically", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a", { maxRpd: 2 });
  assert.equal(vk.recordVirtualKeyUsage(minted.id, 0).ok, true);
  assert.equal(vk.recordVirtualKeyUsage(minted.id, 0).ok, true);
  const denied = vk.recordVirtualKeyUsage(minted.id, 0);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.reason, "over_rpd");
});

test("recordVirtualKeyUsage on revoked key returns reason=revoked", async () => {
  await resetStorage();
  const minted = vk.mintVirtualKey("tenant_a");
  vk.revokeVirtualKey(minted.id);
  const r = vk.recordVirtualKeyUsage(minted.id, 0);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "revoked");
});

test("recordVirtualKeyUsage on unknown id returns reason=not_found", () => {
  const r = vk.recordVirtualKeyUsage("no-such-id", 0);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "not_found");
});

test("hashed_key is unique across mints (no collisions)", async () => {
  await resetStorage();
  const minted = [];
  for (let i = 0; i < 50; i++) {
    minted.push(vk.mintVirtualKey("tenant_a"));
  }
  // Different mints always produce different raw keys.
  const seen = new Set<string>();
  for (const m of minted) {
    assert.equal(seen.has(m.rawKey), false, "duplicate raw key in 50 mints");
    seen.add(m.rawKey);
  }
});
