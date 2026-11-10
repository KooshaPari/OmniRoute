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
import {
  mintVirtualKey,
  listVirtualKeysForTenant,
  listAllVirtualKeys,
} from "@/lib/db/virtualKeys";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import * as log from "@/sse/utils/logger";

/** Zod schema for POST /api/virtual-keys body. */
const MintVirtualKeySchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  label: z.string().optional(),
  allowedModels: z.array(z.string()).optional(),
  maxCostUsd: z.number().nonnegative().finite().nullable().optional(),
  maxRpd: z.number().int().nonnegative().nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

// GET /api/virtual-keys?tenantId=X
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const keys = tenantId ? listVirtualKeysForTenant(tenantId) : listAllVirtualKeys();
    // NOTE: never expose the hash. The raw key is also never returned by
    // list / get; only mint (POST) returns it, and only on creation.
    return NextResponse.json({
      keys,
      total: keys.length,
    });
  } catch (error) {
    log.error("virtual-keys", "Error listing virtual keys", error);
    return NextResponse.json({ error: "Failed to list virtual keys" }, { status: 500 });
  }
}

// POST /api/virtual-keys
//
// Body:
//   {
//     tenantId:      string  (required)
//     label?:        string
//     allowedModels?: string[]
//     maxCostUsd?:   number | null
//     maxRpd?:       number | null
//     expiresAt?:    string  (ISO 8601) | null
//   }
//
// Response (201):
//   {
//     key:        VirtualKey  (no hash, no raw key on subsequent reads)
//     rawKey:     string      (shown ONCE — caller must surface to user)
//   }
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MintVirtualKeySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { tenantId, label, allowedModels, maxCostUsd, maxRpd, expiresAt } = parsed.data;

  try {
    const minted = mintVirtualKey(tenantId, {
      label: label ?? "",
      allowedModels: allowedModels ?? null,
      maxCostUsd: maxCostUsd ?? null,
      maxRpd: maxRpd ?? null,
      expiresAt: expiresAt ?? null,
    });

    // Surface the rawKey once. The caller MUST display this to the user —
    // it is unrecoverable from the stored hash.
    const { rawKey, ...meta } = minted;
    return NextResponse.json(
      {
        key: meta,
        rawKey,
      },
      { status: 201 },
    );
  } catch (error) {
    log.error("virtual-keys", "Error minting virtual key", error);
    return NextResponse.json({ error: "Failed to mint virtual key" }, { status: 500 });
  }
}
