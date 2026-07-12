/**
 * GET  /api/combos — list all combos (management-auth-gated)
 * POST /api/combos — create a new combo (validated by `createComboSchema`)
 *
 * Restored 2026-06-19 (L5-121): see `src/app/api/combos/[id]/route.ts` header
 * for the full rationale. This handler is called from the combos page list
 * load (`page.tsx:718,746`) and the "new combo" modal submission.
 */
import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName, isCloudEnabled } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync.stub";
import { validateCompositeTiersConfig } from "@/lib/combos/compositeTiers";
import { normalizeComboModels } from "@/lib/combos/steps";
import {
  createComboSchema,
  comboRuntimeConfigSchema,
} from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

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
    const combos = await getCombos();
    return NextResponse.json({ combos });
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

    const created = await createCombo({
      ...validation.data,
      models: normalized,
    });

    if (isCloudEnabled()) {
      try {
        const machineId = await getConsistentMachineId();
        await syncToCloud(machineId);
      } catch (cloudError) {
        console.log("Cloud sync failed (non-fatal):", cloudError);
      }
    }

    return NextResponse.json(created);
  } catch (error) {
    console.log("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
