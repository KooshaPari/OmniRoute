/**
 * mint-virtual-key A2A Skill (B5 of v8.1 Bifrost track, ADR-031)
 *
 * Mints a per-tenant virtual key via the A2A JSON-RPC surface, gated
 * by the `keys:write` scope. The raw key is shown to the caller exactly
 * once on creation; subsequent resolutions hash the raw value against
 * the stored sha256 digest and never expose the raw material.
 *
 * Inputs (via task.metadata):
 *   - tenantId      (required, string) — owning tenant of the new key
 *   - scopes        (required, string[]) — must include "keys:write"
 *   - label         (optional, string) — human-readable label
 *   - allowed_models (optional, string[]) — list of model IDs
 *   - max_cost_usd  (optional, number ≥ 0) — soft cap on cumulative spend
 *   - max_rpd       (optional, integer ≥ 0) — requests-per-day cap
 *   - expires_at    (optional, ISO 8601 string) — absolute expiry
 *
 * Output (artifacts[0].content is JSON):
 *   success: {
 *     keyId, tenantId, label, keyPrefix, rawKey, warnings[],
 *   }
 *   error:   { error: "scope_denied" | "invalid_input", message }
 *
 * Result metadata:
 *   success: true  → { success: true, keyId }
 *   success: false → { success: false, error, ... }
 *
 * The `keys:write` scope is the only privilege gate. The raw key is
 * derived from 32 bytes of OS-provided entropy (crypto.randomBytes)
 * and surfaced only here; the DB stores a sha256 hex digest.
 */

import { A2ATask } from "../taskManager";
import { A2ASkillResult } from "../taskExecution";
import { mintVirtualKey } from "@/lib/db/virtualKeys";

const REQUIRED_SCOPE = "keys:write";

interface MintInput {
  tenantId: unknown;
  scopes: unknown;
  label?: unknown;
  allowedModels?: unknown;
  allowed_models?: unknown;
  maxCostUsd?: unknown;
  max_cost_usd?: unknown;
  maxRpd?: unknown;
  max_rpd?: unknown;
  expiresAt?: unknown;
  expires_at?: unknown;
}

interface MintSuccessPayload {
  keyId: string;
  tenantId: string;
  label: string;
  keyPrefix: string;
  rawKey: string;
  allowedModels: string[] | null;
  maxCostUsd: number | null;
  maxRpd: number | null;
  expiresAt: string | null;
  warnings: string[];
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function errorResult(
  code: "scope_denied" | "invalid_input",
  message: string,
): A2ASkillResult {
  return {
    artifacts: [
      {
        type: "text",
        content: JSON.stringify({ error: code, message }),
      },
    ],
    metadata: { success: false, error: code },
  };
}

function successResult(
  payload: MintSuccessPayload,
  keyId: string
): A2ASkillResult {
  return {
    artifacts: [
      {
        type: "text",
        content: JSON.stringify(payload),
      },
    ],
    metadata: { success: true, keyId, tenantId: payload.tenantId },
  };
}

function parseOptionalExpiresAt(
  raw: unknown
): { ok: true; iso: string } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, iso: null as unknown as string };
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: true, iso: null as unknown as string };
  }
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    return {
      ok: false,
      message: `expires_at must be a valid ISO 8601 timestamp (got: ${JSON.stringify(raw)})`,
    };
  }
  return { ok: true, iso: new Date(ms).toISOString() };
}

export async function executeMintVirtualKey(task: A2ATask): Promise<A2ASkillResult> {
  const metadata = (task.metadata ?? {}) as unknown as MintInput;

  // ── Scope gate ────────────────────────────────────────────────────────────
  const scopes = metadata.scopes;
  if (!isStringArray(scopes) || !scopes.includes(REQUIRED_SCOPE)) {
    return errorResult(
      "scope_denied",
      `mint-virtual-key requires the '${REQUIRED_SCOPE}' scope in task.metadata.scopes`,
    );
  }

  // ── Input validation ──────────────────────────────────────────────────────
  if (!isString(metadata.tenantId)) {
    return errorResult(
      "invalid_input",
      "mint-virtual-key requires task.metadata.tenantId (non-empty string)",
    );
  }
  const tenantId: string = metadata.tenantId;

  const label = isString(metadata.label) ? metadata.label : "";

  const allowedModelsRaw = metadata.allowedModels ?? metadata.allowed_models;
  const allowedModels: string[] | null = isStringArray(allowedModelsRaw)
    ? (allowedModelsRaw as string[])
    : null;

  const maxCostUsdRaw = metadata.maxCostUsd ?? metadata.max_cost_usd;
  let maxCostUsd: number | null = null;
  if (maxCostUsdRaw !== undefined && maxCostUsdRaw !== null) {
    if (!isNonNegativeNumber(maxCostUsdRaw)) {
      return errorResult(
        "invalid_input",
        "max_cost_usd must be a non-negative finite number",
      );
    }
    maxCostUsd = maxCostUsdRaw;
  }

  const maxRpdRaw = metadata.maxRpd ?? metadata.max_rpd;
  let maxRpd: number | null = null;
  if (maxRpdRaw !== undefined && maxRpdRaw !== null) {
    if (!Number.isInteger(maxRpdRaw) || (maxRpdRaw as number) < 0) {
      return errorResult(
        "invalid_input",
        "max_rpd must be a non-negative integer",
      );
    }
    maxRpd = maxRpdRaw as number;
  }

  const expiresAtParsed = parseOptionalExpiresAt(
    metadata.expiresAt ?? metadata.expires_at
  );
  if (!expiresAtParsed.ok) {
    return errorResult("invalid_input", expiresAtParsed.message);
  }
  const expiresAt: string | null = expiresAtParsed.iso;

  // ── Warnings for unset caps (operator-actionable) ─────────────────────────
  const warnings: string[] = [];
  if (maxCostUsd === null) {
    warnings.push("max_cost_usd is unset; the key has no spend cap.");
  }
  if (maxRpd === null) {
    warnings.push("max_rpd is unset; the key has no requests-per-day cap.");
  }
  if (allowedModels === null) {
    warnings.push(
      "allowed_models is unset; the key may route to any model exposed by the tenant."
    );
  }
  if (expiresAt === null) {
    warnings.push("expires_at is unset; the key does not auto-expire.");
  }

  // ── Mint ──────────────────────────────────────────────────────────────────
  let minted;
  try {
    minted = mintVirtualKey(tenantId, {
      label,
      allowedModels,
      maxCostUsd,
      maxRpd,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult("invalid_input", `Failed to mint virtual key: ${message}`);
  }

  const payload: MintSuccessPayload = {
    keyId: minted.id,
    tenantId: minted.tenantId,
    label: minted.label,
    keyPrefix: minted.keyPrefix,
    rawKey: minted.rawKey,
    allowedModels: minted.allowedModels,
    maxCostUsd: minted.maxCostUsd,
    maxRpd: minted.maxRpd,
    expiresAt: minted.expiresAt,
    warnings,
  };

  return successResult(payload, minted.id);
}
