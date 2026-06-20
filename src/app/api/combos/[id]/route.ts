/**
 * GET    /api/combos/[id]   — fetch a single combo by id
 * PUT    /api/combos/[id]   — partial update (validated by `updateComboSchema`)
 * DELETE /api/combos/[id]   — remove a combo
 *
 * Restored 2026-06-19 (L5-121): the prior versions of these route handlers
 * were removed by `05924441a` ("chore(OmniRoute): add packageManager field"),
 * but the GUI's combos page (see `src/app/(dashboard)/dashboard/combos/page.tsx`
 * lines 746, 767, 788, 840, 1578, 292) still issues fetch calls to
 * `/api/combos/${id}` for create + update + delete flows. Until the GUI is
 * migrated to the new `/v1/combos` + `/api/combos/auto` API surface, these
 * legacy endpoints must remain in place — otherwise the GUI's save modal
 * surfaces a Next.js 404 (rendered as a non-actionable 400 in some
 * browser/MetaMask noise layers).
 *
 * Why this uses the old-style schema (not `.strict()` at the top level):
 * the GUI sends legacy fields like `compressionOverride` and partial
 * `system_message` / `tool_filter_regex` updates. The `comboRuntimeConfigSchema`
 * is `.strict()`, so we route the body through `sanitizeComboRuntimeConfig`
 * before validation to drop unknown legacy keys — this avoids the
 * "Unrecognized key: \"<legacy>\"" 400 that previously blocked all save
 * attempts on combos with an unknown config field.
 */
import { NextResponse } from "next/server";
import {
  getComboById,
  updateCombo,
  deleteCombo,
  getComboByName,
  getCombos,
  isCloudEnabled,
} from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync.stub";
import { validateCompositeTiersConfig } from "@/lib/combos/compositeTiers";
import { normalizeComboModels } from "@/lib/combos/steps";
import { validateComboDAG } from "@omniroute/open-sse/services/combo.ts";
import {
  updateComboSchema,
  comboRuntimeConfigSchema,
} from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

/**
 * Strip unknown keys from `combo.config` before validation. The schema is
 * `.strict()`, so any field that isn't enumerated in
 * `comboRuntimeConfigSchema.shape` (lines 632–686) would otherwise produce
 * an "Unrecognized key" 400 — blocking the GUI's edit-modal save on every
 * combo that has any legacy or extra config field.
 */
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

// GET /api/combos/[id] — fetch one combo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const combo = await getComboById(id);
    if (!combo) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }
    return NextResponse.json(combo);
  } catch (error) {
    console.log("Error fetching combo:", error);
    return NextResponse.json({ error: "Failed to fetch combo" }, { status: 500 });
  }
}

// PUT /api/combos/[id] — partial update
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      { error: { message: "Invalid request", details: [{ field: "", message: "Body must be a JSON object" }] } },
      { status: 400 }
    );
  }

  // Strip unknown keys from `config` to satisfy the strict sub-schema.
  const sanitizedBody = { ...(rawBody as Record<string, unknown>) };
  if ("config" in sanitizedBody) {
    sanitizedBody.config = sanitizeComboRuntimeConfig(sanitizedBody.config);
  }

  const validation = validateBody(updateComboSchema, sanitizedBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;
    const combo = await getComboById(id);
    if (!combo) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    // Legacy top-level `compressionOverride` → move into `config.compressionMode`.
    const updatePayload: Record<string, unknown> = { ...validation.data };
    if ("compressionOverride" in updatePayload) {
      const override = updatePayload.compressionOverride;
      delete updatePayload.compressionOverride;
      const existingConfig = (combo.config && typeof combo.config === "object"
        ? combo.config
        : {}) as Record<string, unknown>;
      updatePayload.config = sanitizeComboRuntimeConfig({
        ...existingConfig,
        compressionMode: override === null ? "off" : override,
      });
    }

    // Validate composite-tiers if present in the merged config.
    const mergedConfig = updatePayload.config;
    if (mergedConfig && typeof mergedConfig === "object") {
      const compositeCheck = validateCompositeTiersConfig(
        mergedConfig as Record<string, unknown>
      );
      if (!compositeCheck.ok) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid request",
              details: compositeCheck.errors.map((m) => ({ field: "config.compositeTiers", message: m })),
            },
          },
          { status: 400 }
        );
      }
    }

    // Name-collision check when renaming.
    if (
      typeof updatePayload.name === "string" &&
      updatePayload.name !== combo.name
    ) {
      const existing = await getComboByName(updatePayload.name);
      if (existing && existing.id !== combo.id) {
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
    }

    // Validate DAG when models are sent.
    if (Array.isArray(updatePayload.models)) {
      try {
        const allCombos = await getCombos();
        const normalized = normalizeComboModels(updatePayload.models, {
          comboName: combo.name,
        });
        validateComboDAG(
          updatePayload.name ?? combo.name,
          allCombos as unknown as Map<string, unknown>,
          new Set<string>(),
          0,
          5
        );
        updatePayload.models = normalized;
      } catch (dagError) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid request",
              details: [
                {
                  field: "models",
                  message:
                    dagError instanceof Error
                      ? dagError.message
                      : "Invalid combo DAG",
                },
              ],
            },
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateCombo(id, updatePayload);

    // Best-effort cloud sync — never block the local save on cloud failures.
    if (isCloudEnabled()) {
      try {
        const machineId = await getConsistentMachineId();
        await syncToCloud(machineId);
      } catch (cloudError) {
        console.log("Cloud sync failed (non-fatal):", cloudError);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.log("Error updating combo:", error);
    return NextResponse.json({ error: "Failed to update combo" }, { status: 500 });
  }
}

// DELETE /api/combos/[id] — remove combo
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const combo = await getComboById(id);
    if (!combo) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }
    await deleteCombo(id);

    if (isCloudEnabled()) {
      try {
        const machineId = await getConsistentMachineId();
        await syncToCloud(machineId);
      } catch (cloudError) {
        console.log("Cloud sync failed (non-fatal):", cloudError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("Error deleting combo:", error);
    return NextResponse.json({ error: "Failed to delete combo" }, { status: 500 });
  }
}
