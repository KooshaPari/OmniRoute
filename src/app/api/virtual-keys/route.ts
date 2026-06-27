/**
 * REST: /api/virtual-keys
 *
 * B5 of v8.1 Bifrost track (ADR-031). Endpoints:
 *   - POST /api/virtual-keys          → mint a new key (returns rawKey ONCE)
 *   - GET  /api/virtual-keys?tenantId=…  → list keys (optionally filtered)
 *
 * Auth: requireManagementAuth (same as the legacy /api/keys CRUD; the
 * "keys:write" scope check is enforced in the A2A skill and at the
 * BFF/proxy edge, not here — this is an admin-only management surface).
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import { mintVirtualKey, listVirtualKeysForTenant, listAllVirtualKeys } from "@/lib/db/virtualKeys";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import * as log from "@/sse/utils/logger";

const mintVirtualKeySchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    tenant_id: z.string().min(1).optional(),
    label: z.string().optional().default(""),
    allowedModels: z.array(z.string()).optional(),
    allowed_models: z.array(z.string()).optional(),
    maxCostUsd: z.number().finite().nonnegative().nullable().optional(),
    max_cost_usd: z.number().finite().nonnegative().nullable().optional(),
    maxRpd: z.number().int().nonnegative().nullable().optional(),
    max_rpd: z.number().int().nonnegative().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const tenantId = data.tenantId ?? data.tenant_id;
    if (!tenantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tenantId"],
        message: "tenantId is required",
      });
    }

    const expiresAtRaw = data.expiresAt ?? data.expires_at;
    if (expiresAtRaw) {
      const parsed = new Date(expiresAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiresAt"],
          message: "expiresAt must be a valid ISO 8601 timestamp",
        });
      }
    }
  });

// GET /api/virtual-keys?tenantId=X
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const keys = tenantId ? listVirtualKeysForTenant(tenantId) : listAllVirtualKeys();
    return NextResponse.json({
      keys,
      total: keys.length,
    });
  } catch (error) {
    log.error("virtual-keys", "Error listing virtual keys", error);
    return NextResponse.json({ error: "Failed to list virtual keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(mintVirtualKeySchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const body = validation.data;
  const tenantId = body.tenantId ?? body.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const expiresAtRaw = body.expiresAt ?? body.expires_at;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  const maxCostUsdRaw = body.maxCostUsd ?? body.max_cost_usd;
  const maxCostUsd = maxCostUsdRaw ?? null;

  const maxRpdRaw = body.maxRpd ?? body.max_rpd;
  const maxRpd = maxRpdRaw ?? null;

  const allowedModelsRaw = body.allowedModels ?? body.allowed_models;
  const allowedModels =
    allowedModelsRaw && allowedModelsRaw.length > 0 ? allowedModelsRaw : undefined;
  const label = body.label ?? "";

  try {
    const minted = mintVirtualKey(tenantId, {
      label,
      allowedModels: allowedModels ?? null,
      maxCostUsd,
      maxRpd,
      expiresAt,
    });

    const { rawKey, ...meta } = minted;
    return NextResponse.json({ key: meta, rawKey }, { status: 201 });
  } catch (error) {
    log.error("virtual-keys", "Error minting virtual key", error);
    return NextResponse.json({ error: "Failed to mint virtual key" }, { status: 500 });
  }
}
