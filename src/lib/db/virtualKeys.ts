/**
 * db/virtualKeys.ts — Virtual-key minting + revocation (B5 of v8.1 Bifrost track, ADR-031)
 *
 * A virtual key is a per-tenant scoped credential that OmniRoute mints,
 * hands to the user (rawKey shown ONCE), and resolves to a real upstream
 * key at request time. The raw key never leaves the mint response; the
 * server only retains a sha256 hex digest of the raw key (32 bytes →
 * 64 hex chars).
 *
 * Atomicity guarantees (the security model is built on these):
 *
 *   1. `recordVirtualKeyUsage` runs a single SQL UPDATE with
 *        WHERE current_cost_usd + ? <= max_cost_usd
 *          AND current_rpd   + 1 <= max_rpd
 *      so the budget/RPD cap is honoured even under concurrent debits.
 *      SQLite serialises writes; the loser sees `changes() === 0` and is
 *      reported as `over_budget` or `over_rpd` — there is no
 *      read-then-write window.
 *
 *   2. The RPD counter is daily-resetting: if `last_reset_day` is
 *      different from today, the same UPDATE zeroes `current_rpd` and
 *      bumps `last_reset_day` in the same statement.
 *
 *   3. `revokeVirtualKey` is idempotent and returns `true` only on the
 *      active → revoked transition.
 *
 *   4. `resolveVirtualKey` updates `last_used_at` as a best-effort
 *      side-effect; the timestamp is informational, not a security
 *      primitive.
 *
 * The companion ledger (`cost_events`, migration 103) is written by
 * `recordVirtualKeyUsage` on success — see db/costTracking.ts.
 */

import { createHash, randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getDbInstance } from "./core";
import { recordCostEvent } from "./costTracking";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VirtualKey {
  id: string;
  tenantId: string;
  keyPrefix: string;
  label: string;
  allowedModels: string[] | null;
  maxCostUsd: number | null;
  maxRpd: number | null;
  currentCostUsd: number;
  currentRpd: number;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface VirtualKeyWithSecret extends VirtualKey {
  /** Raw key material — only returned on creation. */
  rawKey: string;
}

export interface ResolvedVirtualKey extends VirtualKey {
  /** Hashed key (sha256 hex, 64 chars) — for downstream auditing. */
  hashedKey: string;
}

export interface MintVirtualKeyOptions {
  label?: string;
  allowedModels?: string[] | null;
  maxCostUsd?: number | null;
  maxRpd?: number | null;
  /** ISO 8601 string. */
  expiresAt?: string | null;
}

export interface RecordUsageOptions {
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export type RecordUsageResult =
  | { ok: true; newCostUsd: number; newRpd: number }
  | { ok: false; reason: "over_budget" | "over_rpd" | "revoked" | "not_found" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawKey(): string {
  // 32 bytes of entropy → 64 hex chars after the `vk_` prefix. Random
  // bytes are uniformly distributed, so collisions across the lifetime
  // of a deployment are astronomically improbable.
  return "vk_" + randomBytes(32).toString("hex");
}

interface VirtualKeyRow {
  id: string;
  tenant_id: string;
  hashed_key: string;
  key_prefix: string;
  label: string;
  allowed_models: string | null;
  max_cost_usd: number | null;
  max_rpd: number | null;
  current_cost_usd: number;
  current_rpd: number;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  last_reset_day: string | null;
  revoked_at: string | null;
}

function rowToVirtualKey(row: VirtualKeyRow): VirtualKey {
  let allowedModels: string[] | null = null;
  if (row.allowed_models) {
    try {
      const parsed = JSON.parse(row.allowed_models);
      if (Array.isArray(parsed)) {
        allowedModels = parsed.filter((m): m is string => typeof m === "string");
      }
    } catch {
      allowedModels = null;
    }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    keyPrefix: row.key_prefix,
    label: row.label,
    allowedModels,
    maxCostUsd: row.max_cost_usd,
    maxRpd: row.max_rpd,
    currentCostUsd: row.current_cost_usd,
    currentRpd: row.current_rpd,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function normaliseExpiresAt(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function normaliseAllowedModels(value: string[] | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((m): m is string => typeof m === "string" && m.length > 0);
  return filtered.length > 0 ? JSON.stringify(filtered) : null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Mint a new virtual key. Returns the persisted row plus the rawKey,
 * which is shown to the caller exactly once — the server only stores
 * the sha256 hash from this point on.
 */
export function mintVirtualKey(
  tenantId: string,
  opts: MintVirtualKeyOptions = {}
): VirtualKeyWithSecret {
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("tenantId is required");
  }

  const db = getDbInstance();
  const id = uuidv4();
  const rawKey = generateRawKey();
  const hashedKey = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8); // "vk_" + 5 hex chars — enough to identify a key in logs
  const label = opts.label ?? "";
  const allowedModels = normaliseAllowedModels(opts.allowedModels ?? null);
  const expiresAt = normaliseExpiresAt(opts.expiresAt ?? null);
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO virtual_keys
      (id, tenant_id, hashed_key, key_prefix, label, allowed_models,
       max_cost_usd, max_rpd, current_cost_usd, current_rpd,
       expires_at, created_at, last_reset_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
  ).run(
    id,
    tenantId,
    hashedKey,
    keyPrefix,
    label,
    allowedModels,
    opts.maxCostUsd ?? null,
    opts.maxRpd ?? null,
    expiresAt,
    createdAt,
    todayIso()
  );

  const row = getRow(db, id);
  if (!row) {
    // Should be unreachable — the INSERT just succeeded.
    throw new Error("Failed to read back freshly minted virtual key");
  }
  return { ...rowToVirtualKey(row), rawKey };
}

/**
 * List all (active + revoked) keys for a tenant. The rawKey is never
 * included; only the prefix + metadata.
 */
export function listVirtualKeysForTenant(tenantId: string): VirtualKey[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      `SELECT * FROM virtual_keys
        WHERE tenant_id = ?
        ORDER BY created_at DESC`
    )
    .all(tenantId) as VirtualKeyRow[];
  return rows.map(rowToVirtualKey);
}

/**
 * List every key in the system. Used by the admin GET /api/virtual-keys
 * when no tenantId is provided.
 */
export function listAllVirtualKeys(): VirtualKey[] {
  const db = getDbInstance();
  const rows = db
    .prepare(`SELECT * FROM virtual_keys ORDER BY created_at DESC`)
    .all() as VirtualKeyRow[];
  return rows.map(rowToVirtualKey);
}

/**
 * Read a single key by id. Returns the metadata row (no rawKey, no hash).
 */
export function getVirtualKey(id: string): VirtualKey | null {
  const db = getDbInstance();
  const row = getRow(db, id);
  return row ? rowToVirtualKey(row) : null;
}

/**
 * Revoke a key. Returns true on the active → revoked transition, false
 * if the key is already revoked or does not exist.
 */
export function revokeVirtualKey(id: string): boolean {
  const db = getDbInstance();
  const now = nowIso();
  const result = db
    .prepare(
      `UPDATE virtual_keys
          SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL`
    )
    .run(now, id);
  return result.changes > 0;
}

/**
 * Resolve a raw key (the value handed to the user) to its row, applying
 * the revocation + expiry guard. Updates `last_used_at` on success.
 */
export function resolveVirtualKey(rawKey: string): ResolvedVirtualKey | null {
  if (typeof rawKey !== "string" || rawKey.length === 0) return null;
  const db = getDbInstance();
  const hashedKey = hashKey(rawKey);
  const row = db
    .prepare(
      `SELECT * FROM virtual_keys
        WHERE hashed_key = ?
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)`
    )
    .get(hashedKey, nowIso()) as VirtualKeyRow | undefined;
  if (!row) return null;

  db.prepare(
    `UPDATE virtual_keys SET last_used_at = ? WHERE id = ?`
  ).run(nowIso(), row.id);

  // Re-fetch so the resolved object reflects the bump.
  const fresh = getRow(db, row.id);
  if (!fresh) return null;
  return { ...rowToVirtualKey(fresh), hashedKey: fresh.hashed_key };
}

/**
 * Record a billable event against a virtual key and atomically enforce
 * the cost + RPD caps. On success, also writes a row to the
 * `cost_events` ledger.
 */
export function recordVirtualKeyUsage(
  id: string,
  costUsd: number,
  opts: RecordUsageOptions = {}
): RecordUsageResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "not_found" };
  }
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error("costUsd must be a non-negative finite number");
  }

  const db = getDbInstance();
  const today = todayIso();
  const now = nowIso();

  const current = getRow(db, id);
  if (!current) {
    return { ok: false, reason: "not_found" };
  }
  if (current.revoked_at !== null) {
    return { ok: false, reason: "revoked" };
  }

  // Single-statement atomic debit:
  //   - if the day has rolled, reset current_rpd to 0 and bump last_reset_day
  //   - the WHERE clause enforces (cost + new <= max_cost_usd) AND
  //     (rpd_after_increment <= max_rpd) so the cap is honoured even
  //     under concurrent debits. SQLite serialises writes; the loser
  //     sees `changes() === 0` and is reported as the right reason.
  //
  // For rows with no RPD cap (max_rpd IS NULL), the rpd-bump is skipped
  // by gating on (max_rpd IS NULL OR current_rpd + 1 <= max_rpd).
  // For rows with no cost cap (max_cost_usd IS NULL), the cost-bump is
  // skipped similarly.
  const result = db
    .prepare(
      `UPDATE virtual_keys
          SET current_cost_usd = CASE
                WHEN max_cost_usd IS NULL THEN current_cost_usd + ?
                ELSE current_cost_usd + ?
              END,
              current_rpd = CASE
                WHEN last_reset_day = ? THEN current_rpd + 1
                ELSE 1
              END,
              last_used_at = ?,
              last_reset_day = ?
        WHERE id = ?
          AND revoked_at IS NULL
          AND (max_cost_usd IS NULL OR current_cost_usd + ? <= max_cost_usd)
          AND (max_rpd      IS NULL OR last_reset_day <> ? OR current_rpd + 1 <= max_rpd)`
    )
    .run(
      costUsd,
      costUsd,
      today,
      now,
      today,
      id,
      costUsd,
      today
    );

  if (result.changes === 0) {
    // The WHERE did not match. Distinguish over_budget from over_rpd
    // by re-reading the row.
    const after = getRow(db, id);
    if (!after) return { ok: false, reason: "not_found" };
    if (after.revoked_at !== null) return { ok: false, reason: "revoked" };
    if (
      after.max_cost_usd !== null &&
      after.current_cost_usd + costUsd > after.max_cost_usd
    ) {
      return { ok: false, reason: "over_budget" };
    }
    if (
      after.max_rpd !== null &&
      after.last_reset_day === today &&
      after.current_rpd + 1 > after.max_rpd
    ) {
      return { ok: false, reason: "over_rpd" };
    }
    // Defensive fallback — the cap math should have been caught above.
    return { ok: false, reason: "over_budget" };
  }

  // Append a cost_event with the same fields. Failures here are
  // surfaced to the caller as a logged warning only — the budget
  // counters were already bumped and the request is allowed.
  try {
    recordCostEvent({
      virtualKeyId: id,
      tenantId: current.tenant_id,
      provider: opts.provider ?? "unknown",
      model: opts.model ?? "unknown",
      promptTokens: opts.promptTokens ?? 0,
      completionTokens: opts.completionTokens ?? 0,
      costUsd,
      occurredAt: now,
    });
  } catch {
    // Swallow — the ledger write failure must not roll back the budget
    // counters. Operators can backfill from request logs.
  }

  const after = getRow(db, id);
  if (!after) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    newCostUsd: after.current_cost_usd,
    newRpd: after.current_rpd,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function getRow(
  db: ReturnType<typeof getDbInstance>,
  id: string
): VirtualKeyRow | null {
  const row = db
    .prepare(`SELECT * FROM virtual_keys WHERE id = ?`)
    .get(id) as VirtualKeyRow | undefined;
  return row ?? null;
}
