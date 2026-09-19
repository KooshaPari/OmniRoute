/**
 * Combo validation and managed-lease rejection helpers.
 *
 * Extracted from chat.ts to keep the main handler barrel manageable.
 */

import type { ComboLike } from "@omniroute/open-sse/services/combo/types.ts";
import { resolveComboTargets } from "@omniroute/open-sse/services/combo.ts";
import { resolveComboConfig } from "@omniroute/open-sse/services/comboConfig.ts";
import { buildManagedLeaseErrorResponse, LeaseContextError } from "../../services/leaseContext";
import { updateCombo } from "@/lib/db/combos";
import * as log from "../../utils/logger";

/**
 * Determine whether a combo (or any nested combo-ref inside it) uses a
 * strategy or config that is incompatible with managed-lease dispatch.
 */
export function isManagedComboUnsupported(
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

/**
 * Build a 409 response for unsupported managed-lease combo routes.
 */
export const managedComboRejection = () =>
  buildManagedLeaseErrorResponse(
    new LeaseContextError(
      409,
      "LEASE_UNSUPPORTED_ROUTE",
      "Managed leases do not support this route"
    )
  );

/** Shared deps for auto-promoting a successful combo model. */
export const comboPromoteDeps = { updateCombo, info: log.info, warn: log.warn };
