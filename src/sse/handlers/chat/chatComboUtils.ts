/**
 * Combo-related utilities for the chat handler.
 *
 * Extracted from chat.ts — cache management, context-overflow deferral,
 * managed-lease combo rejection, and combo-promote dependencies.
 */

import type { ComboLike } from "@omniroute/open-sse/services/combo/types.ts";
import { resolveComboTargets } from "@omniroute/open-sse/services/combo.ts";
import { resolveComboConfig } from "@omniroute/open-sse/services/comboConfig.ts";
import { resolveCompressionSettings } from "@omniroute/open-sse/handlers/chatCore/compressionSettings.ts";
import type { CompressionExclusions } from "@omniroute/open-sse/services/compression/exclusions.ts";
import { getCombosCacheVersion } from "@/lib/db/readCache";
import { getCombos } from "@/lib/db/combos";
import { updateCombo } from "@/lib/db/combos";
import { buildManagedLeaseErrorResponse, LeaseContextError } from "../services/leaseContext";
import * as log from "../utils/logger";

// ---------------------------------------------------------------------------
// Combos cache
// ---------------------------------------------------------------------------

const COMBOS_CACHE_TTL_MS = 10_000;

let combosCachePromise: Promise<ComboLike[]> | null = null;
let combosCacheTs = 0;
let combosCacheVersionSnapshot = -1;

async function getCombosCachedForChat(): Promise<ComboLike[]> {
  const now = Date.now();
  // Explicit non-null check: we intentionally cache and return the Promise
  // itself (to dedupe concurrent callers), so this is not a forgotten await.
  // The version check makes combo edits (create/update/delete/reorder) take
  // effect immediately instead of after the 10s TTL — otherwise a removed
  // target/model could keep being served as a "phantom" for up to 10s (#3147).
  if (
    combosCachePromise !== null &&
    now - combosCacheTs < COMBOS_CACHE_TTL_MS &&
    combosCacheVersionSnapshot === getCombosCacheVersion()
  ) {
    return combosCachePromise;
  }

  combosCacheTs = now;
  combosCacheVersionSnapshot = getCombosCacheVersion();
  combosCachePromise = getCombos().catch(() => []) as Promise<ComboLike[]>;
  return combosCachePromise;
}

// ---------------------------------------------------------------------------
// Context-overflow deferral
// ---------------------------------------------------------------------------

/**
 * #10225 — resolve whether this request's combo preflight should DEFER its hard
 * context-overflow rejection so chatCore's compression runs first.
 *
 * Mirrors handleChatCore's own enablement determination (chatCore.ts): defer only
 * when the global compression switch is ON and the API key has not opted out
 * (`apiKeyInfo.compressionEnabled !== false`). Per-target applicability (server-side
 * exclusions) is checked inside getKnownContextOverflow via the returned exclusions.
 * Fail closed (defer=false) on any lookup error — the existing hard preflight stays.
 */
async function resolveComboContextOverflowDeferral(
  logger: { warn?: (...args: unknown[]) => void } | null | undefined,
  apiKeyInfo: { compressionEnabled?: boolean } | null | undefined
): Promise<{ defer: boolean; exclusions: CompressionExclusions | undefined }> {
  try {
    const compression = await resolveCompressionSettings(logger);
    return {
      defer: compression.enabled && apiKeyInfo?.compressionEnabled !== false,
      exclusions: compression.settings?.exclusions,
    };
  } catch {
    return { defer: false, exclusions: undefined };
  }
}

// ---------------------------------------------------------------------------
// Managed-combo check
// ---------------------------------------------------------------------------

function isManagedComboUnsupported(
  combo: ComboLike,
  settings: Record<string, unknown>,
  allCombos: ComboLike[],
  visited = new Set<string>()
): boolean {
  if (visited.has(combo.name)) return false;
  visited.add(combo.name);
  const strategy = combo.strategy ?? "priority";
  const config = resolveComboConfig(combo, settings) as Record<string, unknown>;
  const resolvedTargets = resolveComboTargets(combo, allCombos);
  const pipeline =
    strategy === "pipeline" ||
    (strategy === "auto" && (config.pipeline_enabled === true || combo.name === "auto/smart"));
  const nestedUnsafe = (combo.models as Array<{ kind?: string; comboName?: string }>).some(
    (step) => {
      if (step?.kind !== "combo-ref" || !step.comboName) return false;
      const nested = allCombos.find((candidate) => candidate.name === step.comboName);
      return Boolean(nested && isManagedComboUnsupported(nested, settings, allCombos, visited));
    }
  );
  return (
    strategy === "fusion" ||
    strategy === "context-relay" ||
    (config.chaos as { enabled?: boolean } | undefined)?.enabled === true ||
    (config.shadowRouting as { enabled?: boolean } | undefined)?.enabled === true ||
    (config.zeroLatencyOptimizationsEnabled === true && config.hedging === true) ||
    (resolvedTargets.length > 1 &&
      (pipeline || resolvedTargets.some((target) => Boolean(target.connectionId?.trim())))) ||
    nestedUnsafe
  );
}

// ---------------------------------------------------------------------------
// Managed-lease rejection
// ---------------------------------------------------------------------------

const managedComboRejection = () =>
  buildManagedLeaseErrorResponse(
    new LeaseContextError(
      409,
      "LEASE_UNSUPPORTED_ROUTE",
      "Managed leases do not support this route"
    )
  );

// ---------------------------------------------------------------------------
// Combo-promote dependencies
// ---------------------------------------------------------------------------

const comboPromoteDeps = { updateCombo, info: log.info, warn: log.warn };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  getCombosCachedForChat,
  resolveComboContextOverflowDeferral,
  isManagedComboUnsupported,
  managedComboRejection,
  comboPromoteDeps,
};
