/**
 * GET  /api/combos — list all combos (management-auth-gated)
 * POST /api/combos — create a new combo (validated by `createComboSchema`)
 *
 * Restored 2026-06-19 (L5-121): see `src/app/api/combos/[id]/route.ts` header
 * for the full rationale. This handler is called from the combos page list
 * load (`page.tsx:718,746`) and the "new combo" modal submission.
 */
import { NextResponse } from "next/server";
import {
  getCombos,
  getCombosCount,
  createCombo,
  getComboByName,
  isCloudEnabled,
} from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync.stub";
import { validateCompositeTiersConfig } from "@/lib/combos/compositeTiers";
import { normalizeComboModels } from "@/lib/combos/steps";
import { validateComboDAG, clampComboDepth } from "@omniroute/open-sse/services/combo.ts";
import { createComboSchema, paginationSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { comboErrorResponse } from "@/lib/api/comboErrorResponse";
import { computeComboContextLength } from "@/lib/combos/comboContext";
import { ComboInvariantError } from "@/lib/combos/invariants";
import { buildComboNameCollisionWarning } from "@/lib/combos/modelNameCollision";

function sanitizeComboRuntimeConfig(rawConfig: unknown): Record<string, unknown> {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return {};
  }
  const allowed = new Set(Object.keys(comboRuntimeConfigSchema.shape));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawConfig as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

// GET /api/combos — list all combos
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const raw = {
      offset: searchParams.get("offset") || undefined,
      limit: searchParams.get("limit") || undefined,
    };
    const validation = validateBody(paginationSchema, raw);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const range = validation.data;
    const total = getCombosCount();
    const rawCombos = await getCombos(range.limit, range.offset);
    const combos = rawCombos.map((combo) => ({
      ...combo,
      computed_context_length: computeComboContextLength(combo, rawCombos),
    }));
    return NextResponse.json({ combos, total });
  } catch (error) {
    console.log("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

// POST /api/combos — create combo
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "", message: "Body must be a JSON object" }],
        },
      },
      { status: 400 }
    );
  }

  const sanitizedBody = { ...(rawBody as Record<string, unknown>) };
  if ("config" in sanitizedBody) {
    sanitizedBody.config = sanitizeComboRuntimeConfig(sanitizedBody.config);
  }

  const validation = validateBody(createComboSchema, sanitizedBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const existing = await getComboByName(validation.data.name);
    if (existing) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid request",
            details: [{ field: "name", message: "Combo name already exists" }],
          },
        },
        { status: 400 }
      );
    }

    if (validation.data.config) {
      const compositeCheck = validateCompositeTiersConfig(validation.data.config);
      if (!compositeCheck.ok) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid request",
              details: compositeCheck.errors.map((m) => ({
                field: "config.compositeTiers",
                message: m,
              })),
            },
          },
          { status: 400 }
        );
      }
    }

    const normalized = normalizeComboModels(validation.data.models ?? [], {
      comboName: validation.data.name,
    });

    // #8530: a combo named after a real model id is a supported pattern
    // (#6940 — bare-model-id provider fallback), so it is never rejected.
    // Surface it as a non-blocking warning so the dashboard/API caller can
    // confirm it was intentional instead of silently shadowing the model.
    const warning = buildComboNameCollisionWarning(name);
    return NextResponse.json(warning ? { ...combo, warning } : combo, { status: 201 });
  } catch (error) {
    if (error instanceof ComboInvariantError) {
      return comboErrorResponse("COMBO_008", 400, { reason: error.message }, request);
    }
    console.log("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
